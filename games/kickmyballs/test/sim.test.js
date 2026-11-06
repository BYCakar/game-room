// The simulation on its own: the ball, the players, kicks, headers, the
// crossbars, goals, power-ups, and the browser's prediction agreeing with
// the server.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BALL_R, BAR_R, BIG_BALL_SCALE, BIG_HEAD_SCALE, CROSSBAR_Y, DROP_Y, FIRE_TIME, FLATTEN_TIME, FLOOR, FREEZE_TIME,
  GOAL_W, HEAD_R, ITEM_LIFE, JUMP_SPEED, KICK_TIME, KICKOFF_X, MOON_JUMP_SCALE, NECK, PITCH_W, RUN_SPEED, SHRINK_SCALE,
  SPEED_SCALE, STEP,
} from '../shared/constants.js';
import {
  ballRadius, bootOf, createWorld, goalLineOf, headOf, headRadius, kick, pack, resetForKickoff, scorerOf, setInput,
  spawnItem, step, unpack,
} from '../shared/sim.js';

// A world in play, with the players parked out of the way unless placed.
function playing() {
  const w = createWorld();
  w.phase = 'playing';
  return w;
}
const run = (w, seconds) => {
  for (let t = 0; t < seconds - 1e-9; t += STEP) step(w, STEP);
};
// Puts the ball somewhere, still or moving.
const place = (w, x, y, vx = 0, vy = 0) => Object.assign(w.ball, { x, y, vx, vy });
// Moves both players into a corner each, far from the action.
function park(w) {
  w.players[0].x = 300;
  w.players[1].x = PITCH_W - 300;
}

test('kick-off: the players in their places and the ball dropped over the halfway line', () => {
  const w = createWorld();
  assert.equal(w.phase, 'countdown');
  assert.deepEqual(w.players.map((p) => p.x), KICKOFF_X);
  assert.deepEqual([w.ball.x, w.ball.y], [PITCH_W / 2, DROP_Y]);
  // Nothing moves before kick-off, whatever is held.
  setInput(w, 0, { right: true, jump: true });
  assert.equal(kick(w, 0), false);
  run(w, 1);
  assert.equal(w.players[0].x, KICKOFF_X[0]);
  assert.equal(w.ball.y, DROP_Y);
  assert.equal(w.t, 0);
});

test('the ball falls, bounces lower each time, and settles on the grass', () => {
  const w = playing();
  park(w);
  let lowest = 0;
  let bounces = 0;
  let wasFalling = false;
  for (let i = 0; i < 60 * 6; i++) {
    step(w, STEP);
    lowest = Math.max(lowest, w.ball.y);
    const falling = w.ball.vy > 0;
    if (wasFalling && !falling) bounces++;
    wasFalling = falling;
  }
  assert.ok(lowest <= FLOOR - BALL_R + 1e-9);
  assert.ok(bounces >= 2, `${bounces} bounces`);
  assert.equal(w.ball.y, FLOOR - BALL_R);
  assert.equal(w.ball.vy, 0);
});

test('a rolling ball slows down and stops', () => {
  const w = playing();
  park(w);
  w.players[0].x = 100;
  place(w, 400, FLOOR - BALL_R, 250, 0);
  run(w, 6);
  assert.ok(Math.abs(w.ball.vx) < 5, `still rolling at ${w.ball.vx}`);
  assert.ok(w.ball.x < 700 && w.ball.x > 450, `stopped at ${w.ball.x}`);
});

test('the ball bounces off the sides and the top of the picture', () => {
  const w = playing();
  park(w);
  place(w, 480, 100, 0, -900);
  step(w, STEP);
  run(w, 0.15);
  assert.ok(w.ball.vy > 0, 'off the top');
  assert.ok(w.ball.y >= BALL_R);
  const v = playing();
  park(v);
  place(v, 800, 200, 900, 0);
  run(v, 0.3);
  assert.ok(v.ball.vx < 0, 'off the right side');
  assert.ok(v.ball.x <= PITCH_W - BALL_R);
});

test('a ball dropped on a crossbar bounces off it and rolls off towards the pitch', () => {
  const w = playing();
  park(w);
  place(w, 30, CROSSBAR_Y - 120, 0, 0);
  let bounced = false;
  for (let i = 0; i < 60 * 4; i++) {
    step(w, STEP);
    if (w.ball.vy < 0 && w.ball.y < CROSSBAR_Y) bounced = true;
  }
  assert.ok(bounced, 'it bounced off the bar');
  // It ends up off the bar on the pitch side, not in the goal and not on top.
  assert.ok(w.ball.x > GOAL_W, `ball at ${w.ball.x}`);
  assert.equal(w.goal, -1);
});

