import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseBotShot, chooseKeeperRead, difficulty, planActiveInterception, planKeeperAction } from '../shared/bot-strategy.js';
import { findKeeperContact, keeperPose, optimalDiveDelay } from '../shared/physics.js';
import { targetOf } from '../shared/rules.js';
import { tournamentProfile } from '../shared/difficulty.js';
import { createBot } from '../client/bot.js';

const seeded = (seed) => () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const timing = { now: 0, flightStartedAt: 1400, flightMs: 600, turnStartedAt: 0, turnId: 1, bot: true };
const contactFor = (shot, plan, times = timing) => findKeeperContact({ ...times, shot,
  save: { ...plan.target, at: plan.at }, fromAt: times.flightStartedAt, toAt: times.flightStartedAt + times.flightMs });

test('new levels 1 through 6 preserve old levels 3 through 8, including learning and shot delay', () => {
  const legacy = [
    [.34, .32, .026, .30, 95, .18, .36],
    [.28, .29, .022, .27, 85, .15, .44],
    [.22, .25, .018, .24, 75, .12, .52],
    [.17, .21, .014, .20, 60, .10, .60],
    [.12, .17, .010, .16, 45, .075, .68],
    [.08, .12, .006, .12, 30, .055, .76],
  ];
  for (let level = 1; level <= 6; level++) {
    const oldLevel = level + 2, settings = difficulty(level);
    assert.equal(settings.strength, oldLevel);
    assert.deepEqual([settings.wrongCorner, settings.shortReach, settings.readError, settings.timingError,
      settings.timingErrorMs, settings.shotOutside, settings.shotCorner], legacy[level - 1]);
    assert.equal(chooseBotShot(level, () => .5).delayMs, 1300 - oldLevel * 20);
    for (const repeats of [0, 1, 3, 20]) {
      const learned = Math.min(.06, repeats * .02) * oldLevel / 8;
      const wrong = legacy[level - 1][0] - learned * .5;
      const short = legacy[level - 1][1] - learned * .5;
      for (const [roll, expected] of [[wrong - .00001, 'wrong-corner'], [wrong + .00001, 'short-reach'],
        [wrong + short - .00001, 'short-reach'], [wrong + short + .00001, 'read']]) {
        let first = true;
        const random = () => { if (first) { first = false; return roll; } return .5; };
        assert.equal(chooseKeeperRead({ x: .12, y: .8 }, level, random, repeats).kind, expected);
      }
    }
  }
});

test('all eight levels make explicit wrong-corner and short-reach mistakes at their advertised rates', () => {
  const count = 20_000;
  let previousErrors = Infinity;
  for (let level = 1; level <= 8; level++) {
    const random = seeded(100 + level), settings = difficulty(level), counts = { read: 0, 'wrong-corner': 0, 'short-reach': 0 };
    for (let i = 0; i < count; i++) {
      const shot = { x: i % 2 ? .12 : .88, y: .82 };
      const choice = chooseKeeperRead(shot, level, random);
      counts[choice.kind]++;
      assert.ok(targetOf(choice.target, true));
      if (choice.kind === 'wrong-corner') assert.ok((choice.target.x - .5) * (shot.x - .5) < 0);
      if (choice.kind === 'short-reach') {
        assert.ok((choice.target.x - .5) * (shot.x - .5) > 0, 'under-reaching keeps the chosen side');
        assert.ok(Math.abs(choice.target.x - .5) < Math.abs(shot.x - .5) * .6);
        assert.ok(choice.target.y < shot.y);
      }
    }
    assert.ok(Math.abs(counts['wrong-corner'] / count - settings.wrongCorner) < .015);
    assert.ok(Math.abs(counts['short-reach'] / count - settings.shortReach) < .015);
    const errors = (counts['wrong-corner'] + counts['short-reach']) / count;
    assert.ok(errors < previousErrors, `level ${level} improves`);
    previousErrors = errors;
    assert.ok(errors > .05, 'even the strongest opponent remains fallible');
    if (level === 1) assert.ok(errors > .64 && errors < .68);
  }
});

