// The power-ups, one by one, in the world on its own; and the server
// putting them into a match, or not.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIM_SPEED, COUNTDOWN_MS, FLOOR, GIANT_SPEED, ITEM_LIFE, POWER_UPS, SPRING_LIFE, SPRING_SPEED, STEADY_RATE,
  STEADY_TIME, STEP, SWORD_LEN, SWORD_SPEED,
} from '../shared/constants.js';
import { createWorld, lenOf, pack, press, spawnItem, step, unpack } from '../shared/sim.js';
import bladetoss from '../server/index.js';

const run = (w, seconds, held) => {
  for (let t = 0; t < seconds; t += STEP) step(w, STEP, held);
};
// A round under way on arena `map`, seat 0 on the left facing right and
// seat 1 on the right; both armed.
function playing(map = 0) {
  const w = createWorld(map, { rand: () => 0.25 });
  w.phase = 'playing';
  Object.assign(w.fighters[0], { x: 300, facing: 1, aimFrom: -100 });
  Object.assign(w.fighters[1], { x: 500, facing: -1, aimFrom: -100 });
  return w;
}
// Takes the sword from `seat` and lays it down at `x`.
function disarm(w, seat, x = 900) {
  const p = w.fighters[seat];
  Object.assign(w.swords[p.sword], { state: 'stuck', holder: -1, x, y: FLOOR - 4, ang: 0, on: 0 });
  p.sword = -1;
}
// The swing phase at which the sword points level, and at about 10° up.
const LEVEL = Math.asin(-16 / 56);
const SLIGHTLY_UP = Math.asin((10 - 16) / 56);

test('a power-up goes to whoever touches it first, and fades if nobody does', () => {
  const w = playing();
  disarm(w, 1);
  const near = spawnItem(w, 'laser', 360, FLOOR - 34); // in seat 0's way, at body height
  spawnItem(w, 'shield', 700, 150); // out of everyone's reach
  assert.deepEqual(w.items.map((i) => i.id), [near.id, near.id + 1]);
  run(w, 0.6);
  assert.equal(w.fighters[0].power, 'laser');
  assert.equal(w.items.length, 1);
  assert.ok(w.events.some((e) => e.type === 'power' && e.seat === 0 && e.kind === 'laser'));
  run(w, ITEM_LIFE);
  assert.equal(w.items.length, 0, 'the unreachable one faded');
  // Nothing fades while the round is counted down.
  const waiting = createWorld(0, { rand: () => 0.25 });
  spawnItem(waiting, 'giant', 480, 100);
  run(waiting, ITEM_LIFE + 1);
  assert.equal(waiting.items.length, 1);
  assert.equal(POWER_UPS.length, 8);
});

test('shield: turns one sword away, not two', () => {
  const w = playing();
  const [a, b] = w.fighters;
  disarm(w, 1);
  b.shield = true;
  a.aimPh = LEVEL;
  press(w, 0);
  run(w, 0.4);
  assert.equal(b.alive, true);
  assert.equal(b.shield, false);
  assert.ok(w.events.some((e) => e.type === 'shield' && e.seat === 1));
  assert.notEqual(w.swords[0].state, 'flying');
  // Armed again, it throws again: this time it hits.
  const sword = w.swords[0];
  Object.assign(sword, { state: 'held', holder: 0 });
  Object.assign(a, { sword: 0, aimPh: LEVEL, x: b.x - 200, facing: 1, noPick: -1 });
  press(w, 0);
  run(w, 0.4);
  assert.equal(b.alive, false);
});

