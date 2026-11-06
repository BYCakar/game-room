// KickMyBalls on the server: the invitation options, a match stepped by
// hand, and matches through the real lobby.

import test from 'node:test';
import assert from 'node:assert/strict';
import kickmyballs from '../server/index.js';
import { BALL_R, COUNTDOWN_MS, FLOOR, GOAL_MS, GOAL_W, ITEM_EVERY_MS, ITEM_FIRST_MS, PITCH_W } from '../shared/constants.js';
import { startServer } from '../../../server/index.js';
import { connect } from '../../../test/helpers.js';

test('invitation options and bots', () => {
  assert.deepEqual(kickmyballs.validateOptions({ length: 90, junk: 1 }), { options: { length: 90, powerUps: true } });
  assert.deepEqual(kickmyballs.validateOptions({ length: 60, powerUps: false }), { options: { length: 60, powerUps: false } });
  assert.deepEqual(kickmyballs.validateOptions({ length: 120, powerUps: true }), { options: { length: 120, powerUps: true } });
  for (const bad of [{}, { length: 30 }, { length: '90' }, { length: 90.5 }, null, undefined, 'x', { length: 90, powerUps: 'yes' }]) {
    assert.ok(kickmyballs.validateOptions(bad).error, JSON.stringify(bad));
  }
  assert.deepEqual(kickmyballs.validateBot({ level: 8, junk: 1 }), { bot: { level: 8 }, name: 'Computer level 8' });
  assert.deepEqual(kickmyballs.validateBot({ level: 1 }), { bot: { level: 1 }, name: 'Computer level 1' });
  for (const bad of [{}, { level: 0 }, { level: 9 }, { level: 1.5 }, { level: '3' }, null]) assert.ok(kickmyballs.validateBot(bad).error);
  assert.equal(kickmyballs.meta.id, 'kickmyballs');
  assert.equal(kickmyballs.meta.players, 2);
});

// A match whose clock is stepped by the test rather than by a timer.
function newMatch({ length = 60, powerUps = false, bots, rand = () => 0.5 } = {}) {
  const changes = [];
  const match = kickmyballs.createMatch({
    players: ['red', 'blue'], options: { length, powerUps }, bots, rand, onChange: (m) => changes.push(m.snapshot(0)),
  });
  clearInterval(match.timer);
  return { match, changes };
}

// Steps the match a sixtieth of a second at a time until `done`, at most `ms`.
function until(match, done, ms = 5000) {
  for (let t = 0; t < ms && !done(); t += 1000 / 60) match.advance(1000 / 60);
  assert.ok(done(), 'it happened in time');
}

// Sends the ball rolling into the goal of `conceding`.
function shootInto(match, conceding) {
  const w = match.world;
  w.players[0].x = 300;
  w.players[1].x = PITCH_W - 300;
  const dir = conceding ? 1 : -1;
  Object.assign(w.ball, { x: conceding ? PITCH_W - 160 : 160, y: FLOOR - BALL_R - 30, vx: dir * 800, vy: 0 });
}

test('countdown, kick-off, and a clock that only runs while the ball is in play', () => {
  const { match, changes } = newMatch();
  assert.equal(match.phase, 'countdown');
  assert.equal(match.clockMs, 60_000);
  match.advance(COUNTDOWN_MS - 20);
  assert.equal(match.phase, 'countdown');
  assert.equal(match.clockMs, 60_000);
  match.advance(20);
  assert.equal(match.phase, 'playing');
  match.advance(1000);
  assert.ok(Math.abs(match.clockMs - 59_000) < 20, String(match.clockMs));
  assert.ok(changes.length >= 2);
  assert.equal(match.timer.hasRef(), false, 'the timer never keeps the process alive');
});

test('a goal: the score, the celebration, and the next kick-off', () => {
  const { match } = newMatch();
  match.advance(COUNTDOWN_MS);
  shootInto(match, 1);
  until(match, () => match.phase === 'goal');
  assert.deepEqual(match.score, [1, 0]);
  assert.equal(match.goals.length, 1);
  assert.equal(match.goals[0].seat, 0);
  const clock = match.clockMs;
  match.advance(GOAL_MS - 100);
  assert.equal(match.phase, 'goal');
  assert.equal(match.clockMs, clock, 'the clock stops for a goal');
  match.advance(150);
  assert.equal(match.phase, 'countdown');
  // The side that let it in gets the ball dropped nearer to them.
  assert.ok(match.world.ball.x > PITCH_W / 2);
  assert.equal(match.world.goal, -1);
  match.advance(COUNTDOWN_MS);
  assert.equal(match.phase, 'playing');
  shootInto(match, 0);
  match.advance(500);
  assert.deepEqual(match.score, [1, 1]);
  assert.equal(match.snapshot(null).moves.length, 2);
});

