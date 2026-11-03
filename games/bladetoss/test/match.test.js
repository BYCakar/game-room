// Blade Toss on the server: the invitation options, a match stepped by hand,
// the bot, and matches through the real lobby.

import test from 'node:test';
import assert from 'node:assert/strict';
import bladetoss from '../server/index.js';
import { AIM_SPEED, COUNTDOWN_MS, FLOOR, MAX_LAG, ROUND_LIMIT_MS, ROUND_OVER_MS } from '../shared/constants.js';
import { MAPS } from '../shared/maps.js';
import { createBrain } from '../shared/bot.js';
import { startServer } from '../../../server/index.js';
import { connect } from '../../../test/helpers.js';

test('invitation options and bots', () => {
  assert.deepEqual(bladetoss.validateOptions({ rounds: 7, junk: 1 }), { options: { rounds: 7 } });
  for (const bad of [{}, { rounds: 2 }, { rounds: '7' }, { rounds: 9 }, null]) {
    assert.ok(bladetoss.validateOptions(bad).error, JSON.stringify(bad));
  }
  assert.deepEqual(bladetoss.validateBot({ level: 8 }), { bot: { level: 8 }, name: 'Computer level 8' });
  for (const bad of [{}, { level: 0 }, { level: 9 }, { level: 1.5 }]) assert.ok(bladetoss.validateBot(bad).error);
  assert.equal(bladetoss.meta.id, 'bladetoss');
});

// A match whose clock is stepped by the test rather than by a timer.
function newMatch(rounds = 7, map = 0) {
  const changes = [];
  const match = bladetoss.createMatch({
    players: ['red', 'blue'], options: { rounds }, map, rand: () => 0.25, onChange: (m) => changes.push(m.snapshot(0)),
  });
  clearInterval(match.timer);
  return { match, changes };
}

// Puts the fighters across open floor from each other, seat 0 on the left,
// and has seat 1 lay its sword down out of the way.
function faceOff(match) {
  const [a, b] = match.world.fighters;
  // Swings are set by hand below, so any phase counts as seen since pickup.
  Object.assign(a, { x: 300, facing: 1, aimFrom: -100 });
  Object.assign(b, { x: 500, facing: -1, aimFrom: -100 });
  Object.assign(match.world.swords[b.sword], { state: 'stuck', holder: -1, x: 900, y: FLOOR - 4, ang: 0 });
  b.sword = -1;
}
// The swing phase at which the sword points level, which hits from close by.
const FLAT = Math.asin(-((-40 + 72) / 2) / ((72 + 40) / 2));

function winRound(match, seat = 0) {
  match.advance(COUNTDOWN_MS);
  assert.equal(match.phase, 'playing');
  faceOff(match);
  if (seat === 1) {
    // Swap who is where.
    const [a, b] = match.world.fighters;
    [a.x, b.x] = [b.x, a.x];
    [a.facing, b.facing] = [b.facing, a.facing];
    [a.sword, b.sword] = [b.sword, a.sword];
    match.world.swords.forEach((s) => { if (s.state === 'held') s.holder = 1; });
  }
  const p = match.world.fighters[seat];
  p.aimPh = FLAT;
  p.aimFrom = FLAT - 10;
  match.handle(seat, { action: 'press', ph: FLAT });
  match.advance(400);
  match.advance(ROUND_OVER_MS);
}

test('a round: countdown, a throw, the score, the next round', () => {
  const { match, changes } = newMatch();
  assert.equal(match.phase, 'countdown');
  assert.equal(match.snapshot(null).map, 0);
  // Nothing is thrown before the round starts.
  match.handle(0, { action: 'press' });
  assert.equal(match.world.swords[0].state, 'held');
  assert.match(match.handle(0, { action: 'dance' }), /Unknown/);
  match.advance(COUNTDOWN_MS - 20);
  assert.equal(match.phase, 'countdown');
  match.advance(20);
  assert.equal(match.phase, 'playing');

  faceOff(match);
  const before = changes.length;
  match.world.fighters[0].aimPh = FLAT;
  match.handle(0, { action: 'press', seq: 3, ph: FLAT });
  assert.equal(changes.length, before + 1, 'a throw is sent at once');
  assert.equal(match.world.swords[0].state, 'flying');
  assert.equal(match.snapshot(0).acks[0], 3);
  match.advance(400);
  assert.equal(match.phase, 'roundOver');
  assert.deepEqual(match.rounds, [], 'a double knock-out is still possible for a moment');
  match.advance(400);
  assert.deepEqual(match.rounds, [{ winner: 0, reason: 'hit' }]);
  assert.deepEqual(changes.at(-1).score, [1, 0]);
  assert.deepEqual(bladetoss.preview(match.snapshot(null)), { map: 0, score: [1, 0] });
  const snap = match.snapshot(null);
  assert.equal(snap.you, null);
  assert.ok(snap.world.events.some((e) => e.type === 'hit'));
  assert.ok(JSON.stringify(snap).length < 4000, 'snapshots stay small');

  match.advance(ROUND_OVER_MS);
  assert.equal(match.phase, 'countdown');
  assert.deepEqual(match.world.fighters.map((p) => p.alive), [true, true]);
  assert.deepEqual(match.world.fighters.map((p) => p.sword), [0, 1], 'everyone is armed again');
});

