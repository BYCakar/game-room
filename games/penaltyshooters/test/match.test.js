import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../server/index.js';
import { DEFAULT_TEAM, getLeague } from '../shared/teams.js';
import { SHOOT_MS, KEEPER_MS, FLIGHT_MS, RESULT_MS } from '../shared/rules.js';
import { optimalDiveDelay } from '../shared/physics.js';
import { startServer } from '../../../server/index.js';
import { connect } from '../../../test/helpers.js';

const club = (name) => ({ ...DEFAULT_TEAM, name });
const league = getLeague('england');
const tournamentOptions = { mode: 'tournament', leagueId: league.id, teamId: league.teams[0].id };

function newMatch(extra = {}) {
  const clock = { value: 1_000_000 };
  const changes = [];
  const match = game.createMatch({
    players: ['alice', 'bob'], options: { mode: 'duel' }, bots: [null, null],
    now: () => clock.value, rand: () => 0.9999, onChange: (m) => changes.push(m.snapshot(0)), ...extra,
  });
  clearInterval(match.timer);
  return { match, clock, changes };
}

function readyDuel(match) {
  assert.equal(match.handle(0, { action: 'ready', team: club('Red Club') }), null);
  assert.equal(match.handle(1, { action: 'ready', team: club('Blue Club') }), null);
}

function winShootout(match, winner, onShot = () => {}) {
  for (let i = 0; i < 20 && !match.over && match.phase !== 'matchEnd'; i++) {
    assert.equal(match.phase, 'shoot');
    assert.equal(match.handle(match.shooter, { action: 'shoot', turnId: match.turnId, x: 0.1, y: match.shooter === winner ? 0.6 : 1.2 }), null);
    onShot(match);
    match.advance(KEEPER_MS + FLIGHT_MS + RESULT_MS);
  }
  assert.ok(match.over || match.phase === 'matchEnd');
}

test('options require a valid league/team; bots belong to tournaments and 1v1 accepts custom teams only', () => {
  assert.deepEqual(game.validateOptions({ mode: 'duel', junk: 1 }), { options: { mode: 'duel', teamId: 'custom' } });
  assert.deepEqual(game.validateOptions({ ...tournamentOptions, junk: 1 }), { options: tournamentOptions });
  assert.deepEqual(game.validateOptions({ ...tournamentOptions, teamId: 'custom' }).options.teamId, 'custom');
  for (const input of [null, {}, { mode: 'bad' }, { mode: 'duel', teamId: league.teams[0].id }, { ...tournamentOptions, leagueId: 'none' }, { ...tournamentOptions, teamId: 'spain-1' }]) assert.ok(game.validateOptions(input).error);
  assert.ok(game.validateBot({ level: 4 }, { mode: 'duel' }).error);
  assert.deepEqual(game.validateBot({ level: 4, cheat: 1 }, tournamentOptions).bot, { level: 4 });
  for (const level of [0, 9, 1.5, '4', null]) assert.ok(game.validateBot({ level }, tournamentOptions).error);
});

test('each seat supplies its own validated team and the match waits for both', () => {
  const { match } = newMatch({ options: tournamentOptions });
  assert.equal(match.options.mode, 'duel', 'an invitation cannot turn a human rival into a tournament bot');
  assert.equal(match.phase, 'setup');
  assert.equal(match.timer.hasRef(), false);
  assert.match(match.handle(0, { action: 'ready', team: league.teams[0] }), /custom/);
  assert.match(match.handle(0, { action: 'ready', team: { ...club('A'), primary: 'url(evil)' } }), /valid/);
  assert.equal(match.handle(1, { action: 'ready', team: club('Blue Club') }), null);
  assert.equal(match.phase, 'setup');
  assert.equal(match.teams[1].name, 'Blue Club');
  assert.equal(match.teams[0], null);
  assert.equal(match.handle(0, { action: 'ready', team: club('Red Club') }), null);
  assert.equal(match.phase, 'shoot');
  assert.deepEqual(match.teams.map((t) => t.name), ['Red Club', 'Blue Club']);
  assert.match(match.handle(0, { action: 'ready', team: club('Changed') }), /already/);
});

