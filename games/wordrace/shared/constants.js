// The numbers of the game, shared by the server and the browser.

// How long the words are, and how many guesses each player has for one.
export const LENGTHS = [4, 5, 6, 7];
export const maxGuesses = (length) => length + 1;

// A match is the best of this many rounds, each with a new word.
export const ROUND_CHOICES = [1, 3, 5];

// The languages there are word lists for, by the name they go by in them.
export const LANGUAGES = { en: 'English', tr: 'Türkçe' };

// Before each round, the longest a round may last, and the time after it
// (showing both boards) before the next starts unless both say they are ready.
export const COUNTDOWN_MS = 3000;
export const ROUND_LIMIT_MS = 4 * 60_000;
export const RECAP_MS = 15_000;

// What a pattern is made of, one character per letter of the guess.
export const CORRECT = '2'; // the right letter in the right place
export const PRESENT = '1'; // in the word, but somewhere else
export const ABSENT = '0'; // not in the word (or not as many times)
