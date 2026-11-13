import test from 'node:test';
import assert from 'node:assert/strict';
import { targetOf, shotOutcome, shootoutWinner } from '../shared/rules.js';

test('aim permits a miss beyond either post or over the bar, never malformed coordinates', () => {
  for (const target of [{ x: -0.15, y: 0 }, { x: 1.15, y: 1.2 }, { x: 0.5, y: 0.5 }]) assert.deepEqual(targetOf(target), target);
  for (const target of [null, {}, { x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: '0.5', y: 0 }, { x: -0.16, y: 0 }, { x: 1.16, y: 0 }, { x: 0, y: -0.1 }, { x: 0, y: 1.21 }]) assert.equal(targetOf(target), null);
  assert.equal(targetOf({ x: -0.1, y: 0.5 }, true), null);
  assert.equal(targetOf({ x: 0.5, y: 1.1 }, true), null);
  for (const shot of [{ x: -0.01, y: 0.5 }, { x: 1.01, y: 0.5 }, { x: 0.5, y: 1.01 }, { x: 0.5, y: 0.5, timeout: true }]) assert.equal(shotOutcome(shot, null), 'miss');
});

test('only an actual keeper contact saves a shot, never a matching clicked target', () => {
  assert.equal(shotOutcome({ x: 0.12, y: 0.8 }, { kind: 'keeper' }), 'saved');
  assert.equal(shotOutcome({ x: 0.12, y: 0.8 }, { x: 0.12, y: 0.8 }), 'goal');
  assert.equal(shotOutcome({ x: 0.12, y: 0.8 }, { x: 0.88, y: 0.8 }), 'goal');
  assert.equal(shotOutcome({ x: 0.5, y: 0.5 }, null), 'goal');
});

test('early victory accounts for unequal kicks; sudden death always gives the opponent an answer', () => {
  const goals = (n) => Array(n).fill('goal');
  const misses = (n) => Array(n).fill('miss');
  assert.equal(shootoutWinner([goals(3), misses(2)]), null);
  assert.equal(shootoutWinner([goals(3), misses(3)]), 0);
  assert.equal(shootoutWinner([misses(3), goals(3)]), 1);
  assert.equal(shootoutWinner([goals(5), goals(5)]), null);
  assert.equal(shootoutWinner([goals(6), goals(5)]), null);
  assert.equal(shootoutWinner([goals(6), [...goals(5), 'saved']]), 0);
  assert.equal(shootoutWinner([[...goals(5), 'miss'], goals(5)]), null);
  assert.equal(shootoutWinner([[...goals(5), 'miss'], goals(6)]), 1);
  assert.equal(shootoutWinner([misses(8), misses(8)]), null);
});
