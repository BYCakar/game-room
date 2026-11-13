import test from 'node:test';
import assert from 'node:assert/strict';
import { netResponse, netDisplacement, NET_RIPPLE_MS } from '../client/net.js';

const game = { phase: 'result', outcome: 'goal', shot: { x: .8, y: .7 }, contact: null,
  flightStartedAt: 1000, flightDurationMs: 600, phaseStartedAt: 1600 };
const bounds = { left: 190, right: 608, top: 26, bottom: 165 };

test('netting responds only to a goal reaching it, never a save, miss or timed-out shot', () => {
  assert.equal(netResponse(game, 1700), null, 'the ball is still travelling into the net');
  assert.ok(netResponse(game, 1830));
  for (const changed of [{ outcome: 'saved' }, { outcome: 'miss' }, { contact: { at: 1600 } },
    { shot: { ...game.shot, timeout: true } }, { phase: 'shoot' }, { phase: 'flight' }]) {
    assert.equal(netResponse({ ...game, ...changed }, 1830), null);
  }
});

test('ripple uses the flight clock across match end, pause and a resumed view', () => {
  const expected = netResponse(game, 1830);
  assert.deepEqual(netResponse({ ...game, phase: 'matchEnd', phaseStartedAt: 1830 }, 1830), expected);
  assert.deepEqual(netResponse({ ...game, phaseStartedAt: 1830 }, 1830), expected);
  assert.deepEqual(netResponse({ ...game, flightStartedAt: 11000, phaseStartedAt: 11600 }, 11830), expected);
});

test('a goal rebounding off a post uses its new target and later goal crossing', () => {
  const target = { x: .25, y: .65 };
  const postGoal = { ...game, frameContact: { kind: 'post', outcome: 'goal', target, at: 1550, goalAt: 2100 } };
  assert.equal(netResponse(postGoal, 2200), null, 'the rebound has not reached the net yet');
  const expected = netResponse({ ...game, shot: target, flightStartedAt: 1500 }, 2330);
  assert.deepEqual(netResponse(postGoal, 2330), expected);
  assert.ok(expected.x < netResponse(game, 1830).x, 'the impact follows the deflected target');
  assert.deepEqual(netResponse({ ...postGoal, phase: 'matchEnd', phaseStartedAt: 2300 }, 2330), expected);
  assert.deepEqual(netResponse({ ...postGoal, frameContact: { ...postGoal.frameContact, at: 11550, goalAt: 12100 } }, 12330), expected);
  assert.equal(netResponse({ ...postGoal, outcome: 'miss' }, 2330), null);
});

test('net attachments and fabric far from the impact remain still', () => {
  const impact = { x: 520, y: 90, ageMs: 80, strength: 1 };
  for (const [x, y] of [[bounds.left, 90], [bounds.right, 90], [520, bounds.top], [520, bounds.bottom], [220, 90]]) {
    assert.deepEqual(netDisplacement(x, y, bounds, impact), { x: 0, y: 0 });
  }
  const moved = netDisplacement(520, 90, bounds, impact);
  assert.ok(Math.abs(moved.y) > 1 && Math.abs(moved.y) < 8, 'local displacement is visible but gentle');
});

test('an impact makes a damped oscillation, then leaves no residual deformation', () => {
  const impact = { x: 520, y: 90, strength: 1 };
  const first = netDisplacement(520, 90, bounds, { ...impact, ageMs: 70 });
  const rebound = netDisplacement(520, 90, bounds, { ...impact, ageMs: 210 });
  const later = netDisplacement(520, 90, bounds, { ...impact, ageMs: 350 });
  assert.ok(first.y > 0 && rebound.y < 0 && later.y > 0);
  assert.ok(Math.abs(later.y) < Math.abs(first.y));
  for (const ageMs of [-1, 0, NET_RIPPLE_MS, 5000]) assert.deepEqual(netDisplacement(520, 90, bounds, { ...impact, ageMs }), { x: 0, y: 0 });
  assert.equal(netResponse(game, 1760 + NET_RIPPLE_MS), null);
});
