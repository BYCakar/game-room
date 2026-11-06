// The computer opponent. It sees what a player sees, the world, and does
// what a player does: holds left, right and jump, and presses kick. It
// works out where the ball is going (ignoring the players), runs to get
// behind it on the side of its own goal, so that running into it pushes it
// the right way, and kicks it when it is in front of its boot. It heads balls
// that drop towards it, hops over a ball it has to get round, and when a
// ball is flying at its own goal it runs back to stand in it. Lower levels
// react later, stand about more, misjudge where to stand and let more
// chances go.

import {
  BALL_GRAVITY, BOOT_R, CEIL, CROSSBAR_Y, FLOOR, FLOOR_BOUNCE, GOAL_W, LEG, NECK, PITCH_W, RUN_SPEED, SPEED_SCALE,
  WALL_BOUNCE,
} from './constants.js';
import { ballRadius, facingOf, goalLineOf, headRadius, helpless } from './sim.js';

export const BOT_LEVELS = 8;

// Per level, from 1 to 8: how long it sticks to a plan before looking again
// (seconds), how far off it is about where to stand (pixels, either way),
// how likely it is to take a kick or a header when one is on, how far ahead
// it follows the ball (seconds), and how likely it is to stand about for a
// while instead of moving.
const REACTION = [0.34, 0.27, 0.21, 0.17, 0.13, 0.1, 0.07, 0.05];
const AIM_ERROR = [70, 55, 42, 32, 22, 14, 8, 4];
const KICK_CHANCE = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.88, 0.95];
const HEADER_CHANCE = [0.15, 0.25, 0.35, 0.45, 0.55, 0.68, 0.8, 0.9];
const LOOKAHEAD = [0.3, 0.45, 0.6, 0.72, 0.85, 1.0, 1.1, 1.2];
const IDLE = [0.3, 0.22, 0.15, 0.1, 0.06, 0.03, 0.01, 0];
// How likely it is to hop over a ball it has to get round, rather than run
// into it, and from which level on it jumps to kick balls a little above
// its boot.
const HOP_CHANCE = [0.2, 0.35, 0.5, 0.62, 0.74, 0.84, 0.92, 0.97];
const VOLLEYS_FROM = 6;
// From this level on it falls back to guard its goal when its rival will
// reach the ball first, standing at most this far out.
const GUARDS_FROM = 2;
const GUARD_MAX = 240;

// Steps of the ball's path as the bot works it out.
const PATH_STEP = 1 / 30;
// It stands still when this close to where it wants to be.
const DEAD_ZONE = 6;
// How high a jump lifts a head, roughly, for deciding on headers.
const JUMP_REACH = 150;

// Where the ball will be over the next `seconds`, one point per PATH_STEP,
// if nobody touches it: it falls, and bounces off the grass, the sides,
// the top and the crossbars (taken as flat). A fire shot flies straight.
export function ballPath(world, seconds) {
  const ball = world.ball;
  const r = ballRadius(ball);
  let { x, y, vx, vy } = ball;
  let fire = ball.fireT;
  const path = [];
  for (let t = PATH_STEP; t <= seconds + 1e-9; t += PATH_STEP) {
    if (fire > 0) fire -= PATH_STEP;
    else vy += BALL_GRAVITY * PATH_STEP;
    x += vx * PATH_STEP;
    y += vy * PATH_STEP;
    if (x - r < 0) { x = r; vx = Math.abs(vx) * WALL_BOUNCE; fire = 0; }
    if (x + r > PITCH_W) { x = PITCH_W - r; vx = -Math.abs(vx) * WALL_BOUNCE; fire = 0; }
    if (y - r < CEIL) { y = CEIL + r; vy = Math.abs(vy) * WALL_BOUNCE; fire = 0; }
    if (y + r > FLOOR) { y = FLOOR - r; vy = -Math.abs(vy) * FLOOR_BOUNCE; fire = 0; }
    const overBar = x < GOAL_W || x > PITCH_W - GOAL_W;
    if (overBar && vy > 0 && y + r > CROSSBAR_Y && y + r - vy * PATH_STEP <= CROSSBAR_Y) {
      y = CROSSBAR_Y - r;
      vy = -Math.abs(vy) * WALL_BOUNCE;
    }
    path.push({ t, x, y });
  }
  return path;
}

// Whether the ball, on `path`, goes into the goal that `seat` defends.
function headingIntoGoal(path, seat) {
  const line = goalLineOf(seat);
  return path.some((q) => (seat ? q.x > line : q.x < line) && q.y > CROSSBAR_Y);
}

