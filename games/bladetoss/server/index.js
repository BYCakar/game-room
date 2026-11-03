// Blade Toss as the platform sees it. See games/README.md for the contract.

import meta from '../meta.js';
import { ROUND_CHOICES } from '../shared/constants.js';
import { BOT_LEVELS } from '../shared/bot.js';
import { BladeTossMatch } from './match.js';

export default {
  meta,

  // Options are { rounds }: the match is the best of that many.
  validateOptions(options) {
    const { rounds } = options ?? {};
    if (!ROUND_CHOICES.includes(rounds)) return { error: `Choose the best of ${ROUND_CHOICES.join(', ')} rounds.` };
    return { options: { rounds } };
  },

  // A bot is { level }, 1 (weakest) to 8; see shared/bot.js.
  validateBot(bot) {
    const { level } = bot ?? {};
    if (!Number.isInteger(level) || level < 1 || level > BOT_LEVELS) return { error: `Choose a level from 1 to ${BOT_LEVELS}.` };
    return { bot: { level }, name: `Computer level ${level}` };
  },

  createMatch: (args) => new BladeTossMatch(args),

  // The arena and the rounds won: what changes seldom enough to be sent to
  // everyone looking at the list. Where the fighters are is not.
  preview(snapshot) {
    return { map: snapshot.map, score: snapshot.score };
  },
};