test('best of seven: first to four, and the last hit is seen out before the end', () => {
  const { match, changes } = newMatch(7);
  for (let i = 0; i < 3; i++) winRound(match, 0);
  for (let i = 0; i < 3; i++) winRound(match, 1);
  assert.deepEqual(match.score, [3, 3]);
  assert.equal(match.over, null);
  match.advance(COUNTDOWN_MS);
  faceOff(match);
  match.world.fighters[0].aimPh = FLAT;
  match.handle(0, { action: 'press', ph: FLAT });
  match.advance(800);
  assert.deepEqual(match.score, [4, 3]);
  assert.equal(match.over, null, 'the final hit plays out first');
  match.advance(ROUND_OVER_MS);
  assert.deepEqual(match.over, { reason: 'rounds', winner: 0, score: [4, 3] });
  assert.deepEqual(changes.at(-1).over, match.over);
  assert.equal(match.rounds.length, 7);
});

test('a throw is taken at the angle the player saw, but not one long gone', () => {
  const { match } = newMatch();
  match.advance(COUNTDOWN_MS);
  match.advance(1000);
  const p = match.world.fighters[0];
  const now = p.aimPh;
  // Seen 0.1s ago: honoured.
  match.handle(0, { action: 'press', ph: now - AIM_SPEED * 0.1 });
  const s = match.world.swords[0];
  // The angle above the horizontal at swing phase `ph`: 16° ± 56°.
  const angleOf = (ph) => (16 + 56 * Math.sin(ph)) * Math.PI / 180;
  assert.ok(Math.abs(Math.atan2(-s.vy, s.vx * p.facing) - angleOf(now - AIM_SPEED * 0.1)) < 0.02);

  const { match: other } = newMatch();
  other.advance(COUNTDOWN_MS);
  other.advance(1000);
  const q = other.world.fighters[0];
  const at = q.aimPh;
  // From a whole second ago: only MAX_LAG of it counts.
  other.handle(0, { action: 'press', ph: at - AIM_SPEED });
  const t = other.world.swords[0];
  assert.ok(Math.abs(Math.atan2(-t.vy, t.vx * q.facing) - angleOf(at - AIM_SPEED * MAX_LAG)) < 0.02);
  // Junk is the angle as it is now.
  const { match: third } = newMatch();
  third.advance(COUNTDOWN_MS + 500);
  const r = third.world.fighters[0];
  const was = r.aimPh;
  third.handle(0, { action: 'press', ph: 'soon' });
  assert.ok(Math.abs(Math.atan2(-third.world.swords[0].vy, third.world.swords[0].vx * r.facing) - angleOf(was)) < 0.02);
});

test('rounds nobody takes, the round limit, resigning, a player away', () => {
  const { match } = newMatch(3);
  for (let i = 0; i < 6; i++) {
    match.advance(COUNTDOWN_MS);
    match.roundMsLeft = 30;
    match.advance(50);
    assert.equal(match.rounds.at(-1).reason, 'time');
    match.advance(ROUND_OVER_MS);
  }
  assert.deepEqual(match.over, { reason: 'limit', winner: null, score: [0, 0] });
  assert.ok(ROUND_LIMIT_MS >= 30_000);

  const quitter = newMatch().match;
  quitter.handle(1, { action: 'resign' });
  assert.deepEqual(quitter.over, { reason: 'resign', winner: 0, score: [0, 0] });

  const { match: away } = newMatch();
  away.advance(COUNTDOWN_MS);
  away.handle(0, { action: 'press' });
  const s = away.world.swords[0];
  away.setConnected(1, false);
  assert.equal(away.snapshot(0).paused, true);
  const where = s.x;
  away.advance(5000);
  assert.equal(s.x, where, 'the sword waits too');
  away.setConnected(1, true);
  assert.equal(away.phase, 'countdown');
  away.advance(COUNTDOWN_MS);
  away.advance(100);
  assert.notEqual(s.x, where);
  away.abandon(1);
  assert.deepEqual(away.over, { reason: 'abandoned', winner: 0, score: [0, 0] });
});

