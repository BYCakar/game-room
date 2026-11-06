// One Blade Toss duel in progress: the authoritative world, the rounds and
// the result. Like Tanks it runs on a clock of its own: the world moves in
// fixed steps of STEP seconds, and the players get a snapshot SEND_RATE
// times a second, and at once after a press that changed something.

import { randomUUID } from 'node:crypto';
import {
  AIM_SPEED, CEIL, COUNTDOWN_MS, DRAW_WINDOW, ITEM_EVERY_MS, ITEM_FIRST_MS, ITEM_RADIUS, MAX_LAG, MOVING_CHANCE,
  POWER_UPS, ROUND_LIMIT_MS, ROUND_OVER_MS, SEND_RATE, STEP,
} from '../shared/constants.js';
import { MAPS } from '../shared/maps.js';
import { aimRate, createWorld, geometry, hasMovingLedges, pack, press, spawnItem, step } from '../shared/sim.js';

const TICK_MS = 1000 / SEND_RATE;
const STEP_MS = STEP * 1000;
// A late tick is caught up on in steps, but a very late one (the process
// was busy) only in part, rather than all at once.
const MAX_CATCH_UP_MS = 250;
// A throw may be taken a little ahead of where the server has the swing,
// since the browser's clock and the server's do not quite agree.
const AHEAD = AIM_SPEED * 0.05;
// Milliseconds are counted in steps of a sixtieth of a second, which floating
// point does not add up exactly.
const EPS = 1e-6;

// The arena of the last match started, so that the next one differs.
let lastMap = -1;
function pickMap(rand) {
  let map = Math.floor(rand() * MAPS.length);
  if (map === lastMap && MAPS.length > 1) map = (map + 1 + Math.floor(rand() * (MAPS.length - 1))) % MAPS.length;
  lastMap = map;
  return map;
}

export class BladeTossMatch {
  // `players` holds one name per seat and `options` is what validateOptions
  // returned. `bots` says, per seat, which level of bot plays it (or null);
  // its presses arrive like anyone's, from the browser of the player it
  // faces. `onChange(match)` fires after anything the players should see.
  // `map` and `rand` are for tests.
  constructor({ players, options, bots, onChange, map, rand = Math.random }) {
    this.id = randomUUID();
    this.players = players;
    this.options = options;
    this.bots = bots ?? players.map(() => null);
    this.onChange = onChange;
    this.rand = rand;
    this.map = Number.isInteger(map) && MAPS[map] ? map : pickMap(rand);
    // Matches set up before there were power-ups have none in their options.
    this.powerUps = options.powerUps !== false;
    this.score = players.map(() => 0);
    // How each finished round went: { winner, reason }, `winner` null when
    // nobody took it.
    this.rounds = [];
    this.held = players.map(() => false);
    // The last press or release counted from each seat, so that a browser
    // knows which of its own it is still waiting on.
    this.acks = players.map(() => 0);
    this.connected = players.map(() => true);
    this.spectators = 0;
    this.over = null;
    this.carry = 0; // milliseconds not yet stepped
    this.world = null;
    this.startRound();
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }

  // Some rounds, in arenas that have them, are fought with the ledges moving.
  startRound() {
    const moving = hasMovingLedges(this.map) && this.rand() < MOVING_CHANCE;
    this.world = createWorld(this.map, { rand: this.rand, eventId: this.world?.eventId ?? 0, moving });
    this.itemMsLeft = this.between(ITEM_FIRST_MS);
    this.phaseMsLeft = COUNTDOWN_MS;
    this.roundMsLeft = ROUND_LIMIT_MS;
    this.result = null;
  }

  between([lo, hi]) {
    return lo + this.rand() * (hi - lo);
  }

  // A power-up of any kind, floating at body height or a jump up above the
  // floor or one of the ledges where they are now.
  spawnItem() {
    const geo = geometry(this.world);
    const kind = POWER_UPS[Math.floor(this.rand() * POWER_UPS.length)];
    const surface = this.rand() < 0.5 ? geo.surfaces[0] : geo.plats[Math.floor(this.rand() * geo.plats.length)];
    const lo = Math.max(geo.wl + 40, surface.x1 + ITEM_RADIUS);
    const hi = Math.min(geo.wr - 40, surface.x2 - ITEM_RADIUS);
    const x = Math.round(lo + this.rand() * Math.max(0, hi - lo));
    const y = Math.round(Math.max(CEIL + 40, surface.y - (this.rand() < 0.5 ? 34 : 100)));
    return spawnItem(this.world, kind, x, y);
  }

  get phase() {
    return this.world.phase;
  }

