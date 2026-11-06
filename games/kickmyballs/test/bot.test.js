// The computer opponent: whole matches at every level, stronger levels
// beating weaker ones, and the bot's seat as the player's browser plays it
// (client/bot.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import kickmyballs from '../server/index.js';
import { BALL_R, FLOOR, PITCH_W } from '../shared/constants.js';
import { BOT_LEVELS, ballPath, createBrain } from '../shared/bot.js';
import { createWorld } from '../shared/sim.js';
import { botSeat, createBot } from '../client/bot.js';

// The same pseudo-random numbers for the same seed.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// A whole match between two bots, each deciding every 50 ms of match time,
// as the browser's bot does about that often.
function botMatch(levels, { seed = 1, length = 60, powerUps = true } = {}) {
  const rand = seeded(seed);
  const match = kickmyballs.createMatch({
    players: levels.map((l) => `L${l}`), options: { length, powerUps }, bots: levels.map((level) => ({ level })),
    onChange() {}, rand,
  });
  clearInterval(match.timer);
  const brains = levels.map((level) => createBrain(level, rand));
  const held = ['', ''];
  let ms = 0;
  while (!match.over && ms < 10 * 60_000) {
    for (const seat of [0, 1]) {
      const d = brains[seat].decide(match.world, seat, 0.05);
      const input = { left: d.left, right: d.right, jump: d.jump };
      const key = JSON.stringify(input);
      if (key !== held[seat]) {
        assert.equal(match.handle(seat, { action: 'input', ...input }), null);
        held[seat] = key;
      }
      if (d.kick) assert.equal(match.handle(seat, { action: 'kick' }), null);
    }
    match.advance(50);
    ms += 50;
  }
  return match;
}

test('bots of every level play whole matches to the final whistle', () => {
  for (let level = 1; level <= BOT_LEVELS; level++) {
    for (const powerUps of [true, false]) {
      const match = botMatch([level, BOT_LEVELS + 1 - level], { seed: level * 13 + (powerUps ? 1 : 0), powerUps });
      assert.equal(match.over?.reason, 'time', `level ${level}: ${JSON.stringify(match.over)}`);
      const scored = match.goals.filter((g) => !g.fullTime).length;
      assert.equal(scored, match.score[0] + match.score[1]);
    }
  }
});

test('the bots score goals, and the strongest beats the weakest', () => {
  let strong = 0;
  let goals = 0;
  for (let k = 0; k < 6; k++) {
    // Half the matches with the strong bot on each side.
    const seats = k % 2 ? [1, 8] : [8, 1];
    const match = botMatch(seats, { seed: 100 + k });
    const strongSeat = seats.indexOf(8);
    goals += match.score[0] + match.score[1];
    if (match.over.winner === strongSeat) strong++;
  }
  assert.ok(goals > 0);
  assert.ok(strong >= 5, `level 8 won ${strong} of 6`);
});

test('the ball path falls, bounces and stays on the pitch', () => {
  const w = createWorld();
  Object.assign(w.ball, { x: 480, y: 100, vx: 300, vy: 0 });
  const path = ballPath(w, 2);
  assert.equal(path.length, 60);
  for (const q of path) {
    assert.ok(q.x >= BALL_R - 1e-9 && q.x <= PITCH_W - BALL_R + 1e-9);
    assert.ok(q.y <= FLOOR - BALL_R + 1e-9);
  }
  assert.ok(path.some((q, i) => i && q.y < path[i - 1].y && path[i - 1].y > 400), 'it bounced');
});

test('a bot in front of the ball kicks it; one held up does nothing', () => {
  const w = createWorld();
  w.phase = 'playing';
  const p = w.players[1];
  Object.assign(w.ball, { x: p.x - 40, y: FLOOR - BALL_R });
  const always = createBrain(8, () => 0);
  assert.equal(always.decide(w, 1, 0.05).kick, true);
  w.players[1].freezeT = 1;
  assert.deepEqual(createBrain(8, () => 0).decide(w, 1, 0.05), { left: false, right: false, jump: false, kick: false });
  w.players[1].freezeT = 0;
  w.phase = 'countdown';
  assert.deepEqual(createBrain(8, () => 0).decide(w, 1, 0.05), { left: false, right: false, jump: false, kick: false });
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('the browser plays the bot: changes of input only, one kick at a time, all marked bot', async (t) => {
  // Certain to kick: every roll succeeds, and the ball sits at its boot.
  const random = Math.random;
  Math.random = () => 0;
  t.after(() => { Math.random = random; });
  const world = createWorld();
  world.phase = 'playing';
  Object.assign(world.ball, { x: world.players[1].x - 40, y: FLOOR - BALL_R });

  const sent = [];
  const bot = createBot({ send: (action) => sent.push(action) }, () => world);
  t.after(() => bot.destroy());
  const game = { id: 'm', over: null, you: 0, bots: [null, { level: 8 }], phase: 'playing', paused: false };
  bot.update(game);
  // The world shown never catches up with the kick, as over a slow link.
  await wait(250);
  const kicks = sent.filter((a) => a.action === 'kick');
  assert.equal(kicks.length, 1, JSON.stringify(sent));
  assert.ok(sent.every((a) => a.bot === true));
  const inputs = sent.filter((a) => a.action === 'input');
  for (let i = 1; i < inputs.length; i++) {
    assert.notDeepEqual(inputs[i], inputs[i - 1], 'only changes are sent');
  }
  // Paused, it lets go of everything.
  bot.update({ ...game, paused: true });
  await wait(80);
  assert.deepEqual(sent.filter((a) => a.action === 'input').at(-1) ?? { left: false, right: false, jump: false, action: 'input', bot: true },
    { action: 'input', left: false, right: false, jump: false, bot: true });
});

test('nobody plays the bot from a spectator\'s screen or after the end', async (t) => {
  assert.equal(botSeat({ over: null, you: null, bots: [null, { level: 3 }] }), null);
  assert.equal(botSeat({ over: { reason: 'time' }, you: 0, bots: [null, { level: 3 }] }), null);
  assert.equal(botSeat({ over: null, you: 0, bots: [null, null] }), null);
  assert.equal(botSeat({ over: null, you: 1, bots: [{ level: 3 }, null] }), 0);
  const world = createWorld();
  world.phase = 'playing';
  const sent = [];
  const bot = createBot({ send: (action) => sent.push(action) }, () => world);
  t.after(() => bot.destroy());
  bot.update({ id: 'm', over: null, you: null, bots: [null, { level: 8 }], phase: 'playing', paused: false });
  await wait(100);
  assert.deepEqual(sent, []);
});