test('shooting gets harder with level while retaining both easy balls and genuine misses', () => {
  const count = 10_000;
  let previousOut = Infinity, previousCorner = -Infinity;
  for (let level = 1; level <= 8; level++) {
    const random = seeded(400 + level), settings = difficulty(level);
    const counts = { outside: 0, middle: 0, corner: 0 };
    let left = 0, high = 0;
    for (let i = 0; i < count; i++) {
      const shot = chooseBotShot(level, random);
      counts[shot.kind]++;
      assert.ok(targetOf(shot.target));
      if (shot.kind === 'outside') assert.ok(shot.target.x < 0 || shot.target.x > 1 || shot.target.y > 1);
      if (shot.target.x < .5) left++;
      if (shot.target.y > .6) high++;
    }
    const outside = counts.outside / count;
    const corner = counts.corner / (count - counts.outside);
    assert.ok(Math.abs(outside - settings.shotOutside) < .015);
    assert.ok(Math.abs(corner - settings.shotCorner) < .02);
    assert.ok(outside < previousOut && corner > previousCorner);
    assert.ok(counts.middle > 500 && counts.outside > 100);
    assert.ok(left > count * .45 && left < count * .55);
    assert.ok(high > count * .2 && high < count * .8);
    previousOut = outside; previousCorner = corner;
  }
});

test('latest viable timing uses active dive frames, including low dives touching down', () => {
  for (const target of [{ x: .1, y: .8 }, { x: .9, y: .8 }, { x: .2, y: .5 }, { x: .8, y: .55 }, { x: .88, y: .3 }]) {
    const plan = planActiveInterception({ ...timing, target });
    assert.ok(plan);
    const contact = contactFor(target, plan);
    assert.ok(contact && contact.at >= plan.at);
    const pose = keeperPose({ ...timing, save: { ...target, at: plan.at }, now: contact.at });
    assert.ok(pose.frame >= 6 && pose.frame <= 14);
    if (target.y > .7) assert.ok(pose.y < 124.5, 'high saves happen in the air');
    if (target.y < .4) assert.equal(pose.y, 125, 'an active low dive can intercept while touching down');
    assert.ok(plan.at >= timing.flightStartedAt, 'these dives happen after the kick, not immediately at the cue');
  }
  const target = { x: .8, y: .55 };
  const old = optimalDiveDelay({ ...timing, target, shot: target });
  const current = planActiveInterception({ ...timing, target });
  assert.ok(old.delayMs < 200 && current.delayMs > 1500, 'the former floor interception is not preferred');
});

test('a mistaken read is never repaired by timing against the real shot', () => {
  const realShot = { x: .1, y: .8 };
  for (const decision of [
    { kind: 'wrong-corner', target: { x: .9, y: .8 } },
    { kind: 'short-reach', target: { x: .35, y: .35 } },
  ]) {
    const plan = planKeeperAction({ ...timing, decision, level: 8, random: () => .99 });
    assert.ok(plan);
    assert.deepEqual(plan.target, decision.target);
    assert.equal(contactFor(realShot, plan), null);
    const otherActualShot = { x: .8, y: .2 };
    const samePlan = planKeeperAction({ ...timing, decision, level: 8, random: () => .99, shot: otherActualShot });
    assert.deepEqual(samePlan, plan, 'the planner does not use an actual-shot escape hatch');
  }
  const impossible = { kind: 'wrong-corner', target: { x: .1, y: .8 } };
  const fallback = planKeeperAction({ ...timing, now: 1900, decision: impossible, level: 3, random: () => .99 });
  assert.ok(fallback && !fallback.viable);
  assert.ok(fallback.at >= timing.flightStartedAt && fallback.at < 2000);
});

test('real mask collisions retain the old range and add two stronger, fallible top levels', () => {
  const source = seeded(2026);
  const shots = Array.from({ length: 1000 }, (_, i) => ({
    x: i % 5 === 0 ? .35 + source() * .3 : source() < .5 ? .05 + source() * .35 : .6 + source() * .35,
    y: .1 + source() * .84,
  }));
  const rates = [];
  for (const level of [1, 6, 7, 8]) {
    const random = seeded(100 + difficulty(level).strength);
    let saved = 0;
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i], times = { ...timing, turnId: i + 1 };
      const decision = chooseKeeperRead(shot, level, random);
      const plan = planKeeperAction({ ...times, decision, level, random });
      assert.ok(plan.at >= times.now && plan.at < times.flightStartedAt + times.flightMs);
      if (contactFor(shot, plan, times)) saved++;
    }
    rates.push(saved / shots.length);
  }
  assert.ok(rates[0] < rates[1] && rates[1] < rates[2] && rates[2] < rates[3], JSON.stringify(rates));
  assert.ok(rates[0] > .20 && rates[0] < .35, JSON.stringify(rates));
  assert.ok(rates[1] > rates[0] + .25 && rates[3] < .98, JSON.stringify(rates));
});

