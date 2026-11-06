// The match itself: two players, one ball, two goals, and how they move and
// collide. The server steps this as the truth. The browser steps the same
// code ahead of the last snapshot, so that the pitch moves smoothly between
// snapshots and the player's own runs, jumps and kicks show at once; the bot
// uses it to look at the ball. Nothing in here is random, so the same world
// and the same inputs always come out the same.
//
// A world is plain JSON (see pack/unpack). Seat 0 defends the left goal and
// faces right; seat 1 defends the right goal and faces left. Players always
// face the goal they attack, so a kick always goes that way.
//
// The match (server/match.js) sets world.phase: in 'countdown' nothing
// moves; in 'playing' the clock runs, goals count and power-ups come and
// go; in 'goal' (after a goal) everything moves on but nothing counts.
// When the ball crosses a goal line in play, world.goal says who scored.
//
// Power-ups (world.items) are put in by the server, the only one to roll
// dice; what happens once one is there is worked out here like the rest.
// A browser's prediction (world.predict) takes no power-ups, scores no
// goals, flattens nobody and records no events: those wait for the server.

import {
  BALL_GRAVITY, BALL_MAX_SPEED, DROP_LEAN, BALL_R, BALL_SUBSTEPS, BAR_R, BAR_ROLL, BIG_BALL_SCALE, BIG_BALL_TIME,
  BIG_HEAD_SCALE, BIG_HEAD_TIME, BODY_HALF_W, BUMP_MAX_SPEED, BOOT_R, BOOT_REST, BOOT_UP, CEIL, CROSSBAR_Y, DROP_Y, FIRE_SPEED,
  FIRE_ANGLES, FIRE_TIME, FLATTEN_TIME, FLOOR, FLOOR_BOUNCE, FREEZE_TIME, GOAL_W, GRAVITY, HEAD_BOUNCE, HEAD_R, HIP_FORWARD,
  HIP_UP, ITEM_LIFE, ITEM_R, JUMP_BUFFER, JUMP_SPEED, KICK_LIFT, KICK_MAX_ANGLE, KICK_MIN_ANGLE, KICK_SPEED,
  KICK_TIME, KICK_UP, KICKOFF_X, LEG, MOON_JUMP_SCALE, MOON_JUMP_TIME, NECK, PITCH_W, ROLL_FRICTION, RUN_ACCEL,
  RUN_SPEED, SHRINK_SCALE, SHRINK_TIME, SPEED_SCALE, SPEED_TIME, WALL_BOUNCE, WALL_TIME, AIR_DRAG,
} from './constants.js';

// How many events a world keeps for the snapshots to carry.
const EVENTS_KEPT = 16;
// A ball slower than this off the grass stops bouncing and rolls.
const SETTLE_SPEED = 150;
// A bump softer than this makes no sound.
const BUMP_SPEED = 260;
// A strike is allowed a little further out than the boot itself, so that a
// kick at a ball just in front of the boot does not miss by a hair.
const STRIKE_PAD = 6;
// A goal touched last by the keeper this soon after the other side kicked
// the ball counts for the kicker.
const DEFLECTED_WITHIN = 1.5;
// A ball stood on rolls out from under the player at this speed.
const SQUEEZE_SPEED = 90;
// Half the thickness of a goal wall (the power-up).
const WALL_HALF = 5;
const NO_INPUT = { left: false, right: false, jump: false };

// ---- small geometry ----