test('shots are revealed on release; seat, turn, bounds and server reaction time are checked', () => {
  const { match, clock } = newMatch({ contactFinder: () => null });
  readyDuel(match);
  assert.equal(match.snapshot(1).shot, null);
  assert.equal(match.snapshot(null).shot, null);
  const turnId = match.turnId;
  assert.match(match.handle(1, { action: 'shoot', turnId, x: 0.1, y: 0.8 }), /Wait/);
  assert.match(match.handle(0, { action: 'shoot', turnId: turnId - 1, x: 0.1, y: 0.8 }), /earlier/);
  assert.match(match.handle(0, { action: 'shoot', turnId, x: -0.2, y: 0.8 }), /Aim/);
  assert.match(match.handle(0, { action: 'save', turnId, x: 0.1, y: 0.8 }), /closed/);
  assert.equal(match.handle(0, { action: 'shoot', turnId, x: 0.1, y: 0.8, contact: { at: 1, x: 0.1, y: 0.8 }, outcome: 'saved' }), null);
  assert.equal(match.contact, null, 'a browser cannot supply its own collision');
  const cue = match.snapshot(1);
  assert.equal(cue.phase, 'keeper');
  assert.equal(cue.difficultyLevel, null);
  assert.equal(cue.deadline - cue.aimRevealAt, 600, 'duels reveal the target 600 ms before the kick');
  assert.deepEqual(cue.shot, { x: 0.1, y: 0.8 });
  assert.equal(cue.deadline - cue.serverTime, KEEPER_MS);
  assert.deepEqual(match.snapshot(null).shot, cue.shot);
  assert.match(match.handle(0, { action: 'save', turnId, x: 0.1, y: 0.8 }), /closed/);
  assert.match(match.handle(1, { action: 'save', turnId: turnId - 1, x: 0.1, y: 0.8 }), /earlier/);
  assert.match(match.handle(1, { action: 'save', turnId, x: 0.1, y: 1.1 }), /inside/);
  clock.value += 350;
  assert.equal(match.handle(1, { action: 'save', turnId, x: 0.12, y: 0.8, reactionMs: 0, at: 0, contact: { at: 1, x: 0.12, y: 0.8 } }), null);
  assert.equal(match.contact, null);
  assert.equal(match.save.reactionMs, 350, 'the browser cannot claim its own reaction time');
  assert.equal(match.phase, 'keeper', 'committing a dive does not shorten the shooter run-up');
  assert.equal(match.outcome, null);
  assert.deepEqual(match.snapshot(0).save, match.save, 'the shooter sees the physical dive immediately');
  assert.deepEqual(match.snapshot(null).save, match.save, 'spectators see the same physical dive');
  assert.equal(match.snapshot(1).save.reactionMs, 350);
  assert.match(match.handle(1, { action: 'save', turnId, x: 0.1, y: 0.8 }), /committed/);
  match.advance(KEEPER_MS - 350);
  assert.equal(match.phase, 'flight');
  assert.equal(match.outcome, null, 'the outcome is undecided while the ball is flying');
  assert.equal(match.snapshot(null).outcome, null);
  assert.deepEqual(match.score, [0, 0]);
  match.advance(FLIGHT_MS);
  assert.equal(match.phase, 'result');
  assert.equal(match.outcome, 'goal', 'matching aim alone cannot claim a save');
  assert.deepEqual(match.kicks, [['goal'], []]);
  assert.equal(match.moves[0].outcome, 'goal');
  match.advance(RESULT_MS);
  assert.equal(match.shooter, 1);
  assert.equal(match.turnId, turnId + 1);
  assert.equal(match.snapshot(null).shot, null);
  assert.equal(match.snapshot(null).aimRevealAt, null);
});

test('AI target cues get later with effective difficulty and keep their clock through pause and flight', () => {
  const offsets = [-800, -750, -700, -650, -600, -550, -500, -400 / .9 ** 2];
  for (let level = 1; level <= 8; level++) {
    const { match } = newMatch({ options: tournamentOptions, bots: [{ level }, null], contactFinder: () => null });
    assert.equal(match.handle(1, { action: 'ready' }), null);
    assert.equal(match.snapshot(1).aimRevealAt, null);
    assert.equal(match.snapshot(1).difficultyLevel, level);
    match.handle(0, { action: 'shoot', turnId: match.turnId, x: .12, y: .8 });
    const cue = match.snapshot(1);
    assert.equal(cue.aimRevealAt, cue.phaseStartedAt + KEEPER_MS + offsets[level - 1]);
    assert.ok(cue.aimRevealAt >= cue.phaseStartedAt && cue.aimRevealAt <= cue.deadline);
    assert.equal(match.snapshot(null).aimRevealAt, cue.aimRevealAt, 'spectators use the same cue clock');
    match.advance(300);
    match.setConnected(1, false);
    const untilCue = match.aimRevealAt - match.serverTime;
    match.advance(5000);
    match.setConnected(1, true);
    const resumed = match.snapshot(1);
    assert.equal(resumed.aimRevealAt, cue.aimRevealAt + 5000);
    assert.equal(resumed.aimRevealAt - resumed.serverTime, untilCue);
    assert.equal(resumed.difficultyLevel, level);
    match.advance(match.phaseMsLeft);
    assert.equal(match.phase, 'flight');
    assert.equal(match.aimRevealAt, match.flightStartedAt + offsets[level - 1]);
    match.advance(FLIGHT_MS + RESULT_MS);
    assert.equal(match.phase, 'shoot');
    assert.equal(match.aimRevealAt, null);
    assert.equal(match.shooter, 1);
    match.handle(1, { action: 'shoot', turnId: match.turnId, x: .12, y: .8 });
    assert.equal(match.aimRevealAt, match.serverTime, 'human shots remain immediately visible to the bot');
    clearInterval(match.timer);
  }
});