test('repeating either high or low corners retains mistakes at every sampled difficulty', () => {
  for (const shot of [{ x: .12, y: .8 }, { x: .88, y: .3 }]) {
    const results = [];
    for (const level of [1, 6, 7, 8]) {
      const random = seeded(100 + difficulty(level).strength);
      let saved = 0, errors = 0;
      for (let i = 0; i < 1000; i++) {
        const times = { ...timing, turnId: i + 1 };
        const decision = chooseKeeperRead(shot, level, random, 4);
        if (decision.kind !== 'read') errors++;
        const plan = planKeeperAction({ ...times, decision, level, random });
        if (contactFor(shot, plan, times)) saved++;
      }
      results.push(saved / 1000);
      assert.ok(errors > 15, 'learning retains an explicit error floor');
    }
    assert.ok(results[0] > .10 && results[0] < .35, JSON.stringify(results));
    assert.ok(results[1] > results[0] + .25 && results[3] < .995, JSON.stringify(results));
    assert.ok(results[1] < results[2] && results[2] < results[3], JSON.stringify(results));
  }
});

function scheduler() {
  let clock = 0, nextId = 1;
  const timers = new Map();
  return {
    now: () => clock,
    setTimer(fn, delay) { const id = nextId++; timers.set(id, { at: clock + delay, fn }); return id; },
    clearTimer(id) { timers.delete(id); },
    count: () => timers.size,
    nextAt: () => Math.min(...[...timers.values()].map(timer => timer.at)),
    advance(to) {
      while (timers.size) {
        const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (timer.at > to) break;
        clock = timer.at; timers.delete(id); timer.fn();
      }
      clock = to;
    },
  };
}
const snapshot = (extra = {}) => ({ id: 'match', you: 0, bots: [null, { level: 8 }], shooter: 0, phase: 'keeper',
  turnId: 1, serverTime: 0, phaseStartedAt: 0, turnStartedAt: 0, flightStartedAt: null,
  runupDurationMs: 1400, flightDurationMs: 600, shot: { x: .1, y: .8 }, save: null, contact: null, paused: false, over: null, ...extra });

test('the bot keeps one planned save across run-up, flight, duplicate snapshots and confirmation', () => {
  const clock = scheduler(), actions = [];
  const bot = createBot({ send: action => actions.push(action) }, { ...clock, random: () => .99 });
  const first = snapshot();
  bot.update(first);
  const due = clock.nextAt();
  assert.ok(due > 1400 && due < 2000);
  clock.advance(500); bot.update(first);
  assert.equal(clock.nextAt(), due, 'same-object redraw does not restart the clock');
  clock.advance(1400);
  const flight = snapshot({ phase: 'flight', phaseStartedAt: 1400, flightStartedAt: 1400, serverTime: 1400 });
  bot.update(flight);
  assert.equal(clock.count(), 1);
  assert.equal(clock.nextAt(), due);
  clock.advance(2000);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'save');
  assert.equal(actions[0].bot, true);
  bot.update({ ...flight, serverTime: 2000 });
  assert.equal(clock.count(), 0);
  bot.destroy();
});

test('pause preserves the selected target and shifts the pending action with the server turn clock', () => {
  const clock = scheduler(), actions = [];
  let rolls = 0;
  const bot = createBot({ send: action => actions.push(action) }, { ...clock, random: () => { rolls++; return .99; } });
  bot.update(snapshot());
  const due = clock.nextAt(), initialRolls = rolls;
  clock.advance(500);
  bot.update(snapshot({ paused: true, serverTime: 500 }));
  assert.equal(clock.count(), 0);
  clock.advance(5500);
  bot.update(snapshot({ serverTime: 5500, turnStartedAt: 5000, phaseStartedAt: 5000 }));
  assert.equal(rolls, initialRolls, 'resuming cannot reroll a bad read');
  assert.equal(clock.nextAt(), due + 5000);
  clock.advance(due + 5001);
  assert.equal(actions.length, 1);
  bot.update(snapshot({ phase: 'flight', serverTime: due + 5001, turnStartedAt: 5000, phaseStartedAt: 6400, flightStartedAt: 6400 }));
  clock.advance(7000);
  assert.equal(actions.length, 1);
  bot.destroy();
});