test('full time: the side ahead wins, level is a draw', () => {
  const { match, changes } = newMatch({ length: 60 });
  match.advance(COUNTDOWN_MS);
  shootInto(match, 1);
  match.advance(300);
  match.advance(GOAL_MS + COUNTDOWN_MS);
  for (let i = 0; i < 70 && !match.over; i++) {
    // Keep the ball out of the goals by holding it still in the middle.
    Object.assign(match.world.ball, { x: PITCH_W / 2, y: 100, vx: 0, vy: 0 });
    match.advance(1000);
  }
  assert.deepEqual(match.over, { reason: 'time', winner: 0, score: [1, 0] });
  assert.equal(changes.at(-1).over.reason, 'time');
  assert.deepEqual(match.goals.at(-1), { fullTime: true });
  // Nothing happens once it is over.
  const at = changes.length;
  match.advance(1000);
  assert.equal(changes.length, at);
  assert.equal(match.handle(0, { action: 'input', right: true }), null);
  assert.match(match.handle(0, { action: 'resign' }), /over/);

  const draw = newMatch({ length: 60 }).match;
  draw.advance(COUNTDOWN_MS);
  for (let i = 0; i < 70 && !draw.over; i++) {
    Object.assign(draw.world.ball, { x: PITCH_W / 2, y: 100, vx: 0, vy: 0 });
    draw.advance(1000);
  }
  assert.deepEqual(draw.over, { reason: 'time', winner: null, score: [0, 0] });
  // A goalless draw played out is still a match worth keeping.
  assert.equal(draw.snapshot(null).moves.length, 1);
});

test('a goal with the last kick counts, and its celebration is seen out first', () => {
  const { match } = newMatch({ length: 60 });
  match.advance(COUNTDOWN_MS);
  // One step left, and the ball about to cross the line.
  match.clockMs = 1000 / 60;
  shootInto(match, 0);
  Object.assign(match.world.ball, { x: GOAL_W + 4 });
  match.advance(1000 / 60);
  assert.equal(match.phase, 'goal');
  assert.equal(match.clockMs, 0);
  assert.equal(match.over, null);
  match.advance(GOAL_MS - 100);
  assert.equal(match.over, null);
  match.advance(150);
  assert.deepEqual(match.over, { reason: 'time', winner: 1, score: [0, 1] });
});

test('resigning, leaving, and refused or unknown actions', () => {
  const { match, changes } = newMatch();
  assert.match(match.handle(0, { action: 'dance' }), /Unknown/);
  assert.equal(match.handle(1, { action: 'resign' }), null);
  assert.deepEqual(match.over, { reason: 'resign', winner: 0, score: [0, 0] });
  assert.equal(changes.at(-1).over.reason, 'resign');
  // Ended before anything happened: nothing to keep.
  assert.equal(match.snapshot(null).moves.length, 0);

  const gone = newMatch().match;
  gone.abandon(0);
  assert.deepEqual(gone.over, { reason: 'abandoned', winner: 1, score: [0, 0] });
});

test('inputs: only booleans are taken, kicks wait for kick-off, and each is acknowledged', () => {
  const { match } = newMatch();
  match.handle(0, { action: 'input', seq: 3, left: 'yes', right: true, jump: 1, extra: 9 });
  assert.deepEqual(match.world.players[0].input, { left: false, right: true, jump: false });
  assert.equal(match.acks[0], 3);
  match.handle(0, { action: 'kick', seq: 2 });
  assert.equal(match.acks[0], 3, 'an older seq does not go back');
  assert.equal(match.world.players[0].kickT, -1, 'no kicking before kick-off');
  match.advance(COUNTDOWN_MS);
  match.handle(1, { action: 'kick', seq: 'x' });
  assert.equal(match.world.players[1].kickT, 0);
  assert.equal(match.acks[1], 0);
});

test('a player away pauses the match, which restarts with a countdown', () => {
  const { match } = newMatch();
  match.advance(COUNTDOWN_MS);
  match.handle(1, { action: 'input', left: true });
  match.advance(500);
  const clock = match.clockMs;
  match.setConnected(1, false);
  assert.equal(match.snapshot(0).paused, true);
  assert.equal(match.phase, 'countdown');
  assert.equal(match.world.players[1].input.left, false, 'its keys are let go of');
  const x = match.world.players[1].x;
  match.advance(5000);
  assert.equal(match.clockMs, clock);
  assert.equal(match.world.players[1].x, x);
  match.handle(0, { action: 'kick' });
  assert.equal(match.world.players[0].kickT, -1, 'nor any kicking');
  match.setConnected(1, true);
  match.advance(COUNTDOWN_MS - 50);
  assert.equal(match.phase, 'countdown');
  match.advance(50);
  assert.equal(match.phase, 'playing');
});