test('a ball under the crossbar can go in; one over it cannot', () => {
  const w = playing();
  park(w);
  place(w, 200, FLOOR - BALL_R - 20, -700, 0);
  run(w, 0.5);
  assert.equal(w.goal, 1, 'into the left goal: a goal for seat 1');

  const v = playing();
  park(v);
  place(v, PITCH_W - 200, FLOOR - 60, 700, 0);
  run(v, 0.5);
  assert.equal(v.goal, 0, 'into the right goal: a goal for seat 0');

  const high = playing();
  park(high);
  place(high, 200, CROSSBAR_Y - 80, -600, -300);
  run(high, 0.6);
  assert.equal(high.goal, -1, 'over the bar is no goal');
});

test('no goal counts in the browser or while celebrating one', () => {
  for (const setup of [(w) => { w.predict = true; }, (w) => { w.phase = 'goal'; }]) {
    const w = playing();
    setup(w);
    park(w);
    place(w, 200, FLOOR - BALL_R, -800, 0);
    run(w, 0.5);
    assert.equal(w.goal, -1);
    assert.equal(w.events.filter((e) => e.type === 'goal').length, 0);
  }
});

test('players run, stop at the sides, and jump; a jump pressed in the air happens on landing', () => {
  const w = playing();
  park(w);
  setInput(w, 0, { right: true });
  run(w, 0.5);
  assert.ok(Math.abs(w.players[0].vx - RUN_SPEED) < 1e-9);
  setInput(w, 0, { left: true });
  run(w, 3);
  assert.equal(w.players[0].x, 22);
  setInput(w, 0, {});

  const p = w.players[1];
  setInput(w, 1, { jump: true });
  step(w, STEP);
  assert.equal(p.onGround, false);
  assert.ok(p.vy < -JUMP_SPEED * 0.9);
  setInput(w, 1, {});
  // A tap of jump just before landing.
  while (!(p.vy > 0 && p.y > FLOOR - 25)) step(w, STEP);
  assert.equal(p.onGround, false);
  setInput(w, 1, { jump: true });
  setInput(w, 1, {});
  let jumpedAgain = false;
  for (let i = 0; i < 40; i++) {
    const wasGround = p.onGround;
    step(w, STEP);
    if (wasGround && !p.onGround) jumpedAgain = true;
  }
  assert.ok(jumpedAgain, 'the buffered jump happened on landing');
});

test('a player can stand on a crossbar, and bumps a head on it from below', () => {
  const w = playing();
  const p = w.players[0];
  park(w);
  p.x = 40;
  p.y = CROSSBAR_Y - 60;
  p.onGround = false;
  run(w, 0.5);
  assert.equal(p.y, CROSSBAR_Y - BAR_R);
  assert.equal(p.onGround, true);

  const v = playing();
  const q = v.players[0];
  park(v);
  q.x = 30; // under the bar, in the goal
  setInput(v, 0, { jump: true });
  let top = Infinity;
  for (let i = 0; i < 40; i++) {
    step(v, STEP);
    top = Math.min(top, headOf(q).y - headRadius(q));
  }
  assert.ok(top >= CROSSBAR_Y + BAR_R - 1, `the head went up to ${top}`);
});

test('heads push apart side by side, and one landing on the other stands on it', () => {
  const w = playing();
  const [a, b] = w.players;
  a.x = 470;
  b.x = 490;
  place(w, 100, 100);
  step(w, STEP);
  assert.ok(b.x - a.x >= 2 * HEAD_R - 1e-6, `${b.x - a.x} apart`);

  const v = playing();
  const [c, d] = v.players;
  place(v, 100, 100);
  c.x = 480;
  d.x = 480;
  c.y = FLOOR - 120;
  c.onGround = false;
  run(v, 0.6);
  assert.ok(c.y < FLOOR - 50, 'standing on the other head');
  assert.equal(c.onGround, true);
});

test('a kick sends the ball towards the goal the kicker attacks, once per swing', () => {
  for (const seat of [0, 1]) {
    const w = playing();
    park(w);
    const p = w.players[seat];
    p.x = 480;
    const facing = seat ? -1 : 1;
    place(w, 480 + facing * 40, FLOOR - BALL_R);
    assert.equal(kick(w, seat), true);
    assert.equal(kick(w, seat), false, 'not again while swinging');
    step(w, STEP);
    step(w, STEP);
    assert.ok(facing * w.ball.vx > 500, `seat ${seat}: vx ${w.ball.vx}`);
    assert.ok(w.ball.vy < -100, 'and up');
    assert.equal(w.ball.lastTouch, seat);
    assert.equal(w.ball.kickBy, seat);
    assert.equal(w.events.filter((e) => e.type === 'kick').length, 1);
    run(w, KICK_TIME);
    assert.equal(p.kickT, -1);
    assert.equal(kick(w, seat), true, 'and again once the swing is done');
  }
});

