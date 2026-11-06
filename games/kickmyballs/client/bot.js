// The bot's side of a match against the computer. The server runs the match
// as it does between two people; this plays the bot's seat from the browser
// of the player facing it, by sending that seat's inputs and kicks marked
// `bot`. The thinking is in shared/bot.js, done on the world as this page
// shows it.

import { createBrain } from '../shared/bot.js';

// How often the brain is asked what to do.
const POLL_MS = 30;
// After a kick, how long the bot waits before it may kick again: its own
// kicks are not predicted, so until a snapshot shows the boot swinging it
// would still see it at rest and kick twice.
const KICK_SETTLE_MS = 320;
const NONE = { left: false, right: false, jump: false };

// The seat this browser plays for, or null: the bot's seat as seen by the
// player it faces. Spectators and finished matches have nobody to play for.
export function botSeat(game) {
  if (!game || game.over || game.you === null || !game.bots) return null;
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
  let sent = { ...NONE }; // what the bot's seat is holding, as last sent
  let kickedAt = -Infinity;

  function hold(input) {
    if (input.left === sent.left && input.right === sent.right && input.jump === sent.jump) return;
    sent = input;
    ctx.send({ action: 'input', ...input, bot: true });
  }

  function think() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const seat = botSeat(game);
    if (seat === null) return;
    const w = world();
    if (!w || game.paused) {
      hold(NONE);
      return;
    }
    const decision = brain.decide(w, seat, dt);
    hold({ left: decision.left, right: decision.right, jump: decision.jump });
    if (decision.kick && w.players[seat].kickT < 0 && now - kickedAt > KICK_SETTLE_MS) {
      kickedAt = now;
      ctx.send({ action: 'kick', bot: true });
    }
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
      if (!brain || brain.id !== game.id) {
        brain = { id: game.id, ...createBrain(game.bots[seat].level) };
        sent = { ...NONE };
        kickedAt = -Infinity;
      }
      if (!timer) {
        last = performance.now();
        timer = setInterval(think, POLL_MS);
      }
    },
    destroy() {
      clearInterval(timer);
      timer = null;
    },
  };
}