test('triple blade: three swords, the two extra gone once they land', () => {
  const w = playing();
  const [a, b] = w.fighters;
  disarm(w, 1);
  b.x = 900;
  a.power = 'triple';
  a.aimPh = SLIGHTLY_UP;
  press(w, 0);
  assert.equal(a.power, '', 'used up');
  const flying = w.swords.filter((s) => s.state === 'flying');
  assert.equal(flying.length, 3);
  assert.equal(flying.filter((s) => s.temp).length, 2);
  assert.equal(new Set(flying.map((s) => s.group)).size, 1);
  run(w, 2);
  assert.deepEqual(w.swords.map((s) => s.state).sort(), ['gone', 'gone', 'stuck', 'stuck']);
  // The real one can be picked up; the gone ones never.
  assert.equal(w.swords.filter((s) => s.temp).every((s) => s.state === 'gone'), true);
});

test('triple blade: an extra sword kills like any other', () => {
  const w = playing();
  const [a, b] = w.fighters;
  disarm(w, 1);
  // Aimed so high that only the lower extra blade comes near.
  a.power = 'triple';
  Object.assign(b, { x: 430 });
  a.aimPh = Math.asin((2 + 10 - 16) / 56); // 12° up: the low extra flies at about 2°
  press(w, 0);
  run(w, 0.3);
  assert.equal(b.alive, false);
});

test('steady hand: the swing slows by half, for a while', () => {
  const w = playing();
  const p = w.fighters[0];
  p.steadyT = STEADY_TIME;
  const from = p.aimPh;
  run(w, 1);
  assert.ok(Math.abs(p.aimPh - from - AIM_SPEED * STEADY_RATE) < AIM_SPEED * 0.02);
  run(w, STEADY_TIME);
  assert.equal(p.steadyT, 0);
  const later = p.aimPh;
  run(w, 1);
  assert.ok(Math.abs(p.aimPh - later - AIM_SPEED) < AIM_SPEED * 0.02, 'and back to normal');
});

test('laser throw: dead straight, all the way across', () => {
  const w = playing();
  const [a, b] = w.fighters;
  disarm(w, 1);
  b.x = -1000;
  b.alive = false;
  a.x = 100;
  a.power = 'laser';
  a.aimPh = LEVEL;
  press(w, 0);
  const s = w.swords[0];
  const y = s.y;
  for (let i = 0; i < 80 && s.state === 'flying' && !s.bounces; i++) {
    step(w, STEP);
    if (!s.bounces) assert.ok(Math.abs(s.y - y) < 1e-6 && s.vy === 0);
  }
  assert.ok(w.events.some((e) => e.type === 'bounce'), 'it reached the far wall');
});

test('magnet: the nearest sword lying about flies to the empty hand', () => {
  const w = playing();
  const [a, b] = w.fighters;
  disarm(w, 0, 850); // seat 0's own, far away
  b.x = 200;
  a.power = 'magnet';
  run(w, 0.05);
  assert.equal(w.swords[0].state, 'homing');
  assert.equal(a.power, '');
  assert.ok(w.events.some((e) => e.type === 'magnet'));
  run(w, 1.2);
  assert.equal(a.sword, 0);
  assert.equal(w.swords[0].state, 'held');
  // Armed, it waits: nothing to call while both swords are in hand.
  const v = playing();
  v.fighters[0].power = 'magnet';
  run(v, 1);
  assert.equal(v.fighters[0].power, 'magnet');
});

test('boomerang: a throw that misses comes back to hand', () => {
  const w = playing();
  const [a, b] = w.fighters;
  disarm(w, 1, 700);
  Object.assign(b, { x: 900, facing: 1 });
  Object.assign(a, { x: 150, power: 'boomerang', aimPh: SLIGHTLY_UP });
  press(w, 0);
  const s = w.swords[0];
  assert.equal(s.boomerang, true);
  let turned = false;
  for (let i = 0; i < 150 && a.sword < 0; i++) {
    step(w, STEP);
    if (s.returning) turned = true;
  }
  assert.ok(turned);
  assert.equal(a.sword, 0, `caught: ${s.state} at ${Math.round(s.x)},${Math.round(s.y)}`);
  assert.equal(a.alive, true, 'and harmlessly');
  assert.ok(w.events.some((e) => e.type === 'catch' && e.seat === 0));
});

