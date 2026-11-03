// Word Race on the server: the hints, hard mode, the word lists, a match
// stepped by hand, what each seat may see, the bot, and matches through
// the real lobby.

import test from 'node:test';
import assert from 'node:assert/strict';
import wordrace from '../server/index.js';
import { COUNTDOWN_MS, LANGUAGES, LENGTHS, RECAP_MS, ROUND_LIMIT_MS, maxGuesses } from '../shared/constants.js';
import { inAlphabet, normalise } from '../shared/alphabet.js';
import { hardModeError, score } from '../shared/feedback.js';
import { createBrain, fits } from '../shared/bot.js';
import { loadWords } from '../shared/words.js';
import { startServer } from '../../../server/index.js';
import { connect } from '../../../test/helpers.js';

test('hints, with letters more than once', () => {
  assert.equal(score('crane', 'crane'), '22222');
  assert.equal(score('geese', 'eagle'), '11002');
  // Only as many yellows as the word has letters left over.
  assert.equal(score('llama', 'hello'), '11000');
  assert.equal(score('sheep', 'sweet'), '20220');
  assert.equal(score('abbey', 'babes'), '11220');
});

test('Turkish letters and their capitals', () => {
  assert.equal(normalise('IŞIK', 'tr'), 'ışık');
  assert.equal(normalise('İNCİ', 'tr'), 'inci');
  assert.equal(normalise('kâr', 'tr'), 'kar');
  assert.equal(normalise('INCH', 'en'), 'inch');
  // The dotted and dotless i are different letters.
  assert.equal(score('kısa', 'kisa'), '2022');
  assert.ok(inAlphabet('çöğüşı', 'tr'));
  assert.ok(!inAlphabet('wqx', 'tr'));
});

test('hard mode', () => {
  const rows = [{ guess: 'crane', pattern: score('crane', 'cigar') }]; // 2 1 1 0 0
  assert.equal(hardModeError('cigar', rows), null);
  assert.match(hardModeError('rocks', rows), /Letter 1 must be c/);
  assert.match(hardModeError('cloth', rows), /must contain r|must contain a/);
  assert.equal(hardModeError('crane', []), null);
});

test('the word lists', async () => {
  for (const lang of Object.keys(LANGUAGES)) {
    for (const length of LENGTHS) {
      const { answers, guesses } = await loadWords(lang, length);
      const label = `${lang}${length}`;
      assert.ok(answers.length >= 500, `${label} has ${answers.length} answers`);
      assert.equal(new Set(answers).size, answers.length, `${label} answers are unique`);
      for (const word of guesses) {
        assert.equal([...word].length, length, `${label}: ${word}`);
        assert.ok(inAlphabet(word, lang), `${label}: ${word}`);
      }
      for (const word of answers) assert.ok(guesses.has(word));
    }
  }
});

test('invitation options and bots', () => {
  assert.deepEqual(wordrace.validateOptions({ lang: 'tr', length: 6, rounds: 3, hard: true, junk: 1 }),
    { options: { lang: 'tr', length: 6, rounds: 3, hard: true } });
  assert.deepEqual(wordrace.validateOptions({ lang: 'en', length: 5, rounds: 1, hard: 'yes' }).options.hard, false);
  for (const bad of [{}, { lang: 'de', length: 5, rounds: 1 }, { lang: 'en', length: 8, rounds: 1 },
    { lang: 'en', length: '5', rounds: 1 }, { lang: 'en', length: 5, rounds: 2 }, { lang: 'toString', length: 5, rounds: 1 }]) {
    assert.ok(wordrace.validateOptions(bad).error, JSON.stringify(bad));
  }
  assert.deepEqual(wordrace.validateBot({ level: 8 }), { bot: { level: 8 }, name: 'Computer level 8' });
  for (const bad of [{}, { level: 0 }, { level: 9 }, { level: 1.5 }]) assert.ok(wordrace.validateBot(bad).error);
});

// A match whose clock is stepped by the test rather than by a timer, with
// its first word chosen by the test.
function newMatch({ word = 'crane', rounds = 3, hard = false, lang = 'en', bots } = {}) {
  const changes = [];
  const match = wordrace.createMatch({
    players: ['ann', 'ben'], options: { lang, length: [...word].length, rounds, hard }, bots, onChange: (m) => changes.push(m.snapshot(0)),
  });
  clearInterval(match.timer);
  match.word = word;
  return { match, changes };
}

const go = (match) => match.advance(COUNTDOWN_MS);

