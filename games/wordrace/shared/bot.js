// The computer's guesses, at 8 levels. It knows only what a player knows:
// its own guesses and their colours, and the list of words a round can be
// about. Weaker bots heed only some of the hints and pick among the words
// left at random; stronger ones choose the guess that splits the words left
// best, and all of them think for less time the stronger they are. Shared
// so that the tests can play it; the browser runs it (see client/bot.js).

import { ABSENT, CORRECT } from './constants.js';
import { hardModeError, score } from './feedback.js';

export const BOT_LEVELS = 8;

// Seconds a bot takes over a guess at each level, before a random spread.
const THINK_SECONDS = [26, 21, 17, 14, 11, 8, 6, 4.5];
// The most patterns worked out for one guess; beyond it the words are sampled.
const WORK = 150_000;

// Whether `word` could be the answer after `rows`, heeding only `heed` of
// the hints: 'all', or 'greens' (letters in their place), or 'some' (those
// and the letters that are not in the word).
export function fits(word, rows, heed = 'all') {
  return rows.every(({ guess, pattern }) => {
    if (heed === 'all') return score(guess, word) === pattern;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === CORRECT && word[i] !== guess[i]) return false;
      // A grey letter that is not also green or yellow elsewhere in the guess.
      if (heed === 'some' && pattern[i] === ABSENT && word.includes(guess[i])
        && ![...guess].some((ch, j) => ch === guess[i] && pattern[j] !== ABSENT)) return false;
    }
    return true;
  });
}

// `count` of `items` picked at random, or all of them if there are fewer.
function sample(items, count, random) {
  if (items.length <= count) return items;
  const copy = items.slice();
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// The word left whose letters are the most common among the words left, in
// their places and anywhere, each letter counted once.
function commonest(candidates) {
  const at = candidates[0].length;
  const anywhere = new Map();
  const placed = Array.from({ length: at }, () => new Map());
  for (const w of candidates) {
    for (const ch of new Set(w)) anywhere.set(ch, (anywhere.get(ch) || 0) + 1);
    [...w].forEach((ch, i) => placed[i].set(ch, (placed[i].get(ch) || 0) + 1));
  }
  const value = (w) => [...new Set(w)].reduce((sum, ch) => sum + anywhere.get(ch), 0)
    + [...w].reduce((sum, ch, i) => sum + placed[i].get(ch), 0);
  return candidates.reduce((best, w) => (value(w) > value(best) ? w : best));
}

// The guess among `pool` that tells the most about which of `candidates` is
// the answer: the one whose patterns over them have the most entropy. A
// candidate wins a tie, since it might be the answer itself.
export function bestSplit(pool, candidates, random) {
  const guesses = sample(pool, Math.max(20, Math.floor(WORK / Math.min(candidates.length, 1000))), random);
  const against = sample(candidates, Math.max(50, Math.floor(WORK / guesses.length)), random);
  const isCandidate = new Set(candidates);
  let best = null;
  let bestValue = -Infinity;
  for (const guess of guesses) {
    const counts = new Map();
    for (const answer of against) {
      const p = score(guess, answer);
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    let entropy = 0;
    for (const n of counts.values()) entropy -= (n / against.length) * Math.log2(n / against.length);
    const value = entropy + (isCandidate.has(guess) ? 0.01 : 0);
    if (value > bestValue) [best, bestValue] = [guess, value];
  }
  return best;
}

// { guess(rows), thinkMs(rows) } for a bot of `level` playing with `answers`
// (the words a round can be about); `hard` is the match's hard mode.
export function createBrain(level, { answers, hard = false, random = Math.random }) {
  const allowed = (w, rows) => !hard || hardModeError(w, rows) === null;
  // The first guess of the strong bots, worked out once per match.
  let opener = null;

  function guess(rows) {
    const tried = new Set(rows.map((r) => r.guess));
    const heed = level <= 1 ? 'greens' : level <= 2 ? 'some' : 'all';
    let candidates = answers.filter((w) => !tried.has(w) && fits(w, rows, heed) && allowed(w, rows));
    // Hints heeded in part can leave nothing, or a word against hard mode.
    if (!candidates.length) candidates = answers.filter((w) => !tried.has(w) && fits(w, rows) && allowed(w, rows));
    if (!candidates.length) candidates = answers.filter((w) => !tried.has(w) && allowed(w, rows));
    if (!candidates.length) return answers[Math.floor(random() * answers.length)];
    if (level <= 3 || candidates.length <= 2) return candidates[Math.floor(random() * candidates.length)];
    if (level === 4) return commonest(sample(candidates, 4, random));
    if (level <= 6) return commonest(candidates);
    if (!rows.length) {
      opener ??= level >= 8 ? bestSplit(answers, answers, random) : commonest(answers);
      return opener;
    }
    // The strongest bot may try a word that cannot be the answer, if it
    // tells more; in hard mode it may not.
    const pool = level >= 8 && !hard && candidates.length > 3 ? answers.filter((w) => !tried.has(w)) : candidates;
    return bestSplit(pool, candidates, random);
  }

  // How long the bot takes over its next guess.
  function thinkMs(rows, length) {
    const seconds = THINK_SECONDS[level - 1] * (0.7 + 0.6 * random()) * (rows.length ? 1 : 0.6) + (length - 5);
    return Math.max(1500, seconds * 1000);
  }

  return { guess, thinkMs };
}
