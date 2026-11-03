// Word Race as the platform sees it. See games/README.md for the contract.

import meta from '../meta.js';
import { LANGUAGES, LENGTHS, ROUND_CHOICES } from '../shared/constants.js';
import { BOT_LEVELS } from '../shared/bot.js';
import { loadWords } from '../shared/words.js';
import { WordRaceMatch } from './match.js';

// Every list, read once at start-up.
const WORDS = {};
for (const lang of Object.keys(LANGUAGES)) {
  for (const length of LENGTHS) WORDS[`${lang}${length}`] = await loadWords(lang, length);
}

export default {
  meta,

  // Options are { lang, length, rounds, hard, unlimited }: words of `length`
  // letters in `lang`, the best of `rounds`, whether every hint must be used,
  // and whether there is no end to the guesses.
  validateOptions(options) {
    const { lang, length, rounds, hard, unlimited } = options;
    if (!Object.hasOwn(LANGUAGES, lang)) return { error: 'Choose English or Turkish.' };
    if (!LENGTHS.includes(length)) return { error: `Choose words of ${LENGTHS[0]} to ${LENGTHS.at(-1)} letters.` };
    if (!ROUND_CHOICES.includes(rounds)) return { error: `Choose the best of ${ROUND_CHOICES.join(', ')} rounds.` };
    return { options: { lang, length, rounds, hard: hard === true, unlimited: unlimited === true } };
  },

  // A bot is { level }, 1 (weakest) to 8; see shared/bot.js.
  validateBot(bot) {
    const { level } = bot;
    if (!Number.isInteger(level) || level < 1 || level > BOT_LEVELS) return { error: `Choose a level from 1 to ${BOT_LEVELS}.` };
    return { bot: { level }, name: `Computer level ${level}` };
  },

  createMatch: (args) => new WordRaceMatch({ ...args, words: WORDS[`${args.options.lang}${args.options.length}`] }),

  // The rounds won and the colours of this round's guesses, which a
  // spectator sees anyway.
  preview(snapshot) {
    return { score: snapshot.score, length: snapshot.options.length, boards: snapshot.boards.map((rows) => rows.map((r) => r.pattern)) };
  },
};
