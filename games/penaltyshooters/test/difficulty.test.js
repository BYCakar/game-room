import test from 'node:test';
import assert from 'node:assert/strict';
import { difficulty, keeperCompetenceMix, saveGrowthForRate, tournamentProfile } from '../shared/difficulty.js';
import { chooseBotShot, chooseKeeperRead, planKeeperAction } from '../shared/bot-strategy.js';
import { findKeeperContact } from '../shared/physics.js';

const seeded = seed => () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const times = { now: 0, flightStartedAt: 1400, flightMs: 600, turnStartedAt: 0, turnId: 1, bot: true };
const hitFor = (shot, plan, timing) => findKeeperContact({ ...timing, shot,
  save: { ...plan.target, at: plan.at }, fromAt: timing.flightStartedAt, toAt: timing.flightStartedAt + timing.flightMs });

test('two knockout rounds advance one level while all group fixtures retain the requested base', () => {
  for (const global of [false, true]) {
    const stages = global ? ['group', 'round32', 'round16', 'quarter', 'semi', 'final']
      : ['group', 'round16', 'quarter', 'semi', 'final'];
    const increases = global ? [0, 0, 1, 1, 2, 2] : [0, 0, 1, 1, 2];
    for (let base = 1; base <= 8; base++) {
      for (let fixture = 1; fixture <= 3; fixture++) {
        const group = tournamentProfile(base, 'group', global);
        assert.equal(group.baseLevel, base);
        assert.equal(group.level, base);
        assert.equal(group.overtimeSteps, 0);
        assert.equal(group.saveMultiplier, 1);
      }
      stages.forEach((stage, index) => {
        const profile = tournamentProfile(base, stage, global);
        const effective = base + increases[index];
        assert.equal(profile.level, Math.min(8, effective));
        assert.equal(profile.overtimeSteps, Math.max(0, effective - 8));
        assert.equal(profile.increase, increases[index]);
        assert.equal(profile.baseLevel, base);
      });
    }
  }
});

test('relative save growth uses five percent through 80%, then three percent above it', () => {
  assert.equal(saveGrowthForRate(.5), .05);
  assert.equal(saveGrowthForRate(.8), .05);
  assert.equal(saveGrowthForRate(.80001), .03);
  assert.equal(saveGrowthForRate(.874), .03);
  for (const [stage, step] of [['group', 0], ['quarter', 1], ['final', 2]]) {
    const profile = tournamentProfile(8, stage);
    assert.equal(profile.overtimeSteps, step);
    assert.equal(profile.saveMultiplier, 1.03 ** step);
  }
});

test('starting at eight reveals the final target 400 ms before the boot with ten percent reductions', () => {
  for (const global of [false, true]) {
    const group = tournamentProfile(8, 'group', global);
    const firstExtra = tournamentProfile(8, global ? 'round16' : 'quarter', global);
    const final = tournamentProfile(8, 'final', global);
    assert.ok(Math.abs(firstExtra.aimLeadMs / group.aimLeadMs - .9) < 1e-12);
    assert.ok(Math.abs(final.aimLeadMs / firstExtra.aimLeadMs - .9) < 1e-12);
    assert.ok(Math.abs(final.aimLeadMs - 400) < 1e-10);
  }
  let previous = Infinity;
  for (let level = 1; level <= 8; level++) {
    const profile = tournamentProfile(level, 'group');
    assert.ok(profile.aimLeadMs < previous && profile.aimLeadMs >= 490 && profile.aimLeadMs <= 800);
    previous = profile.aimLeadMs;
  }
});