test('a kick at a ball out of reach does nothing to it; the boot at rest is in front and low', () => {
  const w = playing();
  park(w);
  const p = w.players[0];
  const boot = bootOf(p);
  assert.ok(boot.x > p.x && boot.y > p.y - 20 && boot.y < p.y);
  place(w, p.x + 200, FLOOR - BALL_R);
  kick(w, 0);
  run(w, KICK_TIME);
  assert.equal(w.ball.vx, 0);
  assert.equal(w.ball.lastTouch, -1);
});

test('a ball dropped on a head bounces off it', () => {
  const w = playing();
  park(w);
  const head = headOf(w.players[0]);
  place(w, head.x + 5, head.y - 150, 0, 0);
  let touched = false;
  for (let i = 0; i < 60; i++) {
    step(w, STEP);
    if (w.ball.lastTouch === 0) { touched = true; break; }
  }
  assert.ok(touched);
  run(w, 0.05);
  assert.ok(w.ball.vy < 0, 'going up again');
});

test('a goal touched last by the keeper just after the other side kicked counts for the kicker', () => {
  const ball = { lastTouch: 1, kickBy: 0, kickAge: 0.5 };
  assert.deepEqual(scorerOf(ball, 0), { by: 0, own: false });
  assert.deepEqual(scorerOf({ ...ball, kickAge: 3 }, 0), { by: 1, own: true });
  assert.deepEqual(scorerOf({ lastTouch: 0, kickBy: 0, kickAge: 0.2 }, 0), { by: 0, own: false });
  assert.deepEqual(scorerOf({ lastTouch: -1, kickBy: -1, kickAge: 9 }, 1), { by: -1, own: false });
});

test('after a goal the ball is dropped towards the side that let it in', () => {
  const w = playing();
  setInput(w, 0, { right: true });
  w.players[1].bigT = 3;
  w.goal = 1;
  w.items.push({ id: 1, kind: 'fire', x: 1, y: 1, t: 0 });
  resetForKickoff(w, 0);
  assert.ok(w.ball.x < PITCH_W / 2);
  assert.equal(w.goal, -1);
  assert.deepEqual(w.items, []);
  assert.equal(w.players[1].bigT, 0);
  assert.equal(w.players[0].input.right, true, 'keys still held stay held');
  resetForKickoff(w, 1);
  assert.ok(w.ball.x > PITCH_W / 2);
});

// ---- power-ups ----

// A power-up floating right where the ball is, last touched by `seat`.
function takeWithBall(kind, seat = 0) {
  const w = playing();
  park(w);
  place(w, 480, 250);
  w.ball.lastTouch = seat;
  spawnItem(w, kind, 480, 250);
  step(w, STEP);
  assert.equal(w.items.length, 0, `${kind} taken`);
  const power = w.events.find((e) => e.type === 'power');
  assert.deepEqual([power.kind, power.seat], [kind, seat]);
  return w;
}

test('power-ups: the ball takes them for whoever touched it last', () => {
  let w = takeWithBall('bigHead');
  assert.equal(headRadius(w.players[0]), HEAD_R * BIG_HEAD_SCALE);
  w = takeWithBall('shrink');
  assert.equal(headRadius(w.players[1]), HEAD_R * SHRINK_SCALE);
  w = takeWithBall('speed', 1);
  setInput(w, 1, { left: true });
  run(w, 0.5);
  assert.ok(Math.abs(w.players[1].vx + RUN_SPEED * SPEED_SCALE) < 1e-9);
  w = takeWithBall('freeze');
  assert.equal(w.players[1].freezeT, FREEZE_TIME - STEP * 0); // set this step, ticks from the next
  assert.equal(kick(w, 1), false, 'frozen players cannot kick');
  setInput(w, 1, { left: true, jump: true });
  const x = w.players[1].x;
  run(w, 1);
  assert.equal(w.players[1].x, x, 'nor move');
  assert.equal(w.players[1].onGround, true, 'nor jump');
  run(w, FREEZE_TIME);
  assert.ok(w.players[1].x < x, 'until it thaws');
  w = takeWithBall('bigBall');
  assert.equal(ballRadius(w.ball), BALL_R * BIG_BALL_SCALE);
  w = takeWithBall('moonJump');
  setInput(w, 0, { jump: true });
  step(w, STEP);
  assert.ok(w.players[0].vy < -JUMP_SPEED * MOON_JUMP_SCALE * 0.95);
  w = takeWithBall('wall', 1);
  assert.ok(w.players[1].wallT > 0);
  w = takeWithBall('fire');
  assert.equal(w.players[0].fire, true);
});

