// The grids of tiles and the on-screen keyboard. A tile shows a letter (or
// none, for the other player's guesses during a round) in the colour its
// hint earned.

import { el } from '/js/kit/dom.js';
import { display, KEYBOARDS } from '../shared/alphabet.js';
import { ABSENT, CORRECT, PRESENT } from '../shared/constants.js';

export const TILE_CLASS = { [CORRECT]: 'correct', [PRESENT]: 'present', [ABSENT]: 'absent' };
const RANK = { correct: 3, present: 2, absent: 1 };
const HINT = { correct: 'in its place', present: 'in the word, elsewhere', absent: 'not in the word' };

// Draws a board into `node`: `rows` are { guess?, pattern }, followed by
// `typing` (the row being written) and empty rows up to `guesses`.
// `small` draws it smaller, as the other player's. With `scroll` (no end to
// the guesses) it is no taller than `guesses` rows and scrolls beyond them.
export function drawBoard(node, { rows, typing = null, length, guesses, lang, small = false, shake = false, scroll = false }) {
  node.className = `wordraceBoard${small ? ' small' : ''}${scroll ? ' scroll' : ''}`;
  node.style.setProperty('--length', length);
  node.style.setProperty('--rows', guesses);
  const line = (letters, pattern, extra = '') => el('div', { className: `wordraceRow ${extra}`.trim() },
    ...Array.from({ length }, (_, i) => {
      const ch = letters?.[i];
      const state = pattern ? TILE_CLASS[pattern[i]] : ch ? 'typed' : '';
      return el('span', {
        className: `wordraceTile ${state}`,
        textContent: ch ? display(ch, lang) : '',
        title: pattern ? HINT[state] : '',
      });
    }));
  const drawn = rows.map((r) => line(r.guess && [...r.guess], r.pattern));
  if (typing !== null) drawn.push(line([...typing], null, `typing${shake ? ' shake' : ''}`));
  while (drawn.length < guesses) drawn.push(line(null, null));
  node.replaceChildren(...drawn);
}

// The keyboard of `lang`, with Enter and Backspace; `onKey` hears a letter,
// 'enter' or 'back'. Returns { node, colour(rows), disable(on) }.
export function createKeyboard(lang, onKey) {
  const keys = new Map();
  const key = (value, label, className = '') => {
    const button = el('button', {
      type: 'button',
      className: `wordraceKey ${className}`.trim(),
      textContent: label,
      // Not focusable by the mouse, so Enter on the real keyboard never
      // presses the last key clicked.
      onmousedown: (e) => e.preventDefault(),
      onclick: () => onKey(value),
    });
    if (value.length === 1) keys.set(value, button);
    return button;
  };
  const rows = KEYBOARDS[lang].map((letters) => [...letters].map((ch) => key(ch, display(ch, lang))));
  rows[2].unshift(key('enter', 'Enter', 'wide'));
  rows[2].push(key('back', '⌫', 'wide back'));
  const node = el('div', { className: 'wordraceKeyboard' }, ...rows.map((r) => el('div', { className: 'wordraceKeyRow' }, ...r)));
  return {
    node,
    // Each key in the best colour its letter has earned in `rows`.
    colour(guessRows) {
      const best = new Map();
      for (const { guess, pattern } of guessRows) {
        if (!guess) continue;
        [...guess].forEach((ch, i) => {
          const state = TILE_CLASS[pattern[i]];
          if (!best.has(ch) || RANK[state] > RANK[best.get(ch)]) best.set(ch, state);
        });
      }
      for (const [ch, button] of keys) button.className = `wordraceKey ${best.get(ch) ?? ''}`.trim();
    },
    disable(disabled) {
      for (const button of node.querySelectorAll('button')) button.disabled = disabled;
    },
  };
}