test('a zero-overtime profile keeps every existing level decision and RNG stream unchanged', () => {
  for (let level = 1; level <= 8; level++) {
    const numberRandom = seeded(100 + level), profileRandom = seeded(100 + level);
    const profile = tournamentProfile(level, 'group');
    for (let i = 0; i < 100; i++) {
      const shot = { x: i % 2 ? .12 : .88, y: i % 3 ? .8 : .3 };
      const repeats = i % 5;
      const numeric = chooseKeeperRead(shot, level, numberRandom, repeats);
      const structured = chooseKeeperRead(shot, profile, profileRandom, repeats);
      assert.deepEqual(structured, numeric);
      assert.deepEqual(planKeeperAction({ ...times, decision: structured, level: profile, random: profileRandom }),
        planKeeperAction({ ...times, decision: numeric, level, random: numberRandom }));
      assert.deepEqual(chooseBotShot(profile, profileRandom), chooseBotShot(level, numberRandom));
    }
  }
});

test('competent-attempt mixing preserves both explicit mistakes and physical reach limits', () => {
  const shot = { x: .12, y: .8 };
  for (const steps of [1, 2, 100]) {
    const profile = difficulty({ level: 8, overtimeSteps: steps });
    const mix = keeperCompetenceMix(profile, 4);
    assert.ok(mix > 0 && mix <= .95);
    for (const [roll, expected] of [[0, 'wrong-corner'], [.01, 'short-reach']]) {
      const draws = [.999, roll];
      const decision = chooseKeeperRead(shot, profile, () => draws.length ? draws.shift() : .5, 4);
      assert.equal(decision.kind, expected);
      assert.equal(decision.competent, undefined);
    }
  }
  const profile = difficulty({ level: 8, overtimeSteps: 2 });
  const competent = chooseKeeperRead(shot, profile, () => 0);
  assert.equal(competent.competent, true);
  assert.deepEqual(competent.target, shot);
  const timely = planKeeperAction({ ...times, decision: competent, level: profile, random: () => 0 });
  assert.equal(timely.jitterMs, 0);
  assert.ok(hitFor(shot, timely, times));
  const lateTimes = { ...times, now: 1960 };
  const late = planKeeperAction({ ...lateTimes, decision: competent, level: profile, random: () => 0 });
  assert.ok(late);
  assert.equal(hitFor(shot, late, lateTimes), null, 'a competent read cannot bypass travel time and body collision');
});

test('overtime targets approximately 3% more physical saves per step across mixed and repeated corners', t => {
  const count = 4000, source = seeded(2026);
  const mixed = Array.from({ length: count }, (_, i) => ({
    x: i % 5 === 0 ? .35 + source() * .3 : source() < .5 ? .05 + source() * .35 : .6 + source() * .35,
    y: .1 + source() * .84,
  }));
  const results = {};
  for (const [name, shots, repeats] of [
    ['mixed', mixed, 0], ['highRepeated', Array(count).fill({ x: .12, y: .8 }), 4],
    ['lowRepeated', Array(count).fill({ x: .88, y: .3 }), 4],
  ]) {
    const rates = [];
    for (const overtimeSteps of [0, 1, 2]) {
      const profile = difficulty({ level: 8, overtimeSteps }), random = seeded(110);
      let saved = 0, errors = 0;
      for (let i = 0; i < count; i++) {
        const timing = { ...times, turnId: i + 1 }, shot = shots[i];
        const decision = chooseKeeperRead(shot, profile, random, repeats);
        if (decision.kind !== 'read') errors++;
        const plan = planKeeperAction({ ...timing, decision, level: profile, random });
        const contact = hitFor(shot, plan, timing);
        if (contact) {
          assert.equal(contact.kind, 'keeper');
          // A central ball may hit the standing keeper before its planned dive.
          assert.ok(contact.at >= timing.flightStartedAt && contact.at <= timing.flightStartedAt + timing.flightMs);
          saved++;
        }
      }
      rates.push(saved / count);
      assert.ok(errors > 20, 'the calibrated increase retains an explicit error floor');
    }
    assert.ok(rates[0] < rates[1] && rates[1] < rates[2], `${name}: ${rates}`);
    for (const step of [1, 2]) assert.ok(Math.abs(rates[step] - rates[0] * 1.03 ** step) < .016, `${name}: ${rates}`);
    results[name] = rates;
  }
  t.diagnostic(JSON.stringify({ samplesPerScenario: count, physicalSaveRates: results }));
});
