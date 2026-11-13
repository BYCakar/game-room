import { randomUUID } from 'node:crypto';
import { getLeague, getTeam, normalizeTeam } from '../shared/teams.js';
import { SHOOT_MS, KEEPER_MS, FLIGHT_MS, RESULT_MS, SAVE_PHASES, targetOf, shotOutcome, shootoutWinner } from '../shared/rules.js';
import { createTournament, completeFixture, tournamentSnapshot } from '../shared/tournament.js';
import { findKeeperContact, findFrameContact } from '../shared/physics.js';
import { tournamentProfile } from '../shared/difficulty.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

// The server owns the series, deadlines and tournament. The browser sends
// an aim/release and a keeper dive, never a goal or a claimed reaction time.
export class PenaltyShootersMatch {
  constructor({ players, options, bots, onChange, rand = Math.random, now = Date.now, timings = {}, contactFinder = findKeeperContact }) {
    this.id = randomUUID();
    this.players = players.slice();
    this.bots = bots ?? [null, null];
    this.humanSeat = this.bots.findIndex((bot) => !bot);
    this.botSeat = this.bots.findIndex(Boolean);
    this.difficultyProfile = this.botSeat < 0 ? null : tournamentProfile(this.bots[this.botSeat].level, 'group');
    this.difficultyLevel = this.difficultyProfile?.level ?? null;
    // An invitation has two people even if a modified client requested a
    // tournament in its options. Such a match always uses custom teams.
    this.options = this.botSeat < 0 ? { mode: 'duel', teamId: 'custom' } : { ...options };
    this.onChange = onChange;
    this.rand = rand;
    this.now = now;
    this.contactFinder = contactFinder;
    this.timings = { shoot: SHOOT_MS, keeper: KEEPER_MS, flight: FLIGHT_MS, result: RESULT_MS, ...timings };
    this.connected = [true, true];
    this.spectators = 0;
    this.over = null;
    this.teams = [null, null];
    this.ready = this.bots.map(Boolean);
    this.phase = 'setup';
    this.phaseMsLeft = 0;
    this.serverTime = now();
    this.phaseStartedAt = this.serverTime;
    this.turnStartedAt = this.serverTime;
    this.flightStartedAt = null;
    this.aimRevealAt = null;
    this.lastTickAt = this.serverTime;
    this.turnId = 0;
    this.shooter = 0;
    this.score = [0, 0];
    this.kicks = [[], []];
    this.shot = null;
    this.save = null;
    this.contact = null;
    this.frameContact = null;
    this.outcome = null;
    this.moves = [];
    this.matchHistory = [];
    this.matchResult = null;
    this.tournament = null;
    this.timer = setInterval(() => this.tick(), 30);
    this.timer.unref();
  }

  get paused() { return this.connected.some((connected) => !connected); }
  get deadline() { return this.phaseMsLeft > 0 ? this.serverTime + this.phaseMsLeft : null; }

  tick() {
    const at = this.now();
    const elapsed = Math.max(0, at - this.lastTickAt);
    this.lastTickAt = at;
    this.advance(elapsed);
  }

  // Deterministic advancement also makes the short save window testable
  // without sleeps. Wall-clock time keeps moving during a paused game, while
  // every phase retains precisely the time it had remaining.
  advance(ms) {
    if (!Number.isFinite(ms) || ms <= 0 || this.over) return;
    if (this.paused) {
      this.serverTime += ms;
      this.phaseStartedAt += ms;
      this.turnStartedAt += ms;
      if (this.flightStartedAt !== null) this.flightStartedAt += ms;
      if (this.aimRevealAt !== null) this.aimRevealAt += ms;
      if (this.save) this.save.at += ms;
      if (this.contact) this.contact.at += ms;
      if (this.frameContact) {
        this.frameContact.at += ms;
        if (this.frameContact.goalAt !== null) this.frameContact.goalAt += ms;
      }
      return;
    }
    let left = ms;
    while (left > 0 && !this.over) {
      if (this.phaseMsLeft <= 0) { this.serverTime += left; break; }
      const elapsed = Math.min(left, this.phaseMsLeft);
      const fromAt = this.serverTime;
      this.serverTime += elapsed;
      this.phaseMsLeft -= elapsed;
      left -= elapsed;
      if (this.phase === 'flight') this.detectContact(fromAt, this.serverTime);
      if (this.phaseMsLeft > 0) { if (left > 0) continue; break; }
      this.phaseExpired();
      if (!this.over) this.onChange(this);
    }
  }

  enter(phase) {
    this.phase = phase;
    this.phaseStartedAt = this.serverTime;
    this.phaseMsLeft = this.timings[phase] ?? 0;
  }

  phaseExpired() {
    if (this.phase === 'shoot') {
      this.shot = { x: 0.5, y: 1.2, timeout: true };
      this.enterFlight();
    } else if (this.phase === 'keeper') this.enterFlight();
    else if (this.phase === 'flight') this.recordKick();
    else if (this.phase === 'result') {
      const winner = shootoutWinner(this.kicks);
      if (winner === null) this.startKick(1 - this.shooter);
      else this.endShootout(winner);
    }
  }