  get paused() {
    return this.connected.some((c) => !c);
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
    step(w, STEP, this.held);
    if (w.phase === 'countdown') {
      this.phaseMsLeft -= STEP_MS;
      if (this.phaseMsLeft <= EPS) {
        w.phase = 'playing';
        this.phaseMsLeft = 0;
      }
    } else if (w.phase === 'playing') {
      this.roundMsLeft -= STEP_MS;
      if (this.powerUps) {
        this.itemMsLeft -= STEP_MS;
        // One at a time: the next is due a while after the last appeared.
        if (this.itemMsLeft <= EPS && !w.items.length) {
          this.spawnItem();
          this.itemMsLeft = this.between(ITEM_EVERY_MS);
        }
      }
      if (w.killT >= 0) {
        w.phase = 'roundOver';
        this.phaseMsLeft = ROUND_OVER_MS;
      } else if (this.roundMsLeft <= EPS) {
        w.phase = 'roundOver';
        this.phaseMsLeft = ROUND_OVER_MS;
        this.endRound(null, 'time');
      }
    } else {
      // A second hit just after the first makes it a double knock-out.
      if (!this.result && w.killT >= DRAW_WINDOW) {
        const alive = w.fighters.filter((p) => p.alive);
        if (alive.length === 1) this.endRound(alive[0].seat, 'hit');
        else this.endRound(null, 'double');
      }
      this.phaseMsLeft -= STEP_MS;
      if (this.phaseMsLeft <= EPS) {
        const decided = this.decided();
        if (decided) this.finish(decided.reason, decided.winner);
        else this.startRound();
      }
    }
  }

  endRound(winner, reason) {
    this.result = { winner, reason };
    this.rounds.push(this.result);
    if (winner !== null) this.score[winner]++;
  }

  // Whether the match is over once this round has been seen out: someone has
  // won more than half the rounds, or (rounds nobody took do not count) the
  // match has gone on for twice as many rounds as it was to have.
  decided() {
    const needed = (this.options.rounds + 1) / 2;
    const leader = this.score.findIndex((s) => s >= needed);
    if (leader !== -1) return { reason: 'rounds', winner: leader };
    if (this.rounds.length >= 2 * this.options.rounds) {
      const [a, b] = this.score;
      return { reason: 'limit', winner: a === b ? null : a > b ? 0 : 1 };
    }
    return null;
  }

  finish(reason, winner) {
    if (this.over) return;
    clearInterval(this.timer);
    // With the rounds won, for the list of finished matches.
    this.over = { reason, winner, score: this.score.slice() };
    this.onChange(this);
  }

  // The lobby forwards every message from a player here. Returns an error
  // message for the player, or null. Presses come often and are never
  // answered, even when they are of no use.
  handle(seat, action) {
    switch (action.action) {
      case 'press': return this.press(seat, action);
      case 'release': return this.release(seat, action);
      case 'resign': this.finish('resign', 1 - seat); return null;
      default: return 'Unknown action';
    }
  }

  acknowledge(seat, seq) {
    if (Number.isInteger(seq) && seq > this.acks[seat]) this.acks[seat] = seq;
  }

  // The button went down. `ph` is the swing phase the player saw: the
  // throw is taken there if that is no older than MAX_LAG, and no earlier
  // than the sword was taken up.
  press(seat, { seq, ph }) {
    this.acknowledge(seat, seq);
    this.held[seat] = true;
    if (this.over || this.paused || this.phase !== 'playing') return null;
    const p = this.world.fighters[seat];
    let phase;
    if (p.sword >= 0 && Number.isFinite(ph)) {
      const lo = Math.max(p.aimFrom, p.aimPh - AIM_SPEED * aimRate(p) * MAX_LAG);
      phase = Math.max(lo, Math.min(p.aimPh + AHEAD, ph));
    }
    if (press(this.world, seat, phase)) this.onChange(this);
    return null;
  }

  // The button came up: a fighter holding on to a wall leaps off it.
  release(seat, { seq }) {
    this.acknowledge(seat, seq);
    this.held[seat] = false;
    return null;
  }

  // The player left and did not come back in time.
  abandon(seat) {
    this.finish('abandoned', 1 - seat);
  }

  // The duel stops while a player is away, and starts again with a
  // countdown, so nobody is hit while they cannot answer.
  setConnected(seat, connected) {
    this.connected[seat] = connected;
    if (!connected) {
      this.held[seat] = false;
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

  // Everything the player in `seat` needs to draw the duel right now. A
  // spectator (`seat` is null) sees the same; nothing is hidden.
  snapshot(seat) {
    return {
      id: this.id,
      players: this.players,
      bots: this.bots,
      you: seat,
      options: this.options,
      map: this.map,
      phase: this.phase,
      phaseMsLeft: Math.max(0, Math.round(this.phaseMsLeft)),
      roundMsLeft: Math.max(0, Math.round(this.roundMsLeft)),
      paused: this.paused,
      score: this.score,
      // The rounds played, which the platform reads as moves: a match in
      // which no round was finished is not kept.
      moves: this.rounds,
      world: pack(this.world),
      held: this.held,
      acks: this.acks,
      connected: this.connected,
      spectators: this.spectators,
      over: this.over,
    };
  }
}
