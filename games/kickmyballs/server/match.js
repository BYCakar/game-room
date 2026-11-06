// One KickMyBalls match in progress: the authoritative world, the clock, the
// goals and the result. Like Blade Toss it runs on a clock of its own: the
// world moves in fixed steps of STEP seconds, and the players get a snapshot
// SEND_RATE times a second, and at once after an input that changed
// something.
//
// The match clock counts down only while the ball is in play: it stops for
// the countdown before each kick-off, for the celebration after a goal and
// while a player is away. When it runs out the match ends, a draw if the
// score is level. A goal scored with the last kick counts, and its
// celebration is seen out before the end.

import { randomUUID } from 'node:crypto';
import {
  COUNTDOWN_MS, GOAL_MS, ITEM_EVERY_MS, ITEM_FIRST_MS, ITEM_X, ITEM_Y, POWER_UPS, SEND_RATE, STEP,
} from '../shared/constants.js';
import { createWorld, kick, pack, resetForKickoff, scorerOf, setInput, spawnItem, step } from '../shared/sim.js';

const TICK_MS = 1000 / SEND_RATE;
const STEP_MS = STEP * 1000;
// A late tick is caught up on in steps, but a very late one (the process
// was busy) only in part, rather than all at once.
const MAX_CATCH_UP_MS = 250;
// Milliseconds are counted in steps of a sixtieth of a second, which floating
// point does not add up exactly.
const EPS = 1e-6;

export class KickMyBallsMatch {
  // `players` holds one name per seat and `options` is what validateOptions
  // returned. `bots` says, per seat, which level of bot plays it (or null);
  // its inputs arrive like anyone's, from the browser of the player it
  // faces. `onChange(match)` fires after anything the players should see.
  // `rand` is for tests.
  constructor({ players, options, bots, onChange, rand = Math.random }) {
    this.id = randomUUID();
    this.players = players;
    this.options = options;
    this.bots = bots ?? players.map(() => null);
    this.onChange = onChange;
    this.rand = rand;
    this.powerUps = options.powerUps !== false;
    this.score = players.map(() => 0);
    // Every goal: { seat, by, own, ms }, `seat` the side it counts for, `by`
    // the seat that touched the ball last, `ms` the match time it came at.
    // At full time a last entry { fullTime: true } is added, so that a match
    // played out to a goalless draw is still kept.
    this.goals = [];
    // The last input or kick counted from each seat, so that a browser
    // knows which of its own it is still waiting on.
    this.acks = players.map(() => 0);
    this.connected = players.map(() => true);
    this.spectators = 0;
    this.over = null;
    this.carry = 0; // milliseconds not yet stepped
    this.clockMs = options.length * 1000; // match time left
    this.world = createWorld();
    this.phaseMsLeft = COUNTDOWN_MS;
    this.itemMsLeft = this.between(ITEM_FIRST_MS);
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }

  between([lo, hi]) {
    return lo + this.rand() * (hi - lo);
  }

  get phase() {
    return this.world.phase;
  }

  get paused() {
    return this.connected.some((c) => !c);
  }

  // Match time played so far, in milliseconds.
  get playedMs() {
    return this.options.length * 1000 - this.clockMs;
  }

  tick() {
    const now = Date.now();
    const elapsed = Math.min(MAX_CATCH_UP_MS, now - this.lastTickAt);
    this.lastTickAt = now;
    this.advance(elapsed);
  }

  // Everything that happens in `ms` of match time. Nothing does while a
  // player is away.
  advance(ms) {
    if (this.over || this.paused) return;
    this.carry += ms;
    while (this.carry >= STEP_MS - EPS && !this.over) {
      this.carry -= STEP_MS;
      this.stepOnce();
    }
    // The match's end has been told of already, by finish().
    if (!this.over) this.onChange(this);
  }

