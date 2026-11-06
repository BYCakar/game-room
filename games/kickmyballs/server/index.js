// KickMyBalls as the platform sees it. See games/README.md for the contract.

import meta from '../meta.js';
import { LENGTH_CHOICES } from '../shared/constants.js';
import { BOT_LEVELS } from '../shared/bot.js';
import { KickMyBallsMatch } from './match.js';

export default {
  meta,

  // Options are { length, powerUps }: the match lasts `length` seconds of
  // play, with power-ups appearing unless `powerUps` is false.
  validateOptions(options) {
    const { length, powerUps = true } = options ?? {};
    if (!LENGTH_CHOICES.includes(length)) return { error: `Choose a match of ${LENGTH_CHOICES.join(', ')} seconds.` };
    if (typeof powerUps !== 'boolean') return { error: 'Power-ups are either on or off.' };
    return { options: { length, powerUps } };
  },

  // A bot is { level }, 1 (weakest) to 8; see shared/bot.js.
  validateBot(bot) {
    const { level } = bot ?? {};
    if (!Number.isInteger(level) || level < 1 || level > BOT_LEVELS) return { error: `Choose a level from 1 to ${BOT_LEVELS}.` };
    return { bot: { level }, name: `Computer level ${level}` };
  },

  createMatch: (args) => new KickMyBallsMatch(args),

  // The score: what changes seldom enough to be sent to everyone looking at
  // the list. Where the players and the ball are is not.
  preview(snapshot) {
    return { score: snapshot.score };
  },
};