test('snapshots: everything to draw the match, the same for spectators, and a small preview', () => {
  const bots = [null, { level: 4 }];
  const { match } = newMatch({ bots });
  const mine = match.snapshot(0);
  for (const key of ['id', 'players', 'you', 'options', 'over', 'bots', 'moves', 'world', 'score', 'clockMs', 'phase', 'acks']) {
    assert.ok(key in mine, key);
  }
  assert.deepEqual(mine.bots, bots);
  assert.equal(mine.you, 0);
  const spectator = match.snapshot(null);
  assert.equal(spectator.you, null);
  assert.deepEqual({ ...spectator, you: 0 }, mine);
  assert.deepEqual(JSON.parse(JSON.stringify(mine)), mine, 'plain JSON');
  assert.deepEqual(kickmyballs.preview(spectator), { score: [0, 0] });
  match.setSpectators(3);
  assert.equal(match.snapshot(1).spectators, 3);
  // Every match has its own id, so that a rematch is told apart.
  assert.notEqual(newMatch().match.id, match.id);
});

test('power-ups come one at a time while playing, and not at all when switched off', () => {
  const on = newMatch({ powerUps: true, rand: () => 0 }).match;
  on.advance(COUNTDOWN_MS);
  // Keep the ball and the players well away from where items appear.
  const hold = () => Object.assign(on.world.ball, { x: PITCH_W / 2, y: FLOOR - BALL_R, vx: 0, vy: 0 });
  for (let t = 0; t < ITEM_FIRST_MS[0] + 200; t += 100) { hold(); on.advance(100); }
  assert.equal(on.world.items.length, 1);
  for (let t = 0; t < ITEM_EVERY_MS[1]; t += 100) { hold(); on.advance(100); }
  assert.equal(on.world.items.length, 1, 'never two at once');
  assert.equal(on.world.items[0].kind, 'bigHead');

  const off = newMatch({ powerUps: false }).match;
  off.advance(COUNTDOWN_MS);
  for (let t = 0; t < 20_000; t += 500) {
    Object.assign(off.world.ball, { x: PITCH_W / 2, y: FLOOR - BALL_R, vx: 0, vy: 0 });
    off.advance(500);
  }
  assert.equal(off.world.items.length, 0);
  // Matches set up before power-ups had a switch have them.
  const old = kickmyballs.createMatch({ players: ['a', 'b'], options: { length: 60 }, onChange() {} });
  clearInterval(old.timer);
  assert.equal(old.powerUps, true);
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
  alice.send({ type: 'invite', to: 'bob', game: 'kickmyballs', options: { length: 60 } });
  const invite = await bob.next('invite');
  bob.send({ type: 'accept', id: invite.id });
  const [first] = await Promise.all([alice.next('match'), bob.next('match')]);
  assert.equal(first.snapshot.phase, 'countdown');
  assert.deepEqual(first.snapshot.options, { length: 60, powerUps: true });
  assert.equal(first.snapshot.world.players.length, 2);
  await alice.next('match', (m) => m.snapshot.phase === 'playing');
  const seat = first.snapshot.you;
  const facing = seat ? -1 : 1;
  alice.send({ type: 'action', action: 'input', seq: 1, left: seat === 1, right: seat === 0, jump: false });
  const moved = await alice.next('match', (m) => facing * m.snapshot.world.players[seat].vx > 0);
  assert.equal(moved.snapshot.acks[seat], 1);
  alice.send({ type: 'action', action: 'kick', seq: 2 });
  await alice.next('match', (m) => m.snapshot.acks[seat] === 2);
  alice.send({ type: 'action', action: 'resign' });
  const last = await alice.next('match', (m) => m.snapshot.over);
  assert.equal(last.snapshot.over.reason, 'resign');
  assert.equal(last.snapshot.over.winner, 1 - seat);
  assert.equal((await fetch(`http://localhost:${server.port}/games/kickmyballs/server/match.js`)).status, 404);
  assert.equal((await fetch(`http://localhost:${server.port}/games/kickmyballs/server/index.js`)).status, 404);
  for (const file of ['shared/sim.js', 'shared/constants.js', 'shared/bot.js', 'client/index.js', 'client/arena.js', 'client/bot.js', 'client/kickmyballs.css', 'meta.js']) {
    assert.equal((await fetch(`http://localhost:${server.port}/games/kickmyballs/${file}`)).status, 200, file);
  }
});

test('a match against the computer through the lobby', async (t) => {
  const server = await startServer({ port: 0 });
  t.after(() => server.close());
  const [carol] = await joined(server, 'carol');
  carol.send({ type: 'bot', game: 'kickmyballs', options: { length: 90, powerUps: false }, bot: { level: 5 }, seat: 0 });
  const { snapshot } = await carol.next('match');
  assert.deepEqual([snapshot.you, snapshot.bots, snapshot.players[1]], [0, [null, { level: 5 }], 'Computer level 5']);
  await carol.next('match', (m) => m.snapshot.phase === 'playing');
  // The bot's seat moves as told; the player stays put.
  carol.send({ type: 'action', action: 'input', left: true, bot: true });
  const after = await carol.next('match', (m) => m.snapshot.world.players[1].vx < 0);
  assert.equal(after.snapshot.world.players[0].vx, 0);
  assert.deepEqual(after.snapshot.world.players[1].input, { left: true, right: false, jump: false });
  carol.send({ type: 'action', action: 'resign' });
  assert.equal((await carol.next('match', (m) => m.snapshot.over)).snapshot.over.winner, 1);
});
