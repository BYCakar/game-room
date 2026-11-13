import test from 'node:test';
import assert from 'node:assert/strict';
import { kickWindow } from '../shared/scoreboard.js';

const goals = count => Array.from({ length: count }, (_, i) => i % 2 ? 'saved' : 'goal');

test('regulation penalties keep five shared columns including the current shot', () => {
  const game = { phase: 'shoot', shooter: 1, kicks: [goals(3), goals(2)] };
  assert.deepEqual(kickWindow(game), { start: 0, round: 3, suddenDeath: false,
    rows: [['goal', 'saved', 'goal', null, null], ['goal', 'saved', null, null, null]] });
  assert.equal(kickWindow({ phase: 'result', shooter: 0, kicks: [goals(5), goals(4)] }).round, 5);
});

test('sudden death reserves the rightmost slot for the current paired round', () => {
  for (const round of [6, 7, 10, 25]) {
    const before = { phase: 'shoot', shooter: 0, kicks: [goals(round - 1), goals(round - 1)] };
    const start = round - 5;
    const window = kickWindow(before);
    assert.equal(window.start, start);
    assert.equal(window.suddenDeath, true);
    assert.deepEqual(window.rows, [0, 1].map(() => [...goals(round - 1).slice(-4), null]));
    const firstResult = { phase: 'result', shooter: 0, kicks: [goals(round), goals(round - 1)] };
    const reply = { ...firstResult, phase: 'shoot', shooter: 1 };
    assert.deepEqual(kickWindow(reply), kickWindow(firstResult), 'the second player answers in the same column');
    assert.equal(kickWindow(reply).rows[1][4], null);
    const final = { phase: 'result', shooter: 1, kicks: [goals(round), goals(round)] };
    assert.equal(kickWindow(final).start, start, 'the finished pair remains visible until the next round');
    assert.deepEqual(kickWindow({ ...final, phase: 'matchEnd' }), kickWindow(final));
    assert.equal(kickWindow({ ...final, phase: 'shoot', shooter: 0 }).start, start + 1);
  }
});