test('giant blade: twice as long, slower, and back to size when picked up', () => {
  const w = playing();
  const [a, b] = w.fighters;
  disarm(w, 1);
  a.power = 'giant';
  a.aimPh = LEVEL;
  press(w, 0);
  const s = w.swords[0];
  assert.equal(lenOf(s), SWORD_LEN * 2);
  assert.ok(Math.abs(Math.hypot(s.vx, s.vy) - SWORD_SPEED * GIANT_SPEED) < 1);
  run(w, 0.4);
  assert.equal(b.alive, false);
  // Giant while it lies there, normal again once someone takes it up.
  for (let i = 0; i < 200 && s.state !== 'stuck' && s.state !== 'held'; i++) step(w, STEP);
  if (s.state === 'stuck') {
    assert.equal(s.giant, true);
    Object.assign(a, { x: s.x - 60, facing: 1, noPick: -1, noPickT: 0 });
    run(w, 0.6);
  }
  assert.equal(a.sword, 0);
  assert.equal(s.giant, false);
  assert.equal(lenOf(s), SWORD_LEN);
});

test('spring pad: launches whoever runs over it, armed or not, until it wears out', () => {
  const w = playing();
  const [a] = w.fighters;
  spawnItem(w, 'spring', 340, FLOOR - 34);
  let launched = false;
  let top = FLOOR;
  for (let i = 0; i < 90; i++) {
    step(w, STEP);
    if (a.vy <= -SPRING_SPEED + 40) launched = true;
    top = Math.min(top, a.y);
  }
  assert.deepEqual(w.springs.map((sp) => sp.x), [340]);
  assert.ok(launched, 'launched');
  assert.ok(a.sword >= 0, 'with its sword still in hand');
  assert.ok(top < 200, `up to ${Math.round(top)}`);
  run(w, SPRING_LIFE);
  assert.equal(w.springs.length, 0);
});

test('the prediction agrees with the server about power-ups', () => {
  const server = playing();
  spawnItem(server, 'giant', 380, FLOOR - 34);
  server.fighters[1].shield = true;
  const browser = unpack(JSON.parse(JSON.stringify(pack(server))));
  for (let i = 0; i < 40; i++) { step(server, STEP); step(browser, STEP); }
  assert.equal(browser.fighters[0].power, 'giant');
  assert.equal(server.fighters[0].power, 'giant');
  assert.equal(browser.items.length, 0);
  assert.equal(browser.fighters[1].shield, true);
  assert.equal(browser.events.length, 0);
});

test('in a match, power-ups appear now and then, unless turned off', () => {
  const make = (powerUps) => {
    const m = bladetoss.createMatch({
      players: ['a', 'b'], options: { rounds: 7, powerUps }, map: 0, rand: Math.random, onChange: () => {},
    });
    clearInterval(m.timer);
    return m;
  };
  const on = make(true);
  on.advance(COUNTDOWN_MS);
  // Keep the fighters apart and unarmed so nobody is hit meanwhile.
  const spawned = [];
  for (let ms = 0; ms < 30_000 && on.phase === 'playing'; ms += 100) {
    on.world.swords.forEach((s) => { if (s.state === 'held') { s.state = 'stuck'; s.holder = -1; s.y = FLOOR - 4; } });
    on.world.fighters.forEach((p) => { p.sword = -1; });
    on.advance(100);
    for (const e of on.world.events) if (e.type === 'spawn' && !spawned.includes(e.id)) spawned.push(e.id);
  }
  assert.ok(spawned.length >= 2, `${spawned.length} in 30s`);
  for (const item of on.world.items) assert.ok(item.x > 26 && item.x < 934 && item.y > 16 && item.y < FLOOR);

  const off = make(false);
  off.advance(COUNTDOWN_MS);
  for (let ms = 0; ms < 20_000 && off.phase === 'playing'; ms += 100) off.advance(100);
  assert.equal(off.world.items.length, 0);
  assert.ok(!off.world.events.some((e) => e.type === 'spawn'));
});