export const facingOf = (seat) => (seat ? -1 : 1);
// The x of a seat's own goal line, which the ball must cross for the other to score.
export const goalLineOf = (seat) => (seat ? PITCH_W - GOAL_W : GOAL_W);
// The head's radius, with any power-ups on it.
export const headRadius = (p) => HEAD_R * (p.bigT > 0 ? BIG_HEAD_SCALE : 1) * (p.smallT > 0 ? SHRINK_SCALE : 1);
export const headOf = (p) => {
  const r = headRadius(p);
  return { x: p.x, y: p.y - NECK - r, r };
};
export const hipOf = (p) => ({ x: p.x + facingOf(p.seat) * HIP_FORWARD, y: p.y - HIP_UP });
// The boot's angle above the horizontal: at rest, or where a kick has it.
export function bootAngle(p) {
  if (p.kickT < 0) return BOOT_REST;
  const up = KICK_TIME * KICK_UP;
  const k = p.kickT < up ? p.kickT / up : 1 - (p.kickT - up) / (KICK_TIME - up);
  return BOOT_REST + (BOOT_UP - BOOT_REST) * Math.max(0, Math.min(1, k));
}
export function bootOf(p) {
  const hip = hipOf(p);
  const a = bootAngle(p);
  return { x: hip.x + facingOf(p.seat) * Math.cos(a) * LEG, y: hip.y - Math.sin(a) * LEG, r: BOOT_R };
}
export const ballRadius = (ball) => BALL_R * (ball.bigT > 0 ? BIG_BALL_SCALE : 1);
// Whether a player can do nothing just now: frozen, or flattened by a fire shot.
export const helpless = (p) => p.freezeT > 0 || p.flatT > 0;

// ---- a new world ----

function newPlayer(seat) {
  return {
    seat,
    x: KICKOFF_X[seat],
    y: FLOOR,
    vx: 0,
    vy: 0,
    onGround: true,
    input: { ...NO_INPUT }, // what the player is holding: { left, right, jump }
    jumpBuf: 0, // time left in which a jump just pressed still happens on landing
    kickT: -1, // time into the kick being made, -1 for none
    kickHit: false, // whether this kick has struck the ball already
    // Power-ups: time left on each, and a fire shot waiting for the next kick.
    bigT: 0,
    smallT: 0,
    speedT: 0,
    freezeT: 0,
    moonT: 0,
    flatT: 0,
    wallT: 0, // a wall across this player's own goal
    fire: false,
  };
}

function newBall(x = PITCH_W / 2) {
  return {
    x,
    y: DROP_Y,
    vx: 0,
    vy: 0,
    rot: 0, // how far it has rolled, for drawing
    lastTouch: -1, // the seat that touched it last, who gets power-ups it takes
    kickBy: -1, // the seat that kicked it last,
    kickAge: 0, // and how long ago, so that a shot deflected in by the keeper counts for the shooter
    fireT: 0, // time left on a fire shot
    fireBy: -1,
    bigT: 0,
  };
}

// A world at kick-off. `eventId` carries the event count on, so that events
// are never numbered twice in a match.
export function createWorld({ eventId = 0 } = {}) {
  return {
    phase: 'countdown', // 'countdown' | 'playing' | 'goal', set by the match
    t: 0, // seconds stepped while not counting down
    players: [newPlayer(0), newPlayer(1)],
    ball: newBall(),
    items: [], // power-ups floating over the pitch: { id, kind, x, y, t }
    itemId: 0,
    goal: -1, // the seat that just scored, until the match takes note
    events: [],
    eventId,
    predict: false, // true in the browser: no goals, power-ups, flattening or events
  };
}

// Back to kick-off after a goal: the players in their places, the ball
// dropped a little to the side of `conceded` (the seat that let the goal
// in), so that they get the first touch, and every power-up gone. Inputs
// are kept, since the keys may still be held.
export function resetForKickoff(world, conceded = -1) {
  world.players = world.players.map((p) => ({ ...newPlayer(p.seat), input: { ...p.input } }));
  world.ball = newBall(PITCH_W / 2 + (conceded === -1 ? 0 : -facingOf(conceded) * DROP_LEAN));
  world.items = [];
  world.goal = -1;
}

// Something the screens should show or play: a kick, a goal, a power-up.
// Only the server's world records them; the browser plays them from
// snapshots.
function emit(world, type, data) {
  if (world.predict) return;
  world.events.push({ id: ++world.eventId, type, ...data });
  if (world.events.length > EVENTS_KEPT) world.events.shift();
}

// ---- inputs ----