test('a round: countdown, guesses, the winner', () => {
  const { match, changes } = newMatch();
  assert.match(match.handle(0, { action: 'guess', word: 'slate' }), /not started/);
  go(match);
  assert.equal(match.phase, 'playing');
  assert.equal(changes.length, 1);
  assert.match(match.handle(0, { action: 'guess', word: 'abc' }), /5 letters/);
  assert.match(match.handle(0, { action: 'guess', word: 'zzzzz' }), /word list/);
  assert.match(match.handle(0, { action: 'guess', word: 42 }), /Type a word/);
  assert.match(match.handle(0, { action: 'dance' }), /Unknown/);
  assert.equal(match.handle(0, { action: 'guess', word: 'SLATE' }), null);
  assert.deepEqual(match.boards[0], [{ guess: 'slate', pattern: '00202' }]);
  assert.equal(match.handle(1, { action: 'guess', word: 'crane' }), null);
  assert.equal(match.phase, 'recap');
  assert.deepEqual(match.score, [0, 1]);
  assert.equal(match.rounds[0].winner, 1);
  assert.equal(match.rounds[0].reason, 'solved');
  assert.match(match.handle(0, { action: 'guess', word: 'crane' }), /not started/);
  // Both ready, or the time up, and the next round starts with a new word.
  match.handle(0, { action: 'continue' });
  assert.equal(match.phase, 'recap');
  match.handle(1, { action: 'continue' });
  assert.equal(match.phase, 'countdown');
  assert.notEqual(match.word, 'crane');
  assert.deepEqual(match.boards, [[], []]);
});

test('out of guesses, a draw, and the round limit', () => {
  const { match } = newMatch();
  go(match);
  const wrong = ['slate', 'pious', 'dumpy', 'hello', 'world', 'magic'];
  for (const word of wrong) assert.equal(match.handle(0, { action: 'guess', word }), null);
  assert.match(match.handle(0, { action: 'guess', word: 'crane' }), /no guesses left/);
  assert.equal(match.phase, 'playing', 'the other player goes on');
  for (const word of wrong) match.handle(1, { action: 'guess', word });
  assert.equal(match.phase, 'recap');
  assert.deepEqual(match.rounds[0], { ...match.rounds[0], winner: null, reason: 'out' });
  assert.deepEqual(match.score, [0, 0]);

  match.advance(RECAP_MS);
  assert.equal(match.phase, 'countdown');
  go(match);
  match.advance(ROUND_LIMIT_MS - 1);
  assert.equal(match.phase, 'playing');
  match.advance(1);
  assert.equal(match.rounds[1].reason, 'time');
});

test('best of 3, and the cap of twice as many rounds', () => {
  const { match } = newMatch();
  for (let r = 0; r < 2; r++) {
    if (r) match.advance(RECAP_MS);
    go(match);
    match.handle(0, { action: 'guess', word: match.word });
  }
  assert.deepEqual(match.over, { reason: 'rounds', winner: 0, score: [2, 0] });

  const drawn = newMatch({ rounds: 1 }).match;
  for (let r = 0; r < 2; r++) {
    if (r) drawn.advance(RECAP_MS);
    go(drawn);
    drawn.advance(ROUND_LIMIT_MS);
  }
  assert.deepEqual(drawn.over, { reason: 'limit', winner: null, score: [0, 0] });
});

test('hard mode in a match', () => {
  const { match } = newMatch({ word: 'cigar', hard: true });
  go(match);
  match.handle(0, { action: 'guess', word: 'crane' });
  assert.match(match.handle(0, { action: 'guess', word: 'rocks' }), /Letter 1 must be C/);
  assert.equal(match.handle(0, { action: 'guess', word: 'cigar' }), null);
});

test('away, resigning and leaving', () => {
  const { match } = newMatch();
  go(match);
  match.setConnected(1, false);
  assert.match(match.handle(0, { action: 'guess', word: 'slate' }), /paused/);
  match.advance(ROUND_LIMIT_MS);
  assert.equal(match.phase, 'playing', 'no time passes');
  match.setConnected(1, true);
  match.handle(1, { action: 'resign' });
  assert.deepEqual(match.over, { reason: 'resign', winner: 0, score: [0, 0] });
  // The word of the round cut short is shown at the end.
  assert.equal(match.snapshot(null).word, 'crane');

  const left = newMatch().match;
  left.abandon(0);
  assert.equal(left.over.winner, 1);
});

test('nobody sees the word or the other letters while a round is on', () => {
  const { match } = newMatch();
  go(match);
  match.handle(0, { action: 'guess', word: 'slate' });
  match.handle(1, { action: 'guess', word: 'trace' });
  for (const seat of [0, 1, null]) {
    const text = JSON.stringify(match.snapshot(seat));
    assert.ok(!text.includes('crane'), `seat ${seat} cannot see the word`);
    assert.equal(match.snapshot(seat).word, undefined);
    if (seat !== 0) assert.ok(!text.includes('slate'), `seat ${seat} cannot see ann's letters`);
    if (seat !== 1) assert.ok(!text.includes('trace'), `seat ${seat} cannot see ben's letters`);
  }
  assert.deepEqual(match.snapshot(1).boards[0], [{ pattern: '00202' }]);
  assert.deepEqual(match.snapshot(0).boards[0], [{ guess: 'slate', pattern: '00202' }]);
  // Once it is over, everything is shown.
  match.handle(0, { action: 'guess', word: 'crane' });
  const after = match.snapshot(null);
  assert.equal(after.moves[0].word, 'crane');
  assert.equal(after.boards[1][0].guess, 'trace');
  assert.deepEqual(wordrace.preview(after), { score: [1, 0], length: 5, boards: [['00202', '22222'], ['02212']] });
});

