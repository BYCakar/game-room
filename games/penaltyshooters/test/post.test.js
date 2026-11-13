import test from 'node:test';
import assert from 'node:assert/strict';
import { ballPose, findFrameContact, flightBallPose } from '../shared/physics.js';
import { shotOutcome } from '../shared/rules.js';

const start = 1000, duration = 600;
const collision = (shot, from = start, to = start + duration) => findFrameContact({
  shot, flightStartedAt: start, flightMs: duration, fromAt: from, toAt: to,
});
const samples = [
  ['left', { x: .01, y: .5 }, 'goal'], ['left', { x: 0, y: .5 }, 'miss'],
  ['right', { x: .99, y: .5 }, 'goal'], ['right', { x: 1, y: .5 }, 'miss'],
  ['crossbar', { x: .5, y: .98 }, 'goal'], ['crossbar', { x: .5, y: 1 }, 'miss'],
];

test('both uprights and crossbar reflect physical impacts inward or outward according to contact angle', () => {
  for (const [post, shot, outcome] of samples) {
    const hit = collision(shot);
    assert.equal(hit?.post, post);
    assert.equal(hit.kind, 'post');
    assert.equal(hit.outcome, outcome);
    assert.equal(shotOutcome(shot, null, hit), outcome);
    const incoming = flightBallPose(shot, hit.at - start, duration);
    assert.equal(hit.x, incoming.centerX);
    assert.equal(hit.y, incoming.centerY);
    const before = incoming.vx * hit.normalX + incoming.vy * hit.normalY + 200 / .6 * hit.normalZ;
    const after = hit.vx * hit.normalX + hit.vy * hit.normalY + hit.vz * hit.normalZ;
    assert.ok(before < 0 && after > 0, 'the normal component reverses at the tube');
    assert.ok(Math.abs(after / -before - .68) < 1e-10, 'impact absorbs energy');
    if (post === 'crossbar') assert.ok(hit.vy > 0, 'the bar sends these shots down');
    else assert.ok(post === 'left' ? hit.vx > 0 : hit.vx < 0);
    assert.equal(hit.vz > 0, outcome === 'goal', 'these inward grazes continue into the net');
    if (outcome === 'goal') {
      assert.ok(hit.goalAt > hit.at);
      assert.ok(hit.target.x > 0 && hit.target.x < 1 && hit.target.y > 0 && hit.target.y < 1);
    } else assert.equal(hit.goalAt, null);
  }
});

test('frame collisions are swept at the same timestamps across timer granularities', () => {
  for (const [, shot] of samples) {
    const full = collision(shot);
    for (const step of [7, 17, 30, 61, 600]) {
      let found = null;
      for (let at = start; at < start + duration && !found; at += step) {
        found = collision(shot, at, Math.min(start + duration, at + step));
      }
      assert.deepEqual(found, full);
    }
  }
});

test('clear goals, clear misses and foreground screen overlaps never hit a post', () => {
  for (const shot of [{ x: .5, y: .5 }, { x: .04, y: .5 }, { x: .5, y: .94 },
    { x: -.15, y: .5 }, { x: 1.15, y: .5 }, { x: .5, y: 1.2 }]) {
    assert.equal(collision(shot), null);
  }
  assert.equal(collision({ x: 0, y: .5 }, start, start + 530), null, 'the flight is still in front of the goal');
  assert.equal(collision({ x: 0, y: .5, timeout: true }), null);
  assert.equal(collision({ x: 0, y: .5 }, start + duration + 1, start + duration + 500), null);
});

test('post rebounds stay continuous through impact, result and match end and keep moving', () => {
  for (const [, shot, outcome] of samples) {
    const hit = collision(shot);
    const pose = (now, phase = 'flight') => ballPose(phase, now - start, shot, outcome, null, now, duration, start, hit);
    const incoming = flightBallPose(shot, hit.at - start, duration);
    const at = pose(hit.at);
    assert.equal(at.x, incoming.x);
    assert.ok(Math.abs(at.y - incoming.y) < 1e-10);
    assert.equal(at.scale, incoming.scale);
    assert.equal(at.frame, incoming.frame);
    assert.ok(Math.hypot(pose(hit.at + 100).x - at.x, pose(hit.at + 100).y - at.y) > 10);
    const resolved = hit.goalAt ?? hit.at + 180;
    assert.deepEqual(pose(resolved), pose(resolved, 'result'));
    assert.deepEqual(pose(resolved + 500, 'result'), pose(resolved + 500, 'matchEnd'));
    if (hit.goalAt) {
      const before = pose(hit.goalAt - .001), after = pose(hit.goalAt);
      assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < .01, 'the net continuation cannot teleport');
    }
    for (const offset of [1, 100, 180, 500, 1500, 5000]) {
      for (const value of Object.values(pose(hit.at + offset, 'result'))) assert.ok(Number.isFinite(value));
    }
  }
});