// What a player is holding: left, right, and jump. A jump pressed in the air
// is remembered for a moment and happens on landing; held, it jumps again
// and again.
export function setInput(world, seat, { left, right, jump }) {
  const p = world.players[seat];
  const next = { left: left === true, right: right === true, jump: jump === true };
  if (next.jump && !p.input.jump) p.jumpBuf = JUMP_BUFFER;
  p.input = next;
}

// The kick button: the boot swings up in front. Returns whether it did,
// which it does not while a kick is still going, while the player cannot
// move, or before kick-off.
export function kick(world, seat) {
  const p = world.players[seat];
  if (world.phase === 'countdown' || p.kickT >= 0 || helpless(p)) return false;
  p.kickT = 0;
  p.kickHit = false;
  return true;
}

// A power-up appears; the server says what and where.
export function spawnItem(world, kind, x, y) {
  const item = { id: ++world.itemId, kind, x, y, t: 0 };
  world.items.push(item);
  emit(world, 'spawn', { kind, x, y });
  return item;
}

function applyPower(world, seat, kind) {
  const p = world.players[seat];
  const other = world.players[1 - seat];
  switch (kind) {
    case 'bigHead': p.bigT = BIG_HEAD_TIME; p.smallT = 0; break;
    case 'shrink': other.smallT = SHRINK_TIME; other.bigT = 0; break;
    case 'speed': p.speedT = SPEED_TIME; break;
    case 'freeze': other.freezeT = FREEZE_TIME; other.kickT = -1; break;
    case 'fire': p.fire = true; break;
    case 'bigBall': world.ball.bigT = BIG_BALL_TIME; break;
    case 'wall': p.wallT = WALL_TIME; break;
    case 'moonJump': p.moonT = MOON_JUMP_TIME; break;
    default:
  }
}

// ---- stepping ----

// Moves the world on by `dt` seconds.
export function step(world, dt) {
  if (world.phase === 'countdown') return;
  world.t += dt;
  const playing = world.phase === 'playing';
  for (const p of world.players) stepPlayer(world, p, dt, playing);
  separatePlayers(world);
  stepBall(world, dt, playing);
  if (playing) stepItems(world, dt);
}

const tickDown = (value, dt) => (value > 0 ? Math.max(0, value - dt) : 0);