  startShootout() {
    this.score = [0, 0];
    this.kicks = [[], []];
    this.matchResult = null;
    if (this.tournament) {
      this.difficultyProfile = tournamentProfile(this.bots[this.botSeat].level, this.tournament.stage, this.tournament.teams.length === 48);
      this.difficultyLevel = this.difficultyProfile.level;
      const fixture = this.tournament.current;
      const rivalId = fixture.home === this.tournament.playerTeamId ? fixture.away : fixture.home;
      this.teams[this.botSeat] = clone(this.tournament.teams.find((team) => team.id === rivalId));
    }
    // Alternate who goes first between fixtures; seat order is already
    // randomized by the lobby for a duel.
    this.startKick(this.matchHistory.length % 2);
  }

  startKick(seat) {
    this.shooter = seat;
    this.turnId++;
    this.shot = null;
    this.save = null;
    this.contact = null;
    this.frameContact = null;
    this.flightStartedAt = null;
    this.aimRevealAt = null;
    this.outcome = null;
    this.enter('shoot');
    this.turnStartedAt = this.serverTime;
  }

  enterFlight() {
    this.enter('flight');
    this.flightStartedAt = this.serverTime;
  }

  detectContact(fromAt, toAt) {
    if (this.contact || this.frameContact || !this.shot || this.shot.timeout) return;
    const input = {
      shot: this.shot, save: this.save, turnStartedAt: this.turnStartedAt, turnId: this.turnId,
      bot: Boolean(this.bots[1 - this.shooter]), flightStartedAt: this.flightStartedAt,
      flightMs: this.timings.flight, fromAt, toAt,
    };
    const contact = this.contactFinder(input);
    const frameContact = findFrameContact(input);
    if (frameContact && (!contact || frameContact.at < contact.at)) {
      this.frameContact = frameContact;
      // Let the rebound be seen before awarding a goal or a miss. Keep the
      // original flight duration for pre-impact rendering and collision.
      const resolvedAt = frameContact.goalAt ?? frameContact.at + 180;
      this.phaseMsLeft = Math.max(this.phaseMsLeft, resolvedAt - this.serverTime);
      this.onChange(this);
      return;
    }
    if (!contact) return;
    this.contact = contact;
    this.outcome = 'saved';
    // Collision is an event of its own: clients can bounce the ball and play
    // the save sound at the contact timestamp, before the result banner.
    this.onChange(this);
  }

  recordKick() {
    // An aimed dive is not a save. Only a ball/body intersection, detected
    // along the actual animated trajectory, can prevent an on-target goal.
    this.outcome = shotOutcome(this.shot, this.contact, this.frameContact);
    if (this.outcome === 'goal') this.score[this.shooter]++;
    this.kicks[this.shooter].push(this.outcome);
    this.moves.push({
      match: this.matchHistory.length + 1, turnId: this.turnId, seat: this.shooter,
      shot: clone(this.shot), save: clone(this.save), contact: clone(this.contact), frameContact: clone(this.frameContact), outcome: this.outcome,
      score: this.score.slice(), at: this.serverTime,
    });
    this.enter('result');
  }

  endShootout(winner) {
    this.matchResult = {
      winner, score: this.score.slice(), teams: clone(this.teams), kicks: clone(this.kicks),
      stage: this.tournament?.stage ?? 'duel', round: this.tournament?.round ?? 1,
      difficultyLevel: this.difficultyLevel,
      difficultyProfile: clone(this.difficultyProfile),
    };
    this.matchHistory.push(clone(this.matchResult));
    this.enter('matchEnd');
    if (!this.tournament) { this.finish('penalties', winner); return; }
    const playerScore = [this.score[this.humanSeat], this.score[this.botSeat]];
    completeFixture(this.tournament, playerScore, this.rand);
    if (this.tournament.champion) this.finish('champion', this.humanSeat);
    else if (this.tournament.eliminated) this.finish('eliminated', this.botSeat);
  }

  handle(seat, action) {
    if (seat !== 0 && seat !== 1) return 'You are not playing in this match.';
    if (!action || typeof action !== 'object') return 'Unknown action.';
    // Check elapsed server time before accepting a dive. A save arriving
    // after its deadline cannot sneak in between two timer callbacks.
    this.tick();
    if (this.over) return 'The match is over.';
    if (action.action === 'resign') { this.finish('resign', 1 - seat); return null; }
    if (this.paused) return 'The match is paused.';
    switch (action.action) {
      case 'ready': return this.setReady(seat, action.team);
      case 'shoot': return this.shoot(seat, action);
      case 'save': return this.dive(seat, action);
      case 'next-match':
        if (!this.tournament || seat !== this.humanSeat || this.phase !== 'matchEnd') return 'There is no next match yet.';
        this.startShootout(); this.onChange(this); return null;
      default: return 'Unknown action.';
    }
  }

