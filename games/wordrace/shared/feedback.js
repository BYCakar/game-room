// The hints a guess earns, and the rule of hard mode. Shared by the server,
// which gives the hints, and the browser's bot, which reads them.

import { ABSENT, CORRECT, PRESENT } from './constants.js';

// The pattern of `guess` against `answer`, both words of the same length: a
// string with CORRECT, PRESENT or ABSENT for each letter. A letter is marked
// PRESENT only as many times as the answer has it beyond the CORRECT ones,
// from the left: "geese" against "eagle" is 1 1 0 0 2.
export function score(guess, answer) {
  const result = Array(guess.length).fill(ABSENT);
  const left = new Map();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) result[i] = CORRECT;
    else left.set(answer[i], (left.get(answer[i]) || 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    const n = left.get(guess[i]);
    if (result[i] === CORRECT || !n) continue;
    result[i] = PRESENT;
    left.set(guess[i], n - 1);
  }
  return result.join('');
}

export const solved = (pattern) => [...pattern].every((p) => p === CORRECT);

// In hard mode every hint must be used: a letter found in its place stays
// there, and a letter found in the word is in every later guess (as many
// times as it was found). Returns why `guess` breaks the rule, with letters
// shown by `show`, or null. `rows` are the player's earlier { guess, pattern }.
export function hardModeError(guess, rows, show = (s) => s) {
  for (const { guess: before, pattern } of rows) {
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === CORRECT && guess[i] !== before[i]) return `Letter ${i + 1} must be ${show(before[i])}`;
    }
    const needed = new Map();
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] !== ABSENT) needed.set(before[i], (needed.get(before[i]) || 0) + 1);
    }
    for (const [letter, n] of needed) {
      if ([...guess].filter((ch) => ch === letter).length < n) return `The guess must contain ${show(letter)}`;
    }
  }
  return null;
}