function stepPlayer(world, p, dt, playing) {
  if (playing) {
    for (const key of ['bigT', 'smallT', 'speedT', 'freezeT', 'moonT', 'flatT', 'wallT']) p[key] = tickDown(p[key], dt);
  }
  const stuck = helpless(p);
  const want = stuck ? 0 : (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
  const target = want * RUN_SPEED * (p.speedT > 0 ? SPEED_SCALE : 1);
  const change = RUN_ACCEL * dt;
  p.vx = p.vx < target ? Math.min(target, p.vx + change) : Math.max(target, p.vx - change);

  if (!stuck && p.onGround && (p.input.jump || p.jumpBuf > 0)) {
    p.vy = -JUMP_SPEED * (p.moonT > 0 ? MOON_JUMP_SCALE : 1);
    p.onGround = false;
    p.jumpBuf = 0;
  }
  p.jumpBuf = tickDown(p.jumpBuf, dt);

  if (p.kickT >= 0) {
    p.kickT += dt;
    if (p.kickT >= KICK_TIME) p.kickT = -1;
  }

  const prevX = p.x;
  const prevY = p.y;
  const prevTop = headOf(p).y - headRadius(p);
  p.vy += GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.onGround = false;
  if (p.y >= FLOOR) {
    p.y = FLOOR;
    p.vy = 0;
    p.onGround = true;
  }
  p.x = Math.max(BODY_HALF_W, Math.min(PITCH_W - BODY_HALF_W, p.x));
  for (const side of [0, 1]) crossbarVersusPlayer(p, side, prevX, prevY, prevTop);
}

// The span of a crossbar along x: from the side of the picture to the goal line.
const barSpan = (side) => (side ? [PITCH_W - GOAL_W, PITCH_W] : [0, GOAL_W]);

// A crossbar can be landed on, bumps a head that jumps into it from below,
// and stops a player in the air from passing through its end.
function crossbarVersusPlayer(p, side, prevX, prevY, prevTop) {
  const [x1, x2] = barSpan(side);
  const half = BODY_HALF_W * 0.6;
  const over = p.x + half > x1 && p.x - half < x2;
  const barTop = CROSSBAR_Y - BAR_R;
  const barBottom = CROSSBAR_Y + BAR_R;
  const top = headOf(p).y - headRadius(p);
  if (!over) return;
  if (p.vy >= 0 && prevY <= barTop + 0.01 && p.y >= barTop) {
    p.y = barTop;
    p.vy = 0;
    p.onGround = true;
  } else if (p.vy < 0 && prevTop >= barBottom - 0.01 && top < barBottom) {
    p.y += barBottom - top;
    p.vy = 0;
  } else if (top < barBottom && p.y > barTop) {
    // Level with the bar: it came in from the side, so it goes back out.
    const wasOver = prevX + half > x1 && prevX - half < x2;
    if (!wasOver) p.x = side ? x1 - half : x2 + half;
  }
}

// Heads do not pass through each other: side by side they push apart, and
// one coming down on the other stands on it.
function separatePlayers(world) {
  const [a, b] = world.players;
  const ha = headOf(a);
  const hb = headOf(b);
  const dx = hb.x - ha.x;
  const dy = hb.y - ha.y;
  const min = ha.r + hb.r;
  const d = Math.hypot(dx, dy);
  if (d >= min) return;
  if (Math.abs(dy) > 0.6 * min) {
    const [upper, lower, hl, hu] = dy > 0 ? [a, b, hb, ha] : [b, a, ha, hb];
    const rise = Math.sqrt(Math.max(0, min * min - dx * dx)) - Math.abs(hl.y - hu.y);
    upper.y -= rise;
    if (upper.vy > lower.vy) {
      upper.vy = lower.vy;
      upper.onGround = true;
    }
    return;
  }
  const need = Math.sqrt(Math.max(0, min * min - dy * dy)) - Math.abs(dx);
  const dir = dx >= 0 ? 1 : -1;
  const lo = BODY_HALF_W;
  const hi = PITCH_W - BODY_HALF_W;
  let pushA = need / 2;
  let pushB = need / 2;
  // One against the side of the picture leaves the other to give way.
  const aRoom = dir > 0 ? a.x - lo : hi - a.x;
  const bRoom = dir > 0 ? hi - b.x : b.x - lo;
  if (aRoom < pushA) { pushB += pushA - aRoom; pushA = aRoom; }
  if (bRoom < pushB) { pushA += Math.min(aRoom - pushA, pushB - bRoom); pushB = bRoom; }
  a.x -= dir * pushA;
  b.x += dir * pushB;
}

// ---- the ball ----

function stepBall(world, dt, playing) {
  const ball = world.ball;
  if (playing) ball.bigT = tickDown(ball.bigT, dt);
  ball.kickAge += dt;
  const h = dt / BALL_SUBSTEPS;
  for (let i = 0; i < BALL_SUBSTEPS; i++) {
    const r = ballRadius(ball);
    if (ball.fireT > 0) {
      ball.fireT = tickDown(ball.fireT, h);
      if (ball.fireT === 0) ball.fireBy = -1;
    } else {
      ball.vy += BALL_GRAVITY * h;
    }
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    // The nearer player meets the ball first, so that neither seat wins
    // every tie.
    const [a, b] = world.players;
    const near = Math.abs(ball.x - a.x) <= Math.abs(ball.x - b.x) ? [a, b] : [b, a];
    for (const p of near) ballVersusPlayer(world, ball, p, r);
    ballVersusPitch(world, ball, r, h);
    if (playing && world.goal === -1 && !world.predict) checkGoal(world, ball);
    const speed = Math.hypot(ball.vx, ball.vy);
    const max = ball.fireT > 0 ? FIRE_SPEED : BALL_MAX_SPEED;
    if (speed > max) {
      ball.vx *= max / speed;
      ball.vy *= max / speed;
    }
    ball.rot += (ball.vx * h) / r;
  }
  if (ball.fireT <= 0) {
    const onGrass = ball.y + ballRadius(ball) >= FLOOR - 6;
    ball.vx *= (onGrass ? ROLL_FRICTION : AIR_DRAG) ** dt;
  }
}

// Bounces the ball off a circle (a head or a boot) moving at (vx, vy):
// pushes it out, and sends it back off the surface, counting the circle's
// own motion. Returns the speed it came in at, or 0 if they do not touch.
function bounceOffCircle(ball, r, cx, cy, cr, vx, vy, keep) {
  let dx = ball.x - cx;
  let dy = ball.y - cy;
  let d = Math.hypot(dx, dy);
  if (d >= r + cr) return 0;
  if (d < 1e-6) { dx = 0; dy = -1; d = 1; }
  const nx = dx / d;
  const ny = dy / d;
  ball.x = cx + nx * (r + cr);
  ball.y = cy + ny * (r + cr);
  const rvx = ball.vx - vx;
  const rvy = ball.vy - vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    ball.vx -= (1 + keep) * vn * nx;
    ball.vy -= (1 + keep) * vn * ny;
  }
  return Math.max(1e-3, -vn);
}