  setReady(seat, input) {
    if (this.phase !== 'setup') return 'The teams are already set.';
    if (this.bots[seat]) return null;
    let team;
    if (this.botSeat >= 0 && this.options.teamId !== 'custom') {
      team = getTeam(this.options.leagueId, this.options.teamId);
    } else {
      if (input && (Object.hasOwn(input, 'id') || Object.hasOwn(input, 'teamId') || Object.hasOwn(input, 'leagueId'))) {
        return 'Use your own custom team.';
      }
      team = normalizeTeam(input);
      if (team) team = { ...team, id: `custom-${seat}` };
    }
    if (!team) return 'Choose a valid team name, colours and shirt pattern.';
    this.teams[seat] = clone(team);
    this.ready[seat] = true;
    if (this.ready.every(Boolean)) {
      if (this.botSeat >= 0) {
        this.tournament = createTournament(getLeague(this.options.leagueId).teams, this.teams[this.humanSeat], this.rand);
      }
      this.startShootout();
    }
    this.onChange(this);
    return null;
  }

  shoot(seat, action) {
    if (this.phase !== 'shoot' || seat !== this.shooter) return 'Wait for your shot.';
    if (action.turnId !== this.turnId) return 'This shot belongs to an earlier turn.';
    const target = targetOf(action);
    if (!target) return 'Aim inside the shooting area.';
    this.shot = target;
    this.enter('keeper');
    this.aimRevealAt = this.bots[seat]
      ? this.serverTime + Math.max(0, this.timings.keeper - this.difficultyProfile.aimLeadMs)
      : this.serverTime + (this.botSeat < 0 ? Math.max(0, this.timings.keeper - 600) : 0);
    this.onChange(this);
    return null;
  }

  dive(seat, action) {
    if (!SAVE_PHASES.includes(this.phase) || seat === this.shooter || this.phaseMsLeft <= 0 || this.contact || this.frameContact) return 'The save window is closed.';
    if (action.turnId !== this.turnId) return 'This save belongs to an earlier turn.';
    if (this.save) return 'Your dive is already committed.';
    const target = targetOf(action, true);
    if (!target) return 'Dive inside the goal.';
    // reactionMs measures time within the phase in which the player clicked;
    // it is diagnostic only. The server-owned at timestamp drives animation.
    this.save = { ...target, at: this.serverTime, reactionMs: this.serverTime - this.phaseStartedAt };
    // The dive is visible immediately and persists across phase changes.
    // It does not shorten either the run-up or the ball's flight.
    this.onChange(this);
    return null;
  }

  finish(reason, winner) {
    if (this.over) return;
    clearInterval(this.timer);
    this.phaseMsLeft = 0;
    this.over = { reason, winner, score: this.score.slice() };
    this.onChange(this);
  }

  abandon(seat) { if (seat === 0 || seat === 1) this.finish('abandoned', 1 - seat); }

  setConnected(seat, connected) {
    this.tick();
    this.connected[seat] = Boolean(connected);
    this.onChange(this);
  }

  setSpectators(count) {
    this.spectators = count;
    this.onChange(this);
  }

  snapshot(seat) {
    const reveal = this.phase !== 'setup' && this.phase !== 'shoot';
    return {
      id: this.id, players: this.players.slice(), you: seat, options: { ...this.options }, bots: clone(this.bots),
      over: clone(this.over), teams: clone(this.teams), ready: this.ready.slice(),
      phase: this.phase, shooter: this.shooter, turnId: this.turnId,
      score: this.score.slice(), kicks: clone(this.kicks),
      shot: reveal ? clone(this.shot) : null, save: clone(this.save), contact: clone(this.contact), frameContact: clone(this.frameContact),
      outcome: ['result', 'matchEnd'].includes(this.phase) || (this.phase === 'flight' && this.contact) ? this.outcome : null,
      deadline: this.deadline, serverTime: this.serverTime, serverDate: new Date(this.serverTime).toISOString(),
      phaseStartedAt: this.phaseStartedAt, turnStartedAt: this.turnStartedAt, phaseMsLeft: Math.max(0, this.phaseMsLeft),
      difficultyLevel: this.difficultyLevel, aimRevealAt: this.aimRevealAt,
      difficultyBoost: this.difficultyProfile?.overtimeSteps ?? 0, difficultyProfile: clone(this.difficultyProfile),
      flightStartedAt: this.flightStartedAt, flightDurationMs: this.timings.flight, runupDurationMs: this.timings.keeper,
      paused: this.paused, connected: this.connected.slice(), spectators: this.spectators,
      moves: clone(this.moves), matchHistory: clone(this.matchHistory), matchResult: clone(this.matchResult),
      tournament: tournamentSnapshot(this.tournament),
    };
  }
}
