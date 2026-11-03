// One Word Race in progress: both players guess the same secret word, which
// only the server knows, and the first to find it takes the round. Each sees
// the colours of the other's guesses as they come, but not the letters,
// until the round is over.

import { randomInt, randomUUID } from 'node:crypto';
import { COUNTDOWN_MS, RECAP_MS, ROUND_LIMIT_MS, guessLimit } from '../shared/constants.js';
import { display, inAlphabet, normalise } from '../shared/alphabet.js';
import { hardModeError, score, solved } from '../shared/feedback.js';

// The clock is looked at this often; it changes the phase, nothing more.
const TICK_MS = 200;

export class WordRaceMatch {
  // `players` holds one name per seat and `options` is what validateOptions
  // returned. `bots` says, per seat, which level of bot plays it (or null);
  // its guesses arrive like anyone's, from the browser of the player it
  // faces. `words` is the list for the options' language and length:
  // { answers, guesses }. `onChange(match)` fires after anything the
  // players should see.
  constructor({ players, options, bots, words, onChange }) {
    this.id = randomUUID();
    this.players = players;
    this.options = options;
    this.bots = bots ?? players.map(() => null);
    this.words = words;
    this.onChange = onChange;
    this.score = players.map(() => 0);
    // The rounds played: { word, boards, winner, reason }, `winner` null when
    // nobody found the word.
    this.rounds = [];
    this.used = new Set();
    this.connected = players.map(() => true);
    this.spectators = 0;
    this.over = null;
    this.startRound();
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }

  startRound() {
    // A word not had yet in this match (and any, once they have all been).
    let pool = this.words.answers.filter((w) => !this.used.has(w));
    if (!pool.length) pool = this.words.answers;
    this.word = pool[randomInt(pool.length)];
    this.used.add(this.word);
    // Each player's guesses this round: { guess, pattern }.
    this.boards = this.players.map(() => []);
    this.roundMsLeft = ROUND_LIMIT_MS;
    this.phase = 'countdown';
    this.phaseMsLeft = COUNTDOWN_MS;
    this.ready = this.players.map(() => false);
  }

  get paused() {
    return this.connected.some((c) => !c);
  }

  tick() {
    const now = Date.now();
    const elapsed = now - this.lastTickAt;
    this.lastTickAt = now;
    this.advance(elapsed);
  }

  // `ms` of match time going by. None does while a player is away. The
  // browsers count the time down themselves, so only a new phase is sent.
  advance(ms) {
    if (this.over || this.paused) return;
    if (this.phase === 'countdown') {
      this.phaseMsLeft -= ms;
      if (this.phaseMsLeft > 0) return;
      this.phase = 'playing';
      this.phaseMsLeft = 0;
    } else if (this.phase === 'playing') {
      this.roundMsLeft -= ms;
      if (this.roundMsLeft > 0) return;
      this.roundMsLeft = 0;
      this.endRound(null, 'time');
    } else {
      this.phaseMsLeft -= ms;
      if (this.phaseMsLeft > 0) return;
      this.startRound();
    }
    if (!this.over) this.onChange(this);
  }

  // The lobby forwards every message from a player here. Returns an error
  // message for the player, or null.
  handle(seat, action) {
    switch (action.action) {
      case 'guess': return this.guess(seat, action.word);
      case 'continue': return this.continue(seat);
      case 'resign': this.finish('resign', 1 - seat); return null;
      default: return 'Unknown action';
    }
  }

  guess(seat, text) {
    if (this.over) return 'The match is over';
    if (this.paused) return 'The game is paused';
    if (this.phase !== 'playing') return 'The round has not started';
    const board = this.boards[seat];
    const { lang, length, hard } = this.options;
    const limit = guessLimit(this.options);
    if (board.length >= limit) return 'You have no guesses left';
    if (typeof text !== 'string') return 'Type a word';
    const word = normalise(text, lang);
    if ([...word].length !== length) return `Guess a word of ${length} letters`;
    if (!inAlphabet(word, lang) || !this.words.guesses.has(word)) return 'Not in the word list';
    if (hard) {
      const error = hardModeError(word, board, (s) => display(s, lang));
      if (error) return error;
    }
    const pattern = score(word, this.word);
    board.push({ guess: word, pattern });
    if (solved(pattern)) this.endRound(seat, 'solved');
    else if (this.boards.every((b) => b.length >= limit)) this.endRound(null, 'out');
    if (!this.over) this.onChange(this);
    return null;
  }

  // After a round, the next starts as soon as both players say they are
  // ready. A bot always is.
  continue(seat) {
    if (this.over || this.phase !== 'recap') return null;
    this.ready[seat] = true;
    if (this.ready.every(Boolean)) this.startRound();
    this.onChange(this);
    return null;
  }

  endRound(winner, reason) {
    this.rounds.push({ word: this.word, boards: this.boards, winner, reason });
    if (winner !== null) this.score[winner]++;
    this.phase = 'recap';
    this.phaseMsLeft = RECAP_MS;
    this.ready = this.bots.map(Boolean);
    // The best of N is won with more than half of them. Rounds that nobody
    // won do not count, but a match does not go on for more than twice N.
    const needed = (this.options.rounds + 1) / 2;
    const leader = this.score.findIndex((s) => s >= needed);
    if (leader !== -1) this.finish('rounds', leader);
    else if (this.rounds.length >= 2 * this.options.rounds) {
      const [a, b] = this.score;
      this.finish('limit', a === b ? null : a > b ? 0 : 1);
    }
  }

  finish(reason, winner) {
    if (this.over) return;
    clearInterval(this.timer);
    // With the rounds won, for the list of finished matches.
    this.over = { reason, winner, score: this.score.slice() };
    this.onChange(this);
  }

  // The player left and did not come back in time.
  abandon(seat) {
    this.finish('abandoned', 1 - seat);
  }

  // The clocks stop while a player is away, and nobody can guess.
  setConnected(seat, connected) {
    this.connected[seat] = connected;
    this.onChange(this);
  }

  setSpectators(count) {
    this.spectators = count;
    this.onChange(this);
  }

  // What the player in `seat` may see. The word and the letters of the
  // other player's guesses are left out while the round is being played;
  // only their colours are sent. A spectator (`seat` null) sees colours
  // only for both. The one exception: the browser of a player facing a bot
  // plays the bot, and needs its letters.
  snapshot(seat) {
    const live = this.phase !== 'recap' && !this.over;
    const sees = (s) => !live || s === seat || (seat !== null && Boolean(this.bots[s]));
    return {
      id: this.id,
      players: this.players,
      bots: this.bots,
      you: seat,
      options: this.options,
      phase: this.phase,
      phaseMsLeft: Math.max(0, Math.round(this.phaseMsLeft)),
      roundMsLeft: Math.max(0, Math.round(this.roundMsLeft)),
      paused: this.paused,
      score: this.score,
      ready: this.ready,
      // This round's word, once it is over (or the match is, in the middle
      // of a round).
      ...(live ? {} : { word: this.word }),
      // This round's guesses, as far as this seat may see them.
      boards: this.boards.map((rows, s) => (sees(s) ? rows : rows.map(({ pattern }) => ({ pattern })))),
      // The rounds played, words and all; the platform reads them as moves,
      // and a match in which no round was finished is not kept.
      moves: this.rounds,
      connected: this.connected,
      spectators: this.spectators,
      over: this.over,
    };
  }
}
