// The bot's side of a game against the computer. The server runs the match
// as it does between two people; this plays the bot's seat from the browser
// of the player facing it, by sending that seat's guesses marked `bot`. The
// thinking is in shared/bot.js. The bot needs nothing at the end of a round:
// the server counts it as ready for the next.

import { createBrain } from '../shared/bot.js';
import { maxGuesses } from '../shared/constants.js';
import { loadWords } from '../shared/words.js';

// How often the bot looks whether it is time to guess.
const POLL_MS = 200;
// A guess the server did not take is tried again after this long.
const RETRY_MS = 3000;

// The seat this browser plays for, or null: the bot's seat as seen by the
// player it faces. Spectators and finished games have nobody to play for.
function botSeat(game) {
  if (game.over || game.you === null || !game.bots) return null;
  const seat = game.bots.findIndex((bot, s) => bot && s !== game.you);
  return seat === -1 ? null : seat;
}

// Returns { update(snapshot), destroy() }; `update` takes every snapshot the
// game screen gets.
export function createBot(ctx) {
  let game = null;
  let brain = null; // { id, guess, thinkMs } for the match being played
  let timer = null;
  // When the next guess is due, and for which row; sent once per row.
  let due = null; // { round, row, at }

  function think() {
    const seat = game && botSeat(game);
    if (seat === null || !brain?.guess || game.phase !== 'playing') return;
    const rows = game.boards[seat];
    const { length } = game.options;
    if (rows.length >= maxGuesses(length)) return;
    const now = performance.now();
    const round = game.moves.length;
    if (!due || due.round !== round || due.row !== rows.length) {
      due = { round, row: rows.length, at: now + brain.thinkMs(rows, length) };
    }
    // No time passes for the bot while the game is paused.
    if (game.paused) due.at += POLL_MS;
    if (now < due.at) return;
    due.at = now + RETRY_MS;
    ctx.send({ action: 'guess', word: brain.guess(rows), bot: true });
  }

  return {
    update(snapshot) {
      game = snapshot;
      const seat = botSeat(game);
      if (seat === null) {
        clearInterval(timer);
        timer = null;
        return;
      }
      // A rematch is a new match, with a fresh bot. Its words come first.
      if (!brain || brain.id !== game.id) {
        const id = game.id;
        const { lang, length, hard } = game.options;
        brain = { id };
        due = null;
        loadWords(lang, length).then(({ answers }) => {
          if (brain.id === id) Object.assign(brain, createBrain(game.bots[seat].level, { answers, hard }));
        });
      }
      timer ??= setInterval(think, POLL_MS);
    },
    destroy() {
      clearInterval(timer);
    },
  };
}