test('contact, spectators, completed matches and destruction cancel pending bot input', () => {
  for (const stop of [{ contact: { kind: 'keeper' } }, { frameContact: { kind: 'post' } }, { you: null }, { over: { winner: 0 } }, { save: { x: .2, y: .8 } }]) {
    const clock = scheduler(), actions = [];
    const bot = createBot({ send: action => actions.push(action) }, { ...clock, random: () => .99 });
    bot.update(snapshot());
    bot.update(snapshot(stop));
    clock.advance(3000);
    assert.equal(actions.length, 0);
    bot.destroy();
  }
  const clock = scheduler(), actions = [];
  const bot = createBot({ send: action => actions.push(action) }, { ...clock, random: () => .99 });
  bot.update(snapshot()); bot.destroy(); clock.advance(3000);
  assert.equal(actions.length, 0);
});

test('a shooting bot sends one varied shot per turn and a new turn gets a fresh action', () => {
  const clock = scheduler(), actions = [];
  const bot = createBot({ send: action => actions.push(action) }, { ...clock, random: seeded(900) });
  bot.update(snapshot({ shooter: 1, phase: 'shoot', shot: null }));
  clock.advance(2500);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'shoot');
  bot.update(snapshot({ shooter: 1, phase: 'shoot', shot: null, serverTime: 2500 }));
  clock.advance(4000);
  assert.equal(actions.length, 1);
  bot.update(snapshot({ shooter: 1, phase: 'shoot', shot: null, serverTime: 4000, turnStartedAt: 4000, phaseStartedAt: 4000, turnId: 3 }));
  clock.advance(6500);
  assert.equal(actions.length, 2);
  assert.equal(actions[1].turnId, 3);
  bot.destroy();
});

test('the bot uses effective tournament difficulty without changing the requested rematch level', () => {
  for (const action of ['shoot', 'save']) {
    const clock = scheduler(), actions = [], random = seeded(701), expectedRandom = seeded(701);
    const view = snapshot({ bots: [null, { level: 1 }], difficultyLevel: 8,
      ...(action === 'shoot' ? { shooter: 1, phase: 'shoot', shot: null } : {}) });
    const expected = action === 'shoot' ? chooseBotShot(8, expectedRandom) : planKeeperAction({ ...timing,
      decision: chooseKeeperRead(view.shot, 8, expectedRandom), level: 8, random: expectedRandom });
    const bot = createBot({ send: value => actions.push(value) }, { ...clock, random });
    bot.update(view);
    assert.equal(clock.nextAt(), action === 'shoot' ? expected.delayMs : expected.at);
    clock.advance(2100);
    assert.deepEqual(actions, [{ action, bot: true, turnId: 1, ...expected.target }]);
    assert.equal(view.bots[1].level, 1);
    bot.destroy();
  }
});

test('the bot consumes the overtime profile for the same one-action turn lifecycle', () => {
  const clock = scheduler(), actions = [], random = seeded(301), expectedRandom = seeded(301);
  const profile = tournamentProfile(8, 'final');
  const view = snapshot({ bots: [null, { level: 8 }], difficultyLevel: 8, difficultyProfile: profile });
  const decision = chooseKeeperRead(view.shot, profile, expectedRandom);
  const expected = planKeeperAction({ ...timing, decision, level: profile, random: expectedRandom });
  const bot = createBot({ send: value => actions.push(value) }, { ...clock, random });
  bot.update(view);
  assert.equal(clock.nextAt(), expected.at);
  clock.advance(1400);
  bot.update({ ...view, phase: 'flight', phaseStartedAt: 1400, flightStartedAt: 1400, serverTime: 1400 });
  assert.equal(clock.nextAt(), expected.at);
  clock.advance(2100);
  assert.deepEqual(actions, [{ action: 'save', bot: true, turnId: 1, ...expected.target }]);
  assert.equal(profile.overtimeSteps, 2);
  assert.equal(view.bots[1].level, 8);
  bot.destroy();
});