test('saves after landing are refused even before the next timer tick; shot and keeper timeouts progress', () => {
  const { match, clock } = newMatch();
  readyDuel(match);
  match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.9, y: 0.5 });
  clock.value += KEEPER_MS + FLIGHT_MS;
  assert.match(match.handle(1, { action: 'save', turnId: match.turnId, x: 0.9, y: 0.5 }), /closed/);
  assert.equal(match.phase, 'result');
  assert.equal(match.outcome, 'goal');
  match.advance(RESULT_MS);
  assert.deepEqual(match.score, [1, 0]);
  match.advance(SHOOT_MS);
  assert.equal(match.phase, 'flight');
  assert.equal(match.shot.timeout, true);
  match.advance(FLIGHT_MS + RESULT_MS);
  assert.deepEqual(match.kicks, [['goal'], ['miss']]);
  assert.equal(match.shooter, 0);
});

test('disconnect pauses the save window and reconnect preserves the remaining reaction time', () => {
  const { match } = newMatch({ contactFinder: () => null });
  readyDuel(match);
  match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.2, y: 0.6 });
  match.advance(250);
  match.setConnected(1, false);
  const remaining = match.phaseMsLeft;
  const before = match.serverTime;
  match.advance(20_000);
  assert.equal(match.phase, 'keeper');
  assert.equal(match.phaseMsLeft, remaining);
  assert.equal(match.serverTime, before + 20_000);
  assert.match(match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.2, y: 0.6 }), /paused/);
  match.setConnected(1, true);
  assert.equal(match.handle(1, { action: 'save', turnId: match.turnId, x: 0.2, y: 0.6 }), null);
  assert.equal(match.save.reactionMs, 250);
  match.advance(remaining + FLIGHT_MS);
  assert.equal(match.outcome, 'goal');
});

test('an early dive is visible before release, survives phases and reconnect, and is allowed only once per turn', () => {
  const { match } = newMatch({ timings: { shoot: 500, keeper: 90, flight: 70, result: 120 } });
  readyDuel(match);
  const turnId = match.turnId;
  const turnStartedAt = match.snapshot(null).turnStartedAt;
  match.advance(100);
  assert.equal(match.handle(1, { action: 'save', turnId, x: 0.1, y: 0.6 }), null);
  assert.equal(match.phase, 'shoot');
  assert.equal(match.save.reactionMs, 100);
  assert.equal(match.shot, null);
  for (const seat of [0, 1, null]) {
    assert.equal(match.snapshot(seat).shot, null);
    assert.deepEqual(match.snapshot(seat).save, match.save);
  }
  assert.match(match.handle(1, { action: 'save', turnId, x: 0.9, y: 0.6 }), /committed/);
  const originalDive = { ...match.save };
  match.advance(100);
  // The shooter can react to the visible early dive and choose the other corner.
  assert.equal(match.handle(0, { action: 'shoot', turnId, x: 0.9, y: 0.6 }), null);
  assert.deepEqual(match.save, originalDive);
  assert.equal(match.snapshot(null).turnStartedAt, turnStartedAt, 'the per-turn clock survives release');
  assert.match(match.handle(1, { action: 'save', turnId, x: 0.9, y: 0.6 }), /committed/);
  match.advance(30);
  match.setConnected(1, false);
  assert.match(match.handle(1, { action: 'save', turnId, x: 0.9, y: 0.6 }), /paused/);
  match.advance(5000);
  match.setConnected(1, true);
  assert.equal(match.save.at, originalDive.at + 5000);
  assert.equal(match.snapshot(null).turnStartedAt, turnStartedAt + 5000, 'pause shifts the common animation clock');
  assert.equal(match.save.reactionMs, originalDive.reactionMs);
  assert.match(match.handle(1, { action: 'save', turnId, x: 0.9, y: 0.6 }), /committed/);
  match.advance(60);
  assert.equal(match.phase, 'flight');
  assert.equal(match.snapshot(null).turnStartedAt, turnStartedAt + 5000, 'flight keeps the same per-turn clock');
  assert.equal(match.outcome, null);
  assert.match(match.handle(1, { action: 'save', turnId, x: 0.9, y: 0.6 }), /committed/);
  match.advance(70);
  assert.equal(match.outcome, 'goal');
  assert.deepEqual(match.score, [1, 0]);
  assert.equal(match.moves[0].save.x, originalDive.x);
  match.advance(120);
  assert.equal(match.turnId, turnId + 1);
  assert.equal(match.snapshot(null).turnStartedAt, match.serverTime, 'the next turn gets a new animation origin');
  assert.equal(match.save, null, 'the next penalty allows its keeper a fresh dive');
  assert.match(match.handle(0, { action: 'save', turnId, x: 0.9, y: 0.6 }), /earlier/);
  assert.equal(match.handle(0, { action: 'save', turnId: match.turnId, x: 0.9, y: 0.6 }), null);
});

