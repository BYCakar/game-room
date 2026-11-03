// The letters of each language, its keyboard, and the one place where
// typed text becomes a word of the lists. Words are kept in lower case;
// Turkish has a dotted and a dotless i (i/İ and ı/I), so the case is always
// changed by the Turkish rules, never by the default ones.

export const ALPHABETS = {
  en: 'abcdefghijklmnopqrstuvwxyz',
  tr: 'abcçdefgğhıijklmnoöprsştuüvyz',
};

// The rows of the on-screen keyboard: QWERTY, and the Turkish Q layout
// without the Q, W and X it has no words with.
export const KEYBOARDS = {
  en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  tr: ['ertyuıopğü', 'asdfghjklşi', 'zcvbnmöç'],
};

const locale = (lang) => (lang === 'tr' ? 'tr' : 'en');
// Turkish writes a few loanwords with a circumflex (kâr, millî); the lists
// and the keyboard do without.
const PLAIN = { â: 'a', î: 'i', û: 'u' };

// Typed or listed text as a word of `lang`, in lower case.
export function normalise(text, lang) {
  const lower = String(text).trim().toLocaleLowerCase(locale(lang));
  return lang === 'tr' ? lower.replace(/[âîû]/g, (ch) => PLAIN[ch]) : lower;
}

// A letter or word as it is shown: in capitals.
export const display = (text, lang) => text.toLocaleUpperCase(locale(lang));

// Whether `word` is made only of the letters of `lang`.
export const inAlphabet = (word, lang) => [...word].every((ch) => ALPHABETS[lang].includes(ch));