test('a bot: its letters go to the player facing it, and it is always ready', () => {
  const { match } = newMatch({ bots: [null, { level: 3 }] });
  go(match);
  match.handle(1, { action: 'guess', word: 'trace' });
  assert.equal(match.snapshot(0).boards[1][0].guess, 'trace');
  assert.equal(match.snapshot(null).boards[1][0].guess, undefined);
  match.handle(1, { action: 'guess', word: 'crane' });
  assert.deepEqual(match.ready, [false, true]);
  match.handle(0, { action: 'continue' });
  assert.equal(match.phase, 'countdown');
});

test('the bot plays by the hints, and plays better the higher its level', async () => {
  for (const [lang, length] of [['en', 5], ['tr', 5], ['en', 7], ['tr', 6]]) {
    const { answers } = await loadWords(lang, length);
    const sample = answers.filter((_, i) => i % Math.floor(answers.length / 30) === 0).slice(0, 30);
    const average = (level, hard = false) => {
      let total = 0;
      let found = 0;
      // One brain for every word: it keeps nothing but its first guess.
      const brain = createBrain(level, { answers, hard });
      for (const word of sample) {
        const rows = [];
        while (rows.length < maxGuesses(length)) {
          const guess = brain.guess(rows);
          if (hard) assert.equal(hardModeError(guess, rows), null, `level ${level} keeps to hard mode`);
          if (level >= 3) assert.ok(fits(guess, rows) || level >= 8, `level ${level} guesses a word that fits`);
          rows.push({ guess, pattern: score(guess, word) });
          if (guess === word) {
            found++;
            break;
          }
        }
        total += rows.length;
      }
      return { found: found / sample.length, guesses: total / sample.length };
    };
    const weak = average(1);
    const strong = average(8);
    assert.ok(strong.found >= 0.9, `${lang}${length}: level 8 found ${strong.found}`);
    assert.ok(strong.found > weak.found, `${lang}${length}: level 8 beats level 1`);
    assert.ok(strong.guesses < average(3).guesses, `${lang}${length}: level 8 needs fewer guesses than level 3`);
    assert.ok(average(5, true).found >= 0.8);
  }
  const brain = createBrain(1, { answers: ['aaaa'], random: () => 0 });
  assert.ok(brain.thinkMs([], 5) >= 1500);
});

// Players connected to a real server, each with a name.
async function joined(server, ...names) {
  const clients = names.map(() => connect(server.port));
  await Promise.all(clients.map((c) => c.opened));
  clients.forEach((c, i) => c.send({ type: 'join', name: names[i] }));
  await Promise.all(clients.map((c) => c.next('joined')));
  return clients;
}

test('a match through the lobby', async (t) => {
  const server = await startServer({ port: 0 });
  t.after(() => server.close());
  const [ann, ben] = await joined(server, 'ann', 'ben');
  await ann.next('users', (m) => m.users.length === 2);
  ann.send({ type: 'invite', to: 'ben', game: 'wordrace', options: { lang: 'tr', length: 5, rounds: 1, hard: false } });
  const invite = await ben.next('invite');
  ben.send({ type: 'accept', id: invite.id });
  const [first] = await Promise.all([ann.next('match'), ben.next('match')]);
  assert.equal(first.snapshot.phase, 'countdown');
  assert.deepEqual(first.snapshot.boards, [[], []]);
  ann.send({ type: 'action', action: 'resign' });
  const last = await ann.next('match', (m) => m.snapshot.over);
  assert.equal(last.snapshot.over.reason, 'resign');
  assert.equal((await fetch(`http://localhost:${server.port}/games/wordrace/server/match.js`)).status, 404);
  assert.equal((await fetch(`http://localhost:${server.port}/games/wordrace/tools/build-words.js`)).status, 404);
  assert.equal((await fetch(`http://localhost:${server.port}/games/wordrace/shared/words/tr5.js`)).status, 200);
});

test('a match against the computer through the lobby', async (t) => {
  const server = await startServer({ port: 0 });
  t.after(() => server.close());
  const [cem] = await joined(server, 'cem');
  cem.send({ type: 'bot', game: 'wordrace', options: { lang: 'en', length: 5, rounds: 1, hard: false }, bot: { level: 2 }, seat: 0 });
  const { snapshot } = await cem.next('match');
  assert.deepEqual([snapshot.you, snapshot.bots, snapshot.players[1]], [0, [null, { level: 2 }], 'Computer level 2']);
  await new Promise((resolve) => setTimeout(resolve, COUNTDOWN_MS));
  await cem.next('match', (m) => m.snapshot.phase === 'playing');
  // The bot's seat guesses as told, and its letters come back to cem.
  cem.send({ type: 'action', action: 'guess', word: 'slate', bot: true });
  const after = await cem.next('match', (m) => m.snapshot.boards[1].length === 1);
  assert.equal(after.snapshot.boards[1][0].guess, 'slate');
  assert.equal(after.snapshot.boards[0].length, 0, 'the player did not guess');
  cem.send({ type: 'action', action: 'resign' });
  assert.equal((await cem.next('match', (m) => m.snapshot.over)).snapshot.over.winner, 1);
});