test('early, run-up and flight dives are accepted, but matching coordinates without contact never save', () => {
  for (const phase of ['shoot', 'keeper', 'flight']) {
    const { match, clock } = newMatch({ timings: { shoot: 500, keeper: 90, flight: 70, result: 120 }, contactFinder: () => null });
    readyDuel(match);
    const turnId = match.turnId;
    if (phase !== 'shoot') match.handle(0, { action: 'shoot', turnId, x: 0.2, y: 0.8 });
    if (phase === 'flight') clock.value += 90 + 69;
    else clock.value += 20;
    assert.equal(match.handle(1, { action: 'save', turnId, x: 0.2, y: 0.8 }), null, phase);
    assert.equal(match.phase, phase);
    assert.equal(match.outcome, null);
    if (phase === 'shoot') match.handle(0, { action: 'shoot', turnId, x: 0.2, y: 0.8 });
    if (match.phase === 'keeper') match.advance(match.phaseMsLeft);
    assert.equal(match.phase, 'flight');
    assert.equal(match.outcome, null);
    match.advance(match.phaseMsLeft);
    assert.equal(match.phase, 'result');
    assert.equal(match.outcome, 'goal', phase);
    assert.deepEqual(match.kicks, [['goal'], []]);
    assert.match(match.handle(1, { action: 'save', turnId, x: 0.2, y: 0.8 }), /closed/);
  }
});

test('a swept body contact is broadcast once during flight, saved for replay, and scored only at landing', () => {
  const intervals = [];
  const fixture = { kind: 'keeper', x: 400, y: 120, scale: 0.4, normalX: 1, normalY: 0, vx: 140, vy: -100, frame: 3 };
  const contactFinder = (input) => {
    intervals.push({ ...input });
    const at = input.flightStartedAt + 60;
    return input.fromAt <= at && input.toAt >= at ? { ...fixture, at } : null;
  };
  const { match, changes } = newMatch({ timings: { keeper: 90, flight: 70, result: 120 }, contactFinder });
  readyDuel(match);
  match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.5, y: 0.4 });
  match.advance(90);
  const started = match.snapshot(null);
  assert.equal(started.flightStartedAt, match.serverTime);
  assert.equal(started.flightDurationMs, 70);
  assert.equal(started.runupDurationMs, 90);
  assert.equal(started.contact, null);
  const beforeContact = changes.length;
  match.advance(50);
  assert.equal(changes.length, beforeContact, 'empty flight sweeps do not broadcast');
  match.advance(12);
  assert.equal(match.phase, 'flight');
  assert.equal(match.outcome, 'saved');
  assert.equal(match.contact.at, started.flightStartedAt + 60);
  assert.equal(match.save, null, 'standing body contact does not require a dive action');
  assert.deepEqual(match.score, [0, 0]);
  assert.deepEqual(match.kicks, [[], []]);
  assert.equal(match.moves.length, 0);
  assert.equal(changes.length, beforeContact + 1);
  assert.deepEqual(intervals.map((input) => [input.fromAt - started.flightStartedAt, input.toAt - started.flightStartedAt]), [[0, 50], [50, 62]]);
  assert.equal(intervals[0].bot, false);
  assert.equal(intervals[0].turnId, started.turnId);
  assert.equal(intervals[0].turnStartedAt, started.turnStartedAt);
  assert.equal(match.snapshot(null).outcome, 'saved');
  assert.deepEqual(match.snapshot(0).contact, match.snapshot(1).contact);
  assert.match(match.handle(1, { action: 'save', turnId: match.turnId, x: 0.5, y: 0.4 }), /closed/);
  const eventCount = changes.length;
  const searches = intervals.length;
  match.advance(3);
  assert.equal(intervals.length, searches, 'a recorded first contact cannot be replaced');
  assert.equal(changes.length, eventCount);
  match.advance(5);
  assert.equal(match.phase, 'result');
  assert.deepEqual(match.kicks, [['saved'], []]);
  assert.deepEqual(match.moves[0].contact, { ...fixture, at: started.flightStartedAt + 60 });
  const snapshot = match.snapshot(null);
  snapshot.contact.x = -999;
  assert.equal(match.contact.x, fixture.x);
  assert.equal(changes.filter((view) => view.phase === 'flight' && view.contact).length, 1);
  match.advance(120);
  assert.equal(match.contact, null);
  assert.equal(match.flightStartedAt, null);
});

