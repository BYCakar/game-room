// Builds the word lists in shared/words/ from the sources named in
// SOURCES.md. Not part of the site and not served; run it by hand after
// downloading the sources into one folder:
//
//   node games/wordrace/tools/build-words.js <folder with the sources>
//
// For each language and length it writes the answers (common words a round
// can be about) and the other words accepted as guesses.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LENGTHS } from '../shared/constants.js';
import { inAlphabet, normalise } from '../shared/alphabet.js';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node build-words.js <folder with the sources>');
  process.exit(1);
}
const OUT = new URL('../shared/words/', import.meta.url);
// At most this many answers per list, the most common first.
const MAX_ANSWERS = 2000;
// Answers must be among this many of the most common words in subtitles.
const ANSWER_RANK = 40000;
// Inflected Turkish words are accepted as guesses when seen this often.
const TR_MIN_COUNT = 10;

// Never the word of a round, though they may be guessed: rude words, slurs,
// and names the other filters let through.
const EXCLUDED = {
  en: 'anal anus arse bitch bitches bitchy boner boob boobs butt cock cocks coon crap crappy cunt cunts damn dick dicks dildo dyke fag fags faggot fart fuck fucks fucker gook gypsy hick homo horny jizz kike midget nazi nude nudes orgy paddy penis piss porn porno prick pube pubes puss pussy queer rape raped raper rapes rapist retard scrotum semen sex sexy shit shits slut sluts smut spic sperm tit tits titty tranny troy turd twat vagina wank whore whores',
  tr: 'amcık amına bok boktan dalyarak gavat göt götlek göte ibne kahpe kaltak meme orospu pezevenk piç puşt sik sikik sikiş siktir sürtük şerefsiz taşak yarak yarrak yavşak zıkkım zina',
};

const lines = (file) => readFileSync(join(src, file), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
// word -> rank (0 is the most common), from a FrequencyWords list.
function ranks(file, lang) {
  const rank = new Map();
  for (const line of lines(file)) {
    const word = normalise(line.split(' ')[0], lang);
    if (!rank.has(word)) rank.set(word, rank.size);
  }
  return rank;
}
// English: every word of ENABLE is a guess. The answers are those also in
// SCOWL's common words (up to its size 50), which are written in lower case
// there, so that names (berlin, tesla) are left out.
function english() {
  const enable = new Set(lines('enable1.txt').map((w) => normalise(w, 'en')).filter((w) => inAlphabet(w, 'en')));
  const common = new Set([10, 20, 35, 40, 50].flatMap((size) => ['english', 'american'].flatMap((list) => readFileSync(
    join(src, 'scowl', `${list}-words.${size}`), 'latin1').split('\n').map((l) => l.trim()))));
  const rank = ranks('en_50k.txt', 'en');
  const excluded = new Set(EXCLUDED.en.split(' '));
  // Plurals, -s verbs and past tenses of shorter words make dull answers.
  const derived = (w) => (w.endsWith('s') && !w.endsWith('ss') && (enable.has(w.slice(0, -1)) || (w.endsWith('es') && enable.has(w.slice(0, -2)))))
    || (w.endsWith('ed') && (enable.has(w.slice(0, -2)) || enable.has(w.slice(0, -1))));
  return LENGTHS.map((length) => {
    const guesses = [...enable].filter((w) => w.length === length);
    const answers = guesses.filter((w) => rank.get(w) < ANSWER_RANK && common.has(w) && !derived(w) && !excluded.has(w))
      .sort((a, b) => rank.get(a) - rank.get(b)).slice(0, MAX_ANSWERS);
    return { lang: 'en', length, answers, guesses };
  });
}

// Turkish: the lemmas of Zemberek's lexicon, and for guesses also the forms
// with suffixes seen in subtitles, kept only where the ending follows a
// lemma in vowel harmony, which leaves out most names and foreign words.
function turkish() {
  const FRONT = 'eiöü';
  const VOWELS = 'aıoueiöü';
  const lemmas = new Set();
  const answerable = new Set();
  for (const line of lines('master-dictionary.dict')) {
    const [head, tags = ''] = line.split(' [');
    const word = normalise(head, 'tr');
    if (tags.includes('Punc') || !word || !inAlphabet(word, 'tr')) continue;
    lemmas.add(word);
    if (!tags.includes('Interj') && !tags.includes('Dup')) answerable.add(word);
  }
  // The roots a suffix can follow: the lemma, a verb without -mek/-mak, and
  // either with its last consonant softened (kitap -> kitabı).
  const SOFT = { p: 'b', ç: 'c', t: 'd', k: 'ğ' };
  const roots = new Set();
  for (const lemma of lemmas) {
    const root = /m[ae]k$/.test(lemma) && lemma.length > 4 ? lemma.slice(0, -3) : lemma;
    roots.add(root);
    if (SOFT[root.at(-1)]) roots.add(root.slice(0, -1) + SOFT[root.at(-1)]);
  }
  const lastVowel = (s) => [...s].reverse().find((ch) => VOWELS.includes(ch));
  function inflected(word) {
    for (let k = Math.max(3, word.length - 4); k < word.length; k++) {
      const root = word.slice(0, k);
      const suffix = word.slice(k);
      const last = lastVowel(root);
      if (!roots.has(root) || !last) continue;
      const vowels = [...suffix].filter((ch) => VOWELS.includes(ch));
      // o and ö come in a suffix only in -yor.
      if (vowels.some((ch) => 'oö'.includes(ch)) && !suffix.includes('yor')) continue;
      const front = FRONT.includes(last);
      if (vowels.every((ch) => 'oö'.includes(ch) || FRONT.includes(ch) === front)) return true;
    }
    return false;
  }
  const english = new Set(lines('enable1.txt'));
  const extra = new Set();
  for (const line of lines('tr_full.txt')) {
    const [raw, count] = line.split(' ');
    if (Number(count) < TR_MIN_COUNT) break;
    const word = normalise(raw, 'tr');
    if (word.length >= LENGTHS[0] && word.length <= LENGTHS.at(-1) && inAlphabet(word, 'tr')
      && !lemmas.has(word) && !english.has(word) && inflected(word)) extra.add(word);
  }
  const rank = ranks('tr_50k.txt', 'tr');
  const excluded = new Set(EXCLUDED.tr.split(' '));
  return LENGTHS.map((length) => {
    const answers = [...answerable].filter((w) => w.length === length && rank.get(w) < ANSWER_RANK && !excluded.has(w))
      .sort((a, b) => rank.get(a) - rank.get(b)).slice(0, MAX_ANSWERS);
    const guesses = [...lemmas, ...extra].filter((w) => w.length === length);
    return { lang: 'tr', length, answers, guesses };
  });
}

for (const { lang, length, answers, guesses } of [...english(), ...turkish()]) {
  const chosen = new Set(answers);
  // The answers sorted, so the file says nothing of how common each is.
  const others = guesses.filter((w) => !chosen.has(w)).sort();
  const file = new URL(`${lang}${length}.js`, OUT);
  writeFileSync(file, `// Built by tools/build-words.js from the sources in tools/SOURCES.md; do not edit.\n`
    + `export default {\n  answers: '${[...answers].sort().join(' ')}',\n  guesses: '${others.join(' ')}',\n};\n`);
  console.log(`${lang}${length}: ${answers.length} answers, ${others.length} more guesses`);
}