// A brain for one match at `level` (1 to 8). `rand` is for tests.
export function createBrain(level, rand = Math.random) {
  const i = Math.max(1, Math.min(BOT_LEVELS, level)) - 1;
  let planLeft = 0; // seconds until it looks again
  let move = 0; // -1 left, 1 right, 0 stay
  let error = 0; // how far off it stands from where it means to
  let idle = false;
  let jumpNext = false;
  let mayKick = false;
  let mayHead = false;
  let mayHop = false;

  // Where it means to be, and whether to hop on the way.
  function plan(world, seat) {
    const p = world.players[seat];
    const ball = world.ball;
    const facing = facingOf(seat);
    const r = ballRadius(ball);
    const hr = headRadius(p);
    const speed = RUN_SPEED * (p.speedT > 0 ? SPEED_SCALE : 1);
    const path = ballPath(world, LOOKAHEAD[i]);

    // The first point on the ball's path low enough to play that it can
    // get to in time; failing that, where it ends up.
    let aim = path[path.length - 1] ?? ball;
    for (const q of path) {
      if (q.y > FLOOR - NECK - 2 * hr - JUMP_REACH && Math.abs(q.x - p.x) <= speed * q.t + 30) { aim = q; break; }
    }
    // Behind the ball, as seen from the goal it attacks.
    let target = aim.x - facing * (hr * 0.8 + r) + error;
    if (facing * (ball.x - p.x) < -8) {
      // The ball has got past it: get back round it, to its own-goal side.
      // decide() hops over it, or holds back, so as not to push it on in.
      target = aim.x - facing * (hr + r + 40);
    }
    // Its rival will get to the ball first: fall back between the ball and
    // its own goal, closer to the goal the closer the ball is to it.
    const o = world.players[1 - seat];
    const line = goalLineOf(seat);
    const mine = Math.abs(aim.x - p.x) / speed;
    const theirs = Math.abs(aim.x - o.x) / RUN_SPEED;
    const theirSide = facing * (o.x - aim.x) > 0; // the rival is on the far side of the ball, facing this goal
    if (i + 1 >= GUARDS_FROM && theirSide && theirs + 0.1 < mine) {
      const gap = Math.abs(aim.x - line);
      target = line + facing * Math.max(hr, Math.min(GUARD_MAX, gap * 0.4)) + error * 0.5;
    }
    if (headingIntoGoal(path, seat) && facing * ball.vx < -150) {
      // On its way in: get back and stand in the goal mouth.
      target = line + facing * (hr - 6);
    }
    target = Math.max(GOAL_W * 0.4, Math.min(PITCH_W - GOAL_W * 0.4, target));
    move = Math.abs(target - p.x) <= DEAD_ZONE ? 0 : target > p.x ? 1 : -1;
    mayKick = rand() < KICK_CHANCE[i];
    mayHead = rand() < HEADER_CHANCE[i];
    mayHop = rand() < HOP_CHANCE[i];
  }

  // Asked every few hundredths of a second: what to hold, and whether to kick.
  function decide(world, seat, dt) {
    const p = world.players[seat];
    const none = { left: false, right: false, jump: false, kick: false };
    if (world.phase === 'countdown' || helpless(p)) return none;
    planLeft -= dt;
    if (planLeft <= 0) {
      planLeft = REACTION[i] * (0.75 + rand() * 0.5);
      error = (rand() * 2 - 1) * AIM_ERROR[i];
      idle = rand() < IDLE[i];
      plan(world, seat);
    }
    const ball = world.ball;
    const facing = facingOf(seat);
    const r = ballRadius(ball);
    const hr = headRadius(p);
    const ahead = facing * (ball.x - p.x); // how far in front the ball is
    const above = p.y - ball.y; // how far above the feet

    // A kick when the ball is in front of the boot, now or in a moment.
    const reach = LEG + BOOT_R + r + 10;
    const soon = { x: ball.x + ball.vx * 0.05, y: ball.y + ball.vy * 0.05 };
    const aheadSoon = facing * (soon.x - p.x);
    const inFront = (a, h) => a > 4 && a < reach && h > -4 && h < 95;
    let kick = mayKick && p.kickT < 0 && (inFront(ahead, above) || inFront(aheadSoon, p.y - soon.y));

    // A header, or a volley at higher levels, for a ball coming down at it.
    let jump = jumpNext;
    jumpNext = false;
    if (p.onGround && mayHead) {
      const top = p.y - NECK - 2 * hr;
      const path = ballPath(world, 0.5);
      // Only a ball that meets the front of the head goes the right way off it.
      const drop = path.find((q) => q.t >= 0.15 && facing * (q.x - p.x) > -hr * 0.2 && facing * (q.x - p.x) < hr + r &&
        q.y < top + 10 && q.y > top - JUMP_REACH);
      if (drop) jump = true;
      if (i + 1 >= VOLLEYS_FROM && ahead > 4 && ahead < reach && above > 95 && above < 170) {
        jump = true;
        kick = mayKick && p.kickT < 0;
      }
    }
    let going = idle ? 0 : move;
    // Running back at a ball that has got past it: a ball low enough to meet
    // the head or the boot is hopped over once close (a higher one is run
    // under). Not trusting itself to hop it, it holds back rather than shove
    // it towards its own goal.
    const backwards = going === -facing;
    if (backwards && ahead < 0 && p.onGround) {
      const low = ball.y + r > p.y - NECK - 2 * hr - 6;
      const close = -ahead < hr + r + 40 + Math.max(0, -facing * ball.vx) * 0.1;
      if (low && close) {
        if (mayHop) jump = true;
        else going = 0;
      }
    }
    return { left: going < 0, right: going > 0, jump, kick };
  }

  return { decide };
}