test('post events precede the score, survive pause/replay, and close further dive input', () => {
  for (const [x, outcome] of [[.01, 'goal'], [0, 'miss']]) {
    const { match, changes } = newMatch({ contactFinder: () => null });
    readyDuel(match);
    match.handle(0, { action: 'shoot', turnId: match.turnId, x, y: .5 });
    match.advance(KEEPER_MS + 590);
    assert.equal(match.phase, 'flight');
    assert.equal(match.frameContact.post, 'left');
    assert.equal(match.frameContact.outcome, outcome);
    assert.equal(match.contact, null);
    assert.equal(match.snapshot(null).outcome, null, 'a post impact is neither a keeper save nor an immediate goal');
    assert.deepEqual(match.score, [0, 0]);
    assert.match(match.handle(1, { action: 'save', turnId: match.turnId, x, y: .5 }), /closed/);
    assert.equal(changes.filter(view => view.frameContact).length, 1, 'only one impact broadcast');
    match.setConnected(1, false);
    const before = match.snapshot(null);
    match.advance(5000);
    match.setConnected(1, true);
    const resumed = match.snapshot(null);
    assert.equal(resumed.frameContact.at, before.frameContact.at + 5000);
    assert.equal(resumed.frameContact.goalAt, outcome === 'goal' ? before.frameContact.goalAt + 5000 : null);
    assert.equal(resumed.phaseMsLeft, before.phaseMsLeft);
    assert.equal(resumed.serverTime - resumed.frameContact.at, before.serverTime - before.frameContact.at);
    match.advance(match.phaseMsLeft - 1);
    assert.equal(match.moves.length, 0);
    match.advance(1);
    assert.equal(match.outcome, outcome);
    assert.equal(match.phase, 'result');
    assert.deepEqual(match.score, [outcome === 'goal' ? 1 : 0, 0]);
    assert.deepEqual(match.moves[0].frameContact, match.frameContact);
    const view = match.snapshot(null);
    view.frameContact.x = -999;
    assert.notEqual(match.frameContact.x, -999);
    match.advance(RESULT_MS);
    assert.equal(match.phase, 'shoot');
    assert.equal(match.frameContact, null);
  }
});

test('the earliest of a keeper and post impact wins even within one long server tick', () => {
  for (const keeperAt of [570, 598]) {
    const contactFinder = input => {
      const at = input.flightStartedAt + keeperAt;
      return input.fromAt <= at && input.toAt >= at ? { kind: 'keeper', at, x: 180, y: 100 } : null;
    };
    const { match } = newMatch({ contactFinder });
    readyDuel(match);
    match.handle(0, { action: 'shoot', turnId: match.turnId, x: .01, y: .5 });
    match.advance(KEEPER_MS + FLIGHT_MS + 180);
    assert.equal(match.phase, 'result');
    if (keeperAt === 570) {
      assert.equal(match.outcome, 'saved');
      assert.equal(match.frameContact, null);
      assert.equal(match.contact.at, match.flightStartedAt + keeperAt);
    } else {
      assert.equal(match.outcome, 'goal');
      assert.equal(match.contact, null);
      assert.equal(match.frameContact.post, 'left');
    }
  }
});

test('post flight extensions consume all elapsed time equally in one advance or small ticks', () => {
  const elapsed = KEEPER_MS + FLIGHT_MS + 180 + RESULT_MS + 35;
  const views = [];
  for (const step of [elapsed, 30, 7]) {
    const { match } = newMatch({ contactFinder: () => null });
    readyDuel(match);
    match.handle(0, { action: 'shoot', turnId: match.turnId, x: .01, y: .5 });
    for (let passed = 0; passed < elapsed; passed += step) match.advance(Math.min(step, elapsed - passed));
    const snapshot = match.snapshot(null);
    views.push({ phase: snapshot.phase, serverTime: snapshot.serverTime, phaseMsLeft: snapshot.phaseMsLeft,
      score: snapshot.score, kicks: snapshot.kicks, moves: snapshot.moves });
  }
  assert.equal(views[0].phase, 'shoot');
  assert.deepEqual(views[1], views[0]);
  assert.deepEqual(views[2], views[0]);
});