test('power-ups: a player heading one takes it; one nobody takes fades away', () => {
  const w = playing();
  place(w, 100, 100);
  w.players[0].x = 300;
  const head = headOf(w.players[0]);
  spawnItem(w, 'speed', head.x, head.y - HEAD_R - 10);
  step(w, STEP);
  assert.ok(w.players[0].speedT > 0);

  const v = playing();
  park(v);
  place(v, 100, FLOOR - BALL_R);
  spawnItem(v, 'speed', 480, 200);
  run(v, ITEM_LIFE - 0.1);
  assert.equal(v.items.length, 1);
  run(v, 0.2);
  assert.equal(v.items.length, 0);
  // A ball nobody has touched takes nothing.
  const u = playing();
  park(u);
  place(u, 480, 250);
  spawnItem(u, 'speed', 480, 250);
  step(u, STEP);
  assert.equal(u.items.length, 1);
});

test('power-ups: timers run down only while the ball is in play', () => {
  const w = takeWithBall('bigHead');
  const left = w.players[0].bigT;
  w.phase = 'goal';
  run(w, 1);
  assert.equal(w.players[0].bigT, left);
  w.phase = 'playing';
  run(w, 1);
  assert.ok(Math.abs(w.players[0].bigT - (left - 1)) < 1e-6);
});

test('a fire shot flies flat and hard, flattens the rival in its way, and ends on the wall', () => {
  const w = takeWithBall('fire');
  const [a, b] = w.players;
  a.x = 300;
  b.x = 600;
  place(w, 340, FLOOR - BALL_R);
  w.ball.lastTouch = 0;
  kick(w, 0);
  run(w, 2 * STEP);
  assert.ok(w.ball.fireT > FIRE_TIME - 0.1);
  assert.equal(a.fire, false, 'used up');
  const y = w.ball.y;
  run(w, 0.15);
  assert.ok(Math.abs(w.ball.y - y) < 40, 'it does not drop');
  run(w, 0.5);
  assert.ok(b.flatT > 0 && b.flatT <= FLATTEN_TIME, 'the rival is flattened');
  assert.ok(w.events.some((e) => e.type === 'flatten' && e.seat === 1));
  assert.equal(kick(w, 1), false);
  run(w, 1);
  assert.equal(w.ball.fireT, 0, 'gone out on the wall or the grass');
});

test('a goal wall keeps the ball out of its goal until it runs out', () => {
  const w = takeWithBall('wall', 0);
  park(w);
  place(w, 200, FLOOR - 60, -800, 0);
  run(w, 0.6);
  assert.equal(w.goal, -1);
  assert.ok(w.ball.x > goalLineOf(0));
  assert.ok(w.events.some((e) => e.type === 'block'));
});

test('the browser takes no power-ups and flattens nobody', () => {
  const w = playing();
  w.predict = true;
  park(w);
  place(w, 480, 250);
  w.ball.lastTouch = 0;
  spawnItem(w, 'bigHead', 480, 250);
  step(w, STEP);
  assert.equal(w.items.length, 1);
  assert.equal(w.events.length, 0);
});

// ---- snapshots and prediction ----

test('a packed world unpacks into one that steps the same as the server', () => {
  const server = playing();
  server.players[0].x = 420;
  server.players[1].x = 560;
  setInput(server, 0, { right: true, jump: true });
  setInput(server, 1, { left: true });
  run(server, 0.4);
  const packed = JSON.parse(JSON.stringify(pack(server)));
  const browser = unpack(packed, true);
  assert.equal(browser.predict, true);
  assert.deepEqual(browser.events, []);
  // Twelve steps on, three snapshots' worth, with a kick in the middle.
  for (let i = 0; i < 12; i++) {
    if (i === 4) { kick(server, 0); kick(browser, 0); }
    step(server, STEP);
    step(browser, STEP);
  }
  for (const seat of [0, 1]) {
    assert.ok(Math.abs(server.players[seat].x - browser.players[seat].x) < 1, `player ${seat} x`);
    assert.ok(Math.abs(server.players[seat].y - browser.players[seat].y) < 1, `player ${seat} y`);
  }
  assert.ok(Math.hypot(server.ball.x - browser.ball.x, server.ball.y - browser.ball.y) < 3, 'the ball');
  // Packing does not share anything with the world it came from.
  packed.players[0].input.left = true;
  assert.equal(server.players[0].input.left, false);
});

test('the same world and inputs always come out the same', () => {
  const make = () => {
    const w = playing();
    setInput(w, 0, { right: true });
    setInput(w, 1, { left: true, jump: true });
    for (let i = 0; i < 300; i++) {
      if (i % 37 === 0) { kick(w, 0); kick(w, 1); }
      step(w, STEP);
    }
    return JSON.stringify(pack(w));
  };
  assert.equal(make(), make());
});

test('heads, boots and the ball line up as drawn', () => {
  const w = createWorld();
  const p = w.players[0];
  const head = headOf(p);
  assert.equal(head.y, FLOOR - NECK - HEAD_R);
  p.bigT = 1;
  assert.ok(headOf(p).y < head.y, 'a bigger head sits higher');
});