function ballVersusPlayer(world, ball, p, r) {
  // A flattened player lies on the grass, out of the ball's way.
  if (p.flatT > 0) return;
  const head = headOf(p);
  const touching = Math.hypot(ball.x - head.x, ball.y - head.y) < r + head.r;
  if (touching && ball.fireT > 0 && ball.fireBy !== p.seat) {
    // A fire shot goes through a rival and flattens them.
    if (!world.predict) {
      p.flatT = FLATTEN_TIME;
      p.kickT = -1;
      emit(world, 'flatten', { seat: p.seat, x: head.x, y: head.y });
    }
    return;
  }
  if (touching && standOnBall(ball, r, p, head)) return;
  const hit = bounceOffCircle(ball, r, head.x, head.y, head.r, p.vx, p.vy, HEAD_BOUNCE);
  if (hit) {
    touch(world, ball, p.seat);
    capSpeed(ball, BUMP_MAX_SPEED);
    if (hit > BUMP_SPEED) emit(world, 'header', { seat: p.seat, x: ball.x, y: ball.y });
  }

  const boot = bootOf(p);
  const striking = p.kickT >= 0 && p.kickT <= KICK_TIME * KICK_UP && !p.kickHit;
  if (striking && Math.hypot(ball.x - boot.x, ball.y - boot.y) < r + boot.r + STRIKE_PAD) {
    strike(world, ball, p, r);
    return;
  }
  if (Math.hypot(ball.x - boot.x, ball.y - boot.y) < r + boot.r && standOnBall(ball, r, p, boot)) return;
  const bump = bounceOffCircle(ball, r, boot.x, boot.y, boot.r, p.vx, p.vy, HEAD_BOUNCE);
  if (bump) {
    touch(world, ball, p.seat);
    capSpeed(ball, BUMP_MAX_SPEED);
  }
}

function capSpeed(ball, max) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > max) {
    ball.vx *= max / speed;
    ball.vy *= max / speed;
  }
}

// A player coming down on a ball lying on the grass stands on it, rather
// than squeezing it out sideways at a silly speed; the ball is nudged out
// from under them. `part` is the head or the boot that met it. Returns
// whether that is what happened.
function standOnBall(ball, r, p, part) {
  const onGrass = ball.y + r >= FLOOR - 1;
  const dx = ball.x - part.x;
  const dy = ball.y - part.y;
  const d = Math.hypot(dx, dy) || 1;
  if (!onGrass || dy / d < 0.5 || p.vy < 0) return false;
  const lift = r + part.r - d;
  p.y -= lift;
  p.vy = 0;
  p.onGround = true;
  const away = dx >= 0 ? 1 : -1;
  if (ball.vx * away < SQUEEZE_SPEED) ball.vx = away * SQUEEZE_SPEED;
  ball.lastTouch = p.seat;
  return true;
}