test('pausing a deflected ball shifts the contact and flight clocks together without replaying collision', () => {
  const contactFinder = ({ flightStartedAt, fromAt, toAt }) => {
    const at = flightStartedAt + 60;
    return fromAt <= at && toAt >= at ? { kind: 'keeper', at, x: 400, y: 120, scale: 0.4, normalX: 0, normalY: -1, vx: 0, vy: -140, frame: 2 } : null;
  };
  const { match, changes } = newMatch({ timings: { keeper: 90, flight: 70 }, contactFinder });
  readyDuel(match);
  match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.5, y: 0.4 });
  match.advance(90 + 62);
  match.setConnected(1, false);
  const snapshot = match.snapshot(null);
  const sent = changes.length;
  match.advance(10_000);
  assert.equal(changes.length, sent);
  match.setConnected(1, true);
  const resumed = match.snapshot(null);
  assert.equal(resumed.contact.at, snapshot.contact.at + 10_000);
  assert.equal(resumed.flightStartedAt, snapshot.flightStartedAt + 10_000);
  assert.equal(resumed.serverTime - resumed.contact.at, snapshot.serverTime - snapshot.contact.at);
  assert.equal(resumed.phaseMsLeft, snapshot.phaseMsLeft);
  match.advance(8);
  assert.equal(match.outcome, 'saved');
  assert.equal(match.moves[0].contact.at, resumed.contact.at);
});

test('real animated body masks distinguish an early or late matching dive from a timely interception', () => {
  for (const timing of ['early', 'timely', 'late']) {
    const { match } = newMatch();
    readyDuel(match);
    const aim = { x: 0.2, y: 0.8 };
    if (timing === 'early') {
      match.handle(1, { action: 'save', turnId: match.turnId, ...aim });
      match.advance(1000);
    }
    match.handle(0, { action: 'shoot', turnId: match.turnId, ...aim });
    if (timing !== 'early') {
      const plan = optimalDiveDelay({
        shot: aim, now: match.serverTime, flightStartedAt: match.serverTime + KEEPER_MS,
        flightMs: FLIGHT_MS, turnStartedAt: match.turnStartedAt, turnId: match.turnId, bot: false,
      });
      assert.ok(plan, 'the physical solver finds a viable interception');
      match.advance(timing === 'timely' ? plan.delayMs : KEEPER_MS + FLIGHT_MS - 1);
      assert.equal(match.handle(1, { action: 'save', turnId: match.turnId, ...aim }), null);
    }
    if (match.phase === 'keeper') match.advance(match.phaseMsLeft);
    match.advance(match.phaseMsLeft);
    assert.equal(match.phase, 'result');
    assert.equal(match.outcome, timing === 'timely' ? 'saved' : 'goal', timing);
    assert.equal(Boolean(match.contact), timing === 'timely', timing);
    assert.deepEqual(match.score, timing === 'timely' ? [0, 0] : [1, 0]);
  }
});

test('a real standing body can save without a dive, with the same first contact across tick sizes', () => {
  const contacts = [];
  for (const step of [FLIGHT_MS, 30, 7]) {
    const { match } = newMatch();
    readyDuel(match);
    match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.5, y: 0.4 });
    match.advance(KEEPER_MS);
    const flightStartedAt = match.flightStartedAt;
    for (let ms = 0; ms < FLIGHT_MS; ms += step) match.advance(Math.min(step, FLIGHT_MS - ms));
    assert.equal(match.phase, 'result');
    assert.equal(match.outcome, 'saved');
    assert.equal(match.save, null);
    assert.equal(match.contact.kind, 'keeper');
    assert.ok(match.contact.at >= flightStartedAt + FLIGHT_MS * 0.88, 'projection overlap before keeper depth is not contact');
    assert.ok(match.contact.at < flightStartedAt + FLIGHT_MS);
    contacts.push({ ...match.contact, at: match.contact.at - flightStartedAt });
  }
  assert.deepEqual(contacts[0], contacts[1]);
  assert.deepEqual(contacts[0], contacts[2]);
});

test('an input arriving after physical contact cannot change the save before the next timer callback', () => {
  const { match, clock } = newMatch();
  readyDuel(match);
  match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.5, y: 0.4 });
  // No timer callback runs here. Processing the input must sweep the elapsed
  // flight first, catch the existing body impact, then refuse a new dive.
  clock.value += KEEPER_MS + Math.ceil(FLIGHT_MS * 0.94);
  assert.match(match.handle(1, { action: 'save', turnId: match.turnId, x: 0.1, y: 0.8 }), /closed/);
  assert.equal(match.phase, 'flight');
  assert.equal(match.save, null);
  assert.equal(match.contact.kind, 'keeper');
  assert.equal(match.outcome, 'saved');
  assert.ok(match.contact.at < match.serverTime);
  assert.equal(match.moves.length, 0);
  match.advance(match.phaseMsLeft);
  assert.deepEqual(match.kicks, [['saved'], []]);
});