  stepOnce() {
    const w = this.world;
    step(w, STEP);
    if (w.phase === 'countdown') {
      this.phaseMsLeft -= STEP_MS;
      if (this.phaseMsLeft <= EPS) {
        w.phase = 'playing';
        this.phaseMsLeft = 0;
      }
    } else if (w.phase === 'playing') {
      this.clockMs -= STEP_MS;
      if (w.goal !== -1) {
        this.scored(w.goal);
      } else if (this.clockMs <= EPS) {
        this.clockMs = 0;
        this.goals.push({ fullTime: true });
        const [a, b] = this.score;
        this.finish('time', a === b ? null : a > b ? 0 : 1);
        return;
      }
      if (this.powerUps && w.phase === 'playing') {
        // One at a time: the next is due a while after the last went.
        if (w.items.length) this.itemMsLeft = this.between(ITEM_EVERY_MS);
        else {
          this.itemMsLeft -= STEP_MS;
          if (this.itemMsLeft <= EPS) this.spawnItem();
        }
      }
    } else if (w.phase === 'goal') {
      this.phaseMsLeft -= STEP_MS;
      if (this.phaseMsLeft <= EPS) {
        if (this.clockMs <= EPS) {
          this.goals.push({ fullTime: true });
          const [a, b] = this.score;
          this.finish('time', a === b ? null : a > b ? 0 : 1);
          return;
        }
        resetForKickoff(w, 1 - this.goals[this.goals.length - 1].seat);
        w.phase = 'countdown';
        this.phaseMsLeft = COUNTDOWN_MS;
      }
    }
  }

  scored(seat) {
    this.score[seat]++;
    this.goals.push({ seat, ...scorerOf(this.world.ball, seat), ms: Math.round(this.playedMs) });
    this.world.phase = 'goal';
    this.world.items = [];
    this.phaseMsLeft = GOAL_MS;
    this.clockMs = Math.max(0, this.clockMs);
  }

  // A power-up of any kind, somewhere over the middle of the pitch.
  spawnItem() {
    const kind = POWER_UPS[Math.floor(this.rand() * POWER_UPS.length)];
    const x = Math.round(this.between(ITEM_X));
    const y = Math.round(this.between(ITEM_Y));
    return spawnItem(this.world, kind, x, y);
  }

  finish(reason, winner) {
    if (this.over) return;
    clearInterval(this.timer);
    // With the score, for the list of finished matches.
    this.over = { reason, winner, score: this.score.slice() };
    this.onChange(this);
  }

  // The lobby forwards every message from a player here. Returns an error
  // message for the player, or null. Inputs come often and are never
  // answered, even when they are of no use.
  handle(seat, action) {
    switch (action.action) {
      case 'input': return this.input(seat, action);
      case 'kick': return this.kick(seat, action);
      case 'resign':
        if (this.over) return 'The match is over';
        this.finish('resign', 1 - seat);
        return null;
      default: return 'Unknown action';
    }
  }

  acknowledge(seat, seq) {
    if (Number.isInteger(seq) && seq > this.acks[seat]) this.acks[seat] = seq;
  }

  // What the player is holding: { left, right, jump }, all booleans. Anything
  // else in the message is ignored. Kept during a pause and between goals,
  // since the keys may still be down.
  input(seat, { seq, left, right, jump }) {
    this.acknowledge(seat, seq);
    if (this.over) return null;
    setInput(this.world, seat, { left, right, jump });
    this.onChange(this);
    return null;
  }

  kick(seat, { seq }) {
    this.acknowledge(seat, seq);
    if (this.over || this.paused) return null;
    if (kick(this.world, seat)) this.onChange(this);
    return null;
  }

  // The player left and did not come back in time.
  abandon(seat) {
    this.finish('abandoned', 1 - seat);
  }

  // The match stops while a player is away, and starts again with a
  // countdown, so nobody scores while the other cannot answer.
  setConnected(seat, connected) {
    this.connected[seat] = connected;
    if (!connected) {
      setInput(this.world, seat, {});
      if (this.phase === 'playing') {
        this.world.phase = 'countdown';
        this.phaseMsLeft = COUNTDOWN_MS;
      }
    }
    this.onChange(this);
  }

  setSpectators(count) {
    this.spectators = count;
    this.onChange(this);
  }

  // Everything the player in `seat` needs to draw the match right now. A
  // spectator (`seat` is null) sees the same; nothing is hidden.
  snapshot(seat) {
    return {
      id: this.id,
      players: this.players,
      bots: this.bots,
      you: seat,
      options: this.options,
      phase: this.phase,
      phaseMsLeft: Math.max(0, Math.round(this.phaseMsLeft)),
      clockMs: Math.max(0, Math.round(this.clockMs)),
      paused: this.paused,
      score: this.score,
      // The goals, which the platform reads as moves: a match ended before
      // any goal or the final whistle is not kept.
      moves: this.goals,
      world: pack(this.world),
      acks: this.acks,
      connected: this.connected,
      spectators: this.spectators,
      over: this.over,
    };
  }
}