// Whoever touches the ball last gets what it takes, and a fire shot ends on
// its own kicker.
function touch(world, ball, seat) {
  ball.lastTouch = seat;
  if (ball.fireT > 0) {
    ball.fireT = 0;
    ball.fireBy = -1;
  }
}

// The boot meets the ball on its way up: the ball flies off towards the goal
// the player attacks, rising more the higher it was struck. A fire shot
// waiting for this kick goes almost flat, fast, and does not drop.
function strike(world, ball, p, r) {
  const facing = facingOf(p.seat);
  const hip = hipOf(p);
  const along = Math.max(1, facing * (ball.x - hip.x));
  let angle = Math.atan2(hip.y - ball.y, along) + KICK_LIFT;
  angle = Math.max(KICK_MIN_ANGLE, Math.min(KICK_MAX_ANGLE, angle));
  let speed = KICK_SPEED;
  p.kickHit = true;
  ball.lastTouch = p.seat;
  ball.kickBy = p.seat;
  ball.kickAge = 0;
  ball.fireT = 0;
  ball.fireBy = -1;
  if (p.fire) {
    p.fire = false;
    angle = Math.max(FIRE_ANGLES[0], Math.min(FIRE_ANGLES[1], angle - KICK_LIFT));
    speed = FIRE_SPEED;
    ball.fireT = FIRE_TIME;
    ball.fireBy = p.seat;
  }
  ball.vx = facing * Math.cos(angle) * speed + p.vx * 0.25;
  ball.vy = -Math.sin(angle) * speed + Math.min(0, p.vy) * 0.2;
  // Out of the boot, so that it is not struck again by the same swing.
  const boot = bootOf(p);
  const d = Math.hypot(ball.x - boot.x, ball.y - boot.y) || 1;
  if (d < r + boot.r) {
    ball.x = boot.x + ((ball.x - boot.x) / d) * (r + boot.r);
    ball.y = boot.y + ((ball.y - boot.y) / d) * (r + boot.r);
  }
  emit(world, ball.fireT > 0 ? 'fire' : 'kick', { seat: p.seat, x: ball.x, y: ball.y });
}

// A fire shot ends on anything that is not a player.
function quench(ball) {
  ball.fireT = 0;
  ball.fireBy = -1;
}

function ballVersusPitch(world, ball, r, h) {
  if (ball.x - r < 0) {
    ball.x = r;
    if (ball.vx < 0) ball.vx = -ball.vx * WALL_BOUNCE;
    quench(ball);
  } else if (ball.x + r > PITCH_W) {
    ball.x = PITCH_W - r;
    if (ball.vx > 0) ball.vx = -ball.vx * WALL_BOUNCE;
    quench(ball);
  }
  if (ball.y - r < CEIL) {
    ball.y = CEIL + r;
    if (ball.vy < 0) ball.vy = -ball.vy * WALL_BOUNCE;
    quench(ball);
  }
  if (ball.y + r > FLOOR) {
    ball.y = FLOOR - r;
    if (ball.vy > 0) {
      ball.vy = ball.vy < SETTLE_SPEED ? 0 : -ball.vy * FLOOR_BOUNCE;
    }
    quench(ball);
  }
  for (const side of [0, 1]) {
    const [x1, x2] = barSpan(side);
    const cx = Math.max(x1, Math.min(x2, ball.x));
    const hit = bounceOffCircle(ball, r, cx, CROSSBAR_Y, BAR_R, 0, 0, WALL_BOUNCE);
    if (hit) {
      quench(ball);
      if (hit > BUMP_SPEED) emit(world, 'post', { x: ball.x, y: ball.y });
      // Resting on top, it rolls off towards the pitch rather than sitting there.
      if (ball.y < CROSSBAR_Y && Math.abs(ball.vy) < 120) ball.vx += (side ? -1 : 1) * BAR_ROLL * h;
    }
    // A goal wall: from the crossbar down to the grass, along the goal line.
    if (world.players[side].wallT > 0) {
      const lx = goalLineOf(side);
      const cy = Math.max(CROSSBAR_Y, Math.min(FLOOR, ball.y));
      const blocked = bounceOffCircle(ball, r, lx, cy, WALL_HALF, 0, 0, WALL_BOUNCE);
      if (blocked) {
        quench(ball);
        if (blocked > BUMP_SPEED) emit(world, 'block', { seat: side, x: ball.x, y: ball.y });
      }
    }
  }
}