test('a new arena for each match', () => {
  const seen = new Set();
  let last = null;
  for (let i = 0; i < 20; i++) {
    const m = bladetoss.createMatch({ players: ['a', 'b'], options: { rounds: 3 }, onChange: () => {} });
    clearInterval(m.timer);
    assert.notEqual(m.map, last, 'never the same twice running');
    last = m.map;
    seen.add(m.map);
  }
  assert.ok(seen.size >= 3, `${seen.size} arenas in 20 matches`);
  assert.ok(MAPS.length >= 5);
});

test('bots play whole matches on every arena', () => {
  for (let map = 0; map < MAPS.length; map++) {
    const { match } = newMatch(7, map);
    const brains = [createBrain(8, () => 0.5), createBrain(4)];
    let ms = 0;
    while (!match.over && ms < 600_000) {
      for (const seat of [0, 1]) {
        const press = brains[seat].decide(match.world, seat, 0.05);
        if (press) match.handle(seat, { action: 'press', ph: press.ph });
      }
      match.advance(50);
      ms += 50;
    }
    assert.ok(match.over, `${MAPS[map].name}: no result after ${ms / 1000}s`);
    assert.equal(match.over.reason, 'rounds');
    assert.ok(Math.max(...match.score) === 4);
  }
});

async function joined(server, ...names) {
  const clients = names.map(() => connect(server.port));
  await Promise.all(clients.map((c) => c.opened));
  clients.forEach((c, i) => c.send({ type: 'join', name: names[i] }));
  await Promise.all(clients.map((c) => c.next('joined')));
  return clients;
}

test('a match through the lobby', async (t) => {
  const server = await startServer({ port: 0 });
  t.after(() => server.close());
  const [alice, bob] = await joined(server, 'alice', 'bob');
  await alice.next('users', (m) => m.users.length === 2);
  alice.send({ type: 'invite', to: 'bob', game: 'bladetoss', options: { rounds: 5 } });
  const invite = await bob.next('invite');
  bob.send({ type: 'accept', id: invite.id });
  const [first] = await Promise.all([alice.next('match'), bob.next('match')]);
  assert.equal(first.snapshot.phase, 'countdown');
  assert.equal(first.snapshot.world.fighters.length, 2);
  await alice.next('match', (m) => m.snapshot.phase === 'playing');
  const seat = first.snapshot.you;
  alice.send({ type: 'action', action: 'press', seq: 1 });
  const thrown = await alice.next('match', (m) => m.snapshot.world.swords[seat].state !== 'held');
  assert.equal(thrown.snapshot.acks[seat], 1);
  alice.send({ type: 'action', action: 'resign' });
  const last = await alice.next('match', (m) => m.snapshot.over);
  assert.equal(last.snapshot.over.reason, 'resign');
  assert.equal((await fetch(`http://localhost:${server.port}/games/bladetoss/server/match.js`)).status, 404);
  assert.equal((await fetch(`http://localhost:${server.port}/games/bladetoss/shared/sim.js`)).status, 200);
  assert.equal((await fetch(`http://localhost:${server.port}/games/bladetoss/client/index.js`)).status, 200);
});

test('a match against the computer through the lobby', async (t) => {
  const server = await startServer({ port: 0 });
  t.after(() => server.close());
  const [carol] = await joined(server, 'carol');
  carol.send({ type: 'bot', game: 'bladetoss', options: { rounds: 3 }, bot: { level: 2 }, seat: 0 });
  const { snapshot } = await carol.next('match');
  assert.deepEqual([snapshot.you, snapshot.bots, snapshot.players[1]], [0, [null, { level: 2 }], 'Computer level 2']);
  await carol.next('match', (m) => m.snapshot.phase === 'playing');
  // The bot's seat throws as told; the player's sword stays put.
  carol.send({ type: 'action', action: 'press', bot: true });
  const after = await carol.next('match', (m) => m.snapshot.world.swords[1].state !== 'held');
  assert.equal(after.snapshot.world.swords[0].state, 'held');
  carol.send({ type: 'action', action: 'resign' });
  assert.equal((await carol.next('match', (m) => m.snapshot.over)).snapshot.over.winner, 1);
});