test('a committed dive animation resumes at the same frame after a disconnect', () => {
  const { match, changes } = newMatch();
  readyDuel(match);
  match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.2, y: 0.6 });
  match.advance(200);
  match.handle(1, { action: 'save', turnId: match.turnId, x: 0.2, y: 0.6 });
  match.advance(150);
  match.setConnected(0, false);
  const elapsedDive = match.serverTime - match.save.at;
  const elapsedPhase = match.serverTime - match.phaseStartedAt;
  const reaction = match.save.reactionMs;
  const sent = changes.length;
  match.advance(20_000);
  assert.equal(changes.length, sent, 'paused clock ticks do not broadcast large snapshots');
  match.setConnected(0, true);
  assert.equal(match.serverTime - match.save.at, elapsedDive);
  assert.equal(match.serverTime - match.phaseStartedAt, elapsedPhase);
  assert.equal(match.save.reactionMs, reaction);
  const afterReconnect = changes.length;
  match.advance(200);
  assert.equal(changes.length, afterReconnect, 'normal clock ticks also wait for a phase change');
});

test('an early 3–0 ends a duel, preserves every kick for replay, and prevents further changes', () => {
  const { match, changes } = newMatch();
  readyDuel(match);
  winShootout(match, 0);
  assert.deepEqual(match.over, { reason: 'penalties', winner: 0, score: [3, 0] });
  assert.equal(match.moves.length, 6);
  assert.deepEqual(match.kicks.map((kicks) => kicks.length), [3, 3]);
  assert.equal(match.matchHistory.length, 1);
  assert.deepEqual(changes.at(-1).over, match.over);
  const view = match.snapshot(null);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
  view.teams[0].name = 'tampered';
  assert.equal(match.teams[0].name, 'Red Club');
  assert.match(match.handle(0, { action: 'shoot', turnId: match.turnId, x: 0.5, y: 0.5 }), /over/);
  match.advance(100_000);
  assert.equal(match.moves.length, 6);
});

for (const { humanSeat, leagueId, base, levels } of [
  { humanSeat: 0, leagueId: 'england', base: 1, levels: [1, 1, 1, 1, 2, 2, 3] },
  { humanSeat: 1, leagueId: 'england', base: 4, levels: [4, 4, 4, 4, 5, 5, 6] },
  { humanSeat: 0, leagueId: 'global', base: 1, levels: [1, 1, 1, 1, 2, 2, 3, 3] },
  { humanSeat: 1, leagueId: 'global', base: 6, levels: [6, 6, 6, 6, 7, 7, 8, 8] },
  { humanSeat: 1, leagueId: 'england', base: 8, levels: [8, 8, 8, 8, 8, 8, 8] },
  { humanSeat: 0, leagueId: 'global', base: 8, levels: [8, 8, 8, 8, 8, 8, 8, 8] },
]) {
  test(`${leagueId} tournament raises base ${base} every two knockout rounds, with the human in seat ${humanSeat}`, () => {
    const bots = humanSeat ? [{ level: base }, null] : [null, { level: base }];
    const options = { mode: 'tournament', leagueId, teamId: getLeague(leagueId).teams[0].id };
    const { match } = newMatch({ options, bots });
    assert.equal(match.handle(humanSeat, { action: 'ready' }), null);
    assert.equal(match.teams[humanSeat].id, options.teamId);
    let played = 0;
    while (!match.over && played < 10) {
      assert.equal(match.snapshot(humanSeat).difficultyLevel, levels[played]);
      assert.equal(match.snapshot(humanSeat).bots[1 - humanSeat].level, base, 'rematches keep the requested base');
      if (base === 8) {
        const step = Math.max(0, Math.floor((played - 2) / 2));
        const snapshot = match.snapshot(humanSeat);
        assert.equal(snapshot.difficultyBoost, step);
        assert.equal(snapshot.difficultyProfile.saveMultiplier, 1.03 ** step);
        if (snapshot.tournament.stage === 'final') {
          assert.ok(Math.abs(snapshot.difficultyProfile.aimLeadMs - 400) < 1e-9);
        }
      }
      winShootout(match, humanSeat, current => {
        if (base === 8 && current.tournament.stage === 'final' && current.bots[current.shooter]) {
          assert.equal(current.deadline - current.aimRevealAt, 400, 'the final server cue appears 400 ms before the boot');
        }
      });
      assert.equal(match.matchResult.difficultyLevel, levels[played]);
      assert.equal(match.difficultyLevel, levels[played], 'results retain the difficulty just played');
      played++;
      if (!match.over) {
        assert.equal(match.phase, 'matchEnd');
        assert.match(match.handle(1 - humanSeat, { action: 'next-match' }), /no next/);
        assert.equal(match.handle(humanSeat, { action: 'next-match' }), null);
      }
    }
    assert.equal(played, levels.length);
    assert.equal(match.over.reason, 'champion');
    assert.equal(match.over.winner, humanSeat);
    assert.deepEqual(match.matchHistory.map(result => result.difficultyLevel), levels);
    assert.equal(match.tournament.champion, options.teamId);
  });
}

