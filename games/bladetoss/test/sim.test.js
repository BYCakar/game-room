// The world on its own: throws at every angle end up somewhere they can be
// picked up, walls and ceiling hold swords and let them go, fighters cling
// and kick off walls, and the browser's prediction agrees with the server.

import test from 'node:test';
import assert from 'node:assert/strict';
import { AIM_SPEED, FLOOR, STEP, WALL_HOLD } from '../shared/constants.js';
import { MAPS } from '../shared/maps.js';
import { createWorld, geometry, pack, press, step, unpack } from '../shared/sim.js';

const fixed = () => 0.25;
const run = (w, seconds, held) => {
  for (let t = 0; t < seconds; t += STEP) step(w, STEP, held);
};
function playing(map = 0) {
  const w = createWorld(map, { rand: fixed });
  w.phase = 'playing';
  return w;
}
// Takes the sword out of seat 0's hands and lays it far away.
function disarm(w, seat = 0) {
  const p = w.fighters[seat];
  Object.assign(w.swords[p.sword], { state: 'stuck', holder: -1, x: 480, y: FLOOR - 4, ang: 0 });
  p.sword = -1;
}

test('every throw, from the floor and from a ledge, lands where it can be picked up', () => {
  for (let map = 0; map < MAPS.length; map++) {
    for (let k = 0; k < 24; k++) {
      const w = playing(map);
      const p = w.fighters[0];
      w.fighters[1].alive = false; // nobody to hit: only where the sword ends up matters
      w.fighters[1].x = -1000;
      if (k % 2) {
        const [x1, x2, y] = MAPS[map].plats[0];
        Object.assign(p, { x: (x1 + x2) / 2, y });
      }
      assert.ok(press(w, 0, -Math.PI / 2 + (k / 24) * Math.PI));
      const s = w.swords[0];
      assert.equal(s.state, 'flying');
      run(w, 6);
      const ok = (s.state === 'stuck' || s.state === 'held') && s.y <= FLOOR && s.y > 0;
      assert.ok(ok, `${MAPS[map].name}, throw ${k}: ${s.state} at ${Math.round(s.x)},${Math.round(s.y)}`);
    }
  }
});

test('a sword in a wall falls out after a while; one in the floor stays', () => {
  for (const side of [-1, 1]) {
    for (let y = 60; y <= 460; y += 40) {
      for (const vy of [-500, 0, 400, 900]) {
        const w = playing();
        const geo = geometry(w);
        w.fighters.forEach((p) => { p.alive = false; p.x = 480; });
        const s = w.swords[0];
        w.fighters[0].sword = -1;
        Object.assign(s, {
          state: 'flying', holder: -1, thrower: -1, flyT: 1,
          x: side < 0 ? geo.wl + 30 : geo.wr - 30, y, vx: side * 300, vy, ang: Math.atan2(vy, side * 300),
        });
        run(w, 0.3);
        if (s.state === 'stuck' && s.dropT > 0) {
          run(w, WALL_HOLD);
          assert.notEqual(s.dropT > 0 && s.state === 'stuck', true);
        }
        run(w, 4);
        assert.equal(s.state, 'stuck', `side ${side}, y ${y}, vy ${vy}`);
        assert.ok(s.y <= FLOOR && s.x > geo.wl && s.x < geo.wr, `side ${side}, y ${y}, vy ${vy}: ${s.x},${s.y}`);
      }
    }
  }
});

test('a throw that hits takes the round; the thrower is safe from its own sword at first', () => {
  const w = playing();
  const [a, b] = w.fighters;
  Object.assign(a, { x: 300, facing: 1 });
  Object.assign(b, { x: 500, facing: -1 });
  // Level, straight at the other fighter's middle: phase where the angle is ~0.
  const flat = Math.asin(-((-40 + 72) / 2) / ((72 + 40) / 2));
  b.sword = -1; // so its own sword does not meet ours in the air
  w.swords[1].state = 'stuck';
  w.swords[1].x = 900;
  w.swords[1].y = FLOOR - 4;
  press(w, 0, flat);
  run(w, 0.4);
  assert.equal(b.alive, false);
  assert.equal(a.alive, true);
  assert.ok(w.killT >= 0);
  assert.ok(w.events.some((e) => e.type === 'hit' && e.seat === 1 && e.by === 0));
});

test('jumping only empty-handed; clinging to a wall and leaping off it', () => {
  const w = playing();
  const p = w.fighters[0];
  press(w, 0); // armed: this throws
  assert.equal(p.sword, -1);
  assert.equal(p.onGround, true);
  run(w, 0.1);
  press(w, 0);
  assert.ok(p.vy < 0, 'empty-handed, it jumps');

  // Held on the way into a wall: it clings, slides slowly, and leaps when let go.
  const v = playing();
  disarm(v);
  const q = v.fighters[0];
  Object.assign(q, { x: 70, facing: -1 });
  press(v, 0);
  let clung = 0;
  for (let i = 0; i < 40; i++) { step(v, STEP, [true, false]); if (q.cling) clung++; }
  assert.ok(clung > 10, 'clings while the button is held');
  assert.ok(q.vy <= 65 && q.vy >= 0, 'and slides slowly');
  step(v, STEP, [false, false]);
  assert.equal(q.cling, false);
  assert.ok(q.vy < -600, 'letting go leaps off');
  assert.equal(q.facing, 1, 'away from the wall');

  // A quick press as it touches the wall kicks straight back off.
  const u = playing();
  disarm(u);
  const r = u.fighters[0];
  Object.assign(r, { x: 90, facing: -1 });
  press(u, 0);
  let kicked = false;
  for (let i = 0; i < 60 && !kicked; i++) {
    step(u, STEP);
    if (r.wallT > 0) { press(u, 0); kicked = true; }
  }
  assert.ok(kicked);
  assert.ok(r.vy < -600 && r.facing === 1);
});

test('running over a sword picks it up, one at a time, but not the one just thrown', () => {
  const w = playing();
  const [p] = w.fighters;
  Object.assign(p, { x: 400, facing: 1 });
  press(w, 0, -Math.PI / 2); // as low as it goes: the sword lands at its feet
  run(w, 0.3);
  assert.equal(p.sword, -1, 'not straight back into the hand');
  // Another sword ahead: running into it takes it up.
  Object.assign(w.swords[1], { state: 'stuck', holder: -1, x: p.x + 60, y: FLOOR - 4, ang: 0 });
  w.fighters[1].sword = -1;
  run(w, 0.5);
  assert.equal(p.sword, 1);
  assert.equal(w.swords[1].holder, 0);
});

test('the browser\'s prediction follows the server step for step', () => {
  const server = playing(3);
  run(server, 0.5);
  press(server, 1, server.fighters[1].aimPh);
  const browser = unpack(JSON.parse(JSON.stringify(pack(server))));
  for (let i = 0; i < 20; i++) {
    step(server, STEP);
    step(browser, STEP);
  }
  const a = pack(server);
  const b = pack(browser);
  for (const key of ['fighters', 'swords']) {
    a[key].forEach((x, i) => {
      for (const field of ['x', 'y', 'state', 'aimPh']) {
        const same = typeof x[field] === 'number' ? Math.abs(x[field] - b[key][i][field]) < 0.5 : x[field] === b[key][i][field];
        assert.ok(same, `${key}[${i}].${field}: ${x[field]} / ${b[key][i][field]}`);
      }
    });
  }
  assert.equal(browser.events.length, 0, 'the browser records no events');
  assert.ok(AIM_SPEED > 0);
});
