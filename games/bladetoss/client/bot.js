// The bot's side of a game against the computer. The server runs the match
// as it does between two people; this plays the bot's seat from the browser
// of the player facing it, by sending that seat's presses marked `bot`. The
// thinking is in shared/bot.js, done on the world as this page shows it.

import { createBrain } from '../shared/bot.js';

// How often the brain is asked whether it has something to do.
const POLL_MS = 30;
// After a throw, how long the bot waits for the page to show its hands
// empty before it thinks again: its own presses are not predicted, so until
// then it would still see itself armed, and a second press would jump.
const THROW_SETTLE_MS = 400;

// The seat this browser plays for, or null: the bot's seat as seen by the
// player it faces. Spectators and finished games have nobody to play for.
function botSeat(game) {
  if (game.over || game.you === null || !game.bots) return null;
  const seat = game.bots.findIndex((bot, s) => bot && s !== game.you);
  return seat === -1 ? null : seat;
}

// `world()` gives the world as drawn now. Returns { update(snapshot),
// destroy() }; `update` takes every snapshot the game screen gets.
export function createBot(ctx, world) {
  let game = null;
  let brain = null; // { id, decide } for the match being played
  let timer = null;
  let last = 0;
  // The button is let go of on the next poll after each press, so that the
  // bot's seat is not left holding it (which would cling to every wall).
  let down = false;
  let threwAt = -Infinity;

  function think() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const seat = game && botSeat(game);
    if (seat === null) return;
    if (down) {
      down = false;
      ctx.send({ action: 'release', bot: true });
      return;
    }
    if (game.phase !== 'playing' || game.paused) return;
    const w = world();
    if (!w) return;
    if (w.fighters[seat].sword >= 0 && now - threwAt < THROW_SETTLE_MS) return;
    const decision = brain.decide(w, seat, dt);
    if (!decision) return;
    const armed = w.fighters[seat].sword >= 0;
    ctx.send({ action: 'press', ...(Number.isFinite(decision.ph) ? { ph: decision.ph } : {}), bot: true });
    down = true;
    if (armed) threwAt = now;
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
      // A rematch is a new match, with a fresh bot.
      if (!brain || brain.id !== game.id) brain = { id: game.id, ...createBrain(game.bots[seat].level) };
      if (!timer) {
        last = performance.now();
        timer = setInterval(think, POLL_MS);
      }
    },
    destroy() {
      clearInterval(timer);
    },
  };
}