test('custom tournament team, group elimination, resign and abandonment have proper outcomes', () => {
  const { match } = newMatch({ options: { ...tournamentOptions, teamId: 'custom' }, bots: [null, { level: 1 }] });
  assert.equal(match.handle(0, { action: 'ready', team: club('My Club') }), null);
  assert.equal(match.tournament.teams.filter((team) => team.name === 'My Club').length, 1);
  for (let i = 0; i < 3; i++) {
    winShootout(match, 1);
    if (!match.over) match.handle(0, { action: 'next-match' });
  }
  assert.equal(match.over.reason, 'eliminated');
  const resigned = newMatch().match;
  assert.equal(resigned.handle(1, { action: 'resign' }), null);
  assert.equal(resigned.over.winner, 0);
  assert.equal(resigned.moves.length, 0);
  const gone = newMatch().match;
  gone.abandon(0);
  assert.deepEqual(gone.over, { reason: 'abandoned', winner: 1, score: [0, 0] });
});

test('real lobby: invitation, separate teams, spectator cue, reconnect and archive', async (t) => {
  const server = await startServer({ port: 0 });
  t.after(() => server.close());
  const alice = connect(server.port), bob = connect(server.port), watcher = connect(server.port);
  await Promise.all([alice.opened, bob.opened, watcher.opened]);
  for (const [client, name] of [[alice, 'alice'], [bob, 'bob'], [watcher, 'watcher']]) client.send({ type: 'join', name });
  const [aJoined] = await Promise.all([alice.next('joined'), bob.next('joined'), watcher.next('joined')]);
  assert.ok(aJoined.games.some((g) => g.id === 'penaltyshooters'));
  alice.send({ type: 'invite', to: 'bob', game: 'penaltyshooters', options: { mode: 'duel' } });
  bob.send({ type: 'accept', id: (await bob.next('invite')).id });
  const [aFirst, bFirst] = await Promise.all([alice.next('match'), bob.next('match')]);
  const aSeat = aFirst.snapshot.you, bSeat = bFirst.snapshot.you;
  assert.equal(aSeat + bSeat, 1);
  alice.send({ type: 'action', action: 'ready', team: club('Alice FC') });
  bob.send({ type: 'action', action: 'ready', team: club('Bob FC') });
  const started = (await alice.next('match', (m) => m.snapshot.phase === 'shoot')).snapshot;
  await bob.next('match', (m) => m.snapshot.phase === 'shoot');
  assert.equal(started.teams[aSeat].name, 'Alice FC');
  assert.equal(started.teams[bSeat].name, 'Bob FC');
  watcher.send({ type: 'watch', id: started.id });
  assert.equal((await watcher.next('match')).snapshot.you, null);
  const shooter = started.shooter === aSeat ? alice : bob;
  const keeper = started.shooter === aSeat ? bob : alice;
  shooter.send({ type: 'action', action: 'shoot', turnId: started.turnId, x: 0.12, y: 0.7 });
  const cue = (await keeper.next('match', (m) => m.snapshot.phase === 'keeper')).snapshot;
  assert.deepEqual((await watcher.next('match', (m) => m.snapshot.phase === 'keeper')).snapshot.shot, cue.shot);
  keeper.send({ type: 'action', action: 'save', turnId: cue.turnId, x: 0.12, y: 0.7 });
  await alice.next('match', (m) => m.snapshot.phase === 'result');
  alice.close();
  await bob.next('match', (m) => m.snapshot.paused);
  const resumed = connect(server.port);
  await resumed.opened;
  resumed.send({ type: 'join', name: 'alice', token: aJoined.token });
  assert.equal((await resumed.next('joined')).resumed, true);
  assert.equal((await resumed.next('match')).snapshot.you, aSeat);
  resumed.send({ type: 'action', action: 'resign' });
  assert.equal((await bob.next('match', (m) => m.snapshot.over)).snapshot.over.winner, bSeat);
  await server.saved();
  bob.send({ type: 'history', game: 'penaltyshooters' });
  assert.equal((await bob.next('history')).games.length, 1);
  assert.equal((await fetch(`http://localhost:${server.port}/games/penaltyshooters/server/match.js`)).status, 404);
  assert.equal((await fetch(`http://localhost:${server.port}/games/penaltyshooters/shared/rules.js`)).status, 200);
});
