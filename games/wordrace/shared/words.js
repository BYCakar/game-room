// The word lists, one module per language and length in words/, loaded
// when first asked for so that a browser fetches only the one it plays.

const cache = new Map();

// { answers, guesses }: the words a round can be about, in an array, and
// every word accepted as a guess (the answers too), in a set.
export function loadWords(lang, length) {
  const key = `${lang}${length}`;
  if (!cache.has(key)) {
    cache.set(key, import(`./words/${key}.js`).then(({ default: list }) => {
      const answers = list.answers.split(' ');
      return { answers, guesses: new Set([...answers, ...list.guesses.split(' ').filter(Boolean)]) };
    }));
  }
  return cache.get(key);
}
