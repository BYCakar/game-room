# Where the word lists come from

`shared/words/<lang><length>.js` are written by `build-words.js` from the files below. To rebuild, download them into one folder, keeping the names given, and run `node games/wordrace/tools/build-words.js <folder>`.

| File | Source | Licence | Used for |
| --- | --- | --- | --- |
| `enable1.txt` | ENABLE2K, as at <https://github.com/dolph/dictionary> | Public domain | English guesses; leaving English words out of the Turkish ones |
| `scowl/` | The `final/` folder of SCOWL 2020.12.07, <http://wordlist.aspell.net/> | Permissive (Kevin Atkinson's licence, below) | English answers must be among its `english-words` and `american-words` up to size 50 |
| `en_50k.txt`, `tr_50k.txt`, `tr_full.txt` | FrequencyWords 2018 (from OpenSubtitles), <https://github.com/hermitdave/FrequencyWords> | Content CC-BY-SA-4.0, by Hermit Dave | How common a word is: answers are the most common ones; Turkish forms with suffixes seen at least 10 times are guesses |
| `master-dictionary.dict` | Zemberek-NLP, `morphology/src/main/resources/tr/master-dictionary.dict`, <https://github.com/ahmetaa/zemberek-nlp> | Apache-2.0, Ahmet A. Akın and Mehmet D. Akın | Turkish lemmas: the answers, and the roots that suffixed guesses must start with |

No word list of any other word game was used.

## What the build does

- **English:** every ENABLE word of the length is a guess. The answers are the most common ones (at most 2000) that SCOWL has in lower case, so that names are left out. Plurals, -s verbs and -ed forms of shorter words are left out too, as are rude words and slurs.
- **Turkish:** the lemmas of Zemberek's lexicon are guesses. Words from the subtitles count as guesses too, if they start with a lemma (a verb without -mek/-mak, or with the last consonant softened) and their ending follows its vowel harmony. Answers are lemmas only, the most common ones (at most 2000), and never interjections or rude words. Circumflexes are dropped (kâr is kar).
- An answer list is sorted alphabetically, so it says nothing about how common each word is.

## SCOWL's licence

> Copyright 2000-2018 by Kevin Atkinson
>
> Permission to use, copy, modify, distribute and sell these word lists, the associated scripts, the output created from the scripts, and its documentation for any purpose is hereby granted without fee, provided that the above copyright notice appears in all copies and that both that copyright notice and this permission notice appear in supporting documentation. Kevin Atkinson makes no representations about the suitability of this array for any purpose. It is provided "as is" without express or implied warranty.