// The ball's middle over a goal line, under the crossbar, is a goal.
function checkGoal(world, ball) {
  let conceded = -1;
  if (ball.x < GOAL_W && ball.y > CROSSBAR_Y) conceded = 0;
  else if (ball.x > PITCH_W - GOAL_W && ball.y > CROSSBAR_Y) conceded = 1;
  if (conceded === -1) return;
  world.goal = 1 - conceded;
  const { by, own } = scorerOf(ball, world.goal);
  emit(world, 'goal', { seat: world.goal, by, own, x: ball.x, y: ball.y });
}

// Who a goal for `seat` is put down to: whoever touched the ball last, but a
// shot that the keeper only got a head or a boot to on its way in is the
// shooter's. It is an own goal when the side that conceded put it in.
export function scorerOf(ball, seat) {
  if (ball.lastTouch === 1 - seat && ball.kickBy === seat && ball.kickAge < DEFLECTED_WITHIN) return { by: seat, own: false };
  return { by: ball.lastTouch, own: ball.lastTouch === 1 - seat };
}

// ---- power-ups ----

// A power-up is taken by the ball, for whoever touched it last, or by a
// player heading it.
function stepItems(world, dt) {
  const ball = world.ball;
  const r = ballRadius(ball);
  world.items = world.items.filter((item) => {
    item.t += dt;
    if (item.t >= ITEM_LIFE) return false;
    if (world.predict) return true;
    let taker = -1;
    if (ball.lastTouch >= 0 && Math.hypot(ball.x - item.x, ball.y - item.y) < r + ITEM_R) taker = ball.lastTouch;
    for (const p of world.players) {
      const head = headOf(p);
      if (taker === -1 && p.flatT <= 0 && Math.hypot(head.x - item.x, head.y - item.y) < head.r + ITEM_R) taker = p.seat;
    }
    if (taker === -1) return true;
    applyPower(world, taker, item.kind);
    emit(world, 'power', { kind: item.kind, seat: taker, x: item.x, y: item.y });
    return false;
  });
}

// ---- snapshots ----

const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;

// The world as plain JSON for a snapshot, rounded to keep it short.
export function pack(world) {
  return {
    phase: world.phase,
    t: r3(world.t),
    goal: world.goal,
    eventId: world.eventId,
    itemId: world.itemId,
    events: world.events,
    items: world.items.map((i) => ({ ...i, t: r3(i.t) })),
    ball: {
      x: r1(world.ball.x), y: r1(world.ball.y), vx: r1(world.ball.vx), vy: r1(world.ball.vy), rot: r3(world.ball.rot),
      lastTouch: world.ball.lastTouch, kickBy: world.ball.kickBy, kickAge: r3(world.ball.kickAge), fireT: r3(world.ball.fireT), fireBy: world.ball.fireBy, bigT: r3(world.ball.bigT),
    },
    players: world.players.map((p) => ({
      seat: p.seat, x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), onGround: p.onGround, input: { ...p.input },
      jumpBuf: r3(p.jumpBuf), kickT: r3(p.kickT), kickHit: p.kickHit,
      bigT: r3(p.bigT), smallT: r3(p.smallT), speedT: r3(p.speedT), freezeT: r3(p.freezeT), moonT: r3(p.moonT),
      flatT: r3(p.flatT), wallT: r3(p.wallT), fire: p.fire,
    })),
  };
}

// A world to step from a packed one; `predict` for the browser's.
export function unpack(packed, predict = true) {
  return {
    ...packed,
    events: [],
    items: (packed.items ?? []).map((i) => ({ ...i })),
    ball: { ...packed.ball },
    players: packed.players.map((p) => ({ ...p, input: { ...p.input } })),
    predict,
  };
}
