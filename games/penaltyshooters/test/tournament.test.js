import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUES, DEFAULT_TEAM, getLeague } from '../shared/teams.js';
import { createTournament, completeFixture, tournamentSnapshot } from '../shared/tournament.js';

const unchangedOrder = () => 0.99999;

for (const count of [32, 48]) {
  test(`${count} teams: unique groups, full round robin, a valid knockout draw and champion`, () => {
    const teams = LEAGUES.find((league) => league.teams.length === count).teams;
    const t = createTournament(teams, teams[0], unchangedOrder);
    assert.equal(t.groups.length, count / 4);
    assert.equal(new Set(t.groups.flatMap((group) => group.teams)).size, count);
    const rivals = [];
    for (let i = 0; i < 3; i++) {
      rivals.push(t.current.home === t.playerTeamId ? t.current.away : t.current.home);
      completeFixture(t, [3, 0], () => 0.5);
    }
    assert.equal(new Set(rivals).size, 3);
    assert.equal(t.history.length, count * 3 / 2);
    for (const group of t.groups) {
      assert.ok(group.table.every((row) => row.played === 3));
      assert.equal(group.table.reduce((total, row) => total + row.points, 0), 18);
    }
    const draw = t.bracket[0].matches;
    assert.equal(draw.length, count === 32 ? 8 : 16);
    assert.equal(new Set(draw.flatMap((m) => [m.home, m.away])).size, draw.length * 2);
    const groupOf = (id) => t.groups.find((group) => group.teams.includes(id)).id;
    assert.ok(draw.every((fixture) => groupOf(fixture.home) !== groupOf(fixture.away)));
    while (t.current) completeFixture(t, [3, 0], () => 0.5);
    assert.equal(t.champion, teams[0].id);
    assert.equal(t.stage, 'complete');
    assert.deepEqual(t.bracket.map((round) => round.matches.length), count === 32 ? [8, 4, 2, 1] : [16, 8, 4, 2, 1]);
    assert.equal(t.history.length, count * 3 / 2 + (count === 32 ? 15 : 31));
    assert.throws(() => completeFixture(t, [3, 0]), /no fixture/);
    const view = tournamentSnapshot(t);
    view.groups[0].table[0].points = -999;
    assert.notEqual(t.groups[0].table[0].points, -999, 'snapshots cannot mutate the running tournament');
  });
}

test('a custom club replaces one entrant, without duplicating a selected original club', () => {
  const teams = getLeague('england').teams;
  const own = { ...DEFAULT_TEAM, id: 'custom-0' };
  const t = createTournament(teams, own, unchangedOrder);
  assert.equal(t.teams.length, 32);
  assert.equal(t.teams.filter((team) => team.id === own.id).length, 1);
  assert.equal(t.teams.some((team) => team.id === teams[0].id), false);
  const original = createTournament(teams, teams[15], unchangedOrder);
  assert.equal(new Set(original.teams.map((team) => team.id)).size, 32);
});

test('three group losses eliminate the club; knockout loss ends its cup immediately', () => {
  const teams = getLeague('england').teams;
  const t = createTournament(teams, teams[0], unchangedOrder);
  for (let i = 0; i < 3; i++) completeFixture(t, [0, 3], () => 0.5);
  assert.equal(t.eliminated, true);
  assert.equal(t.current, null);
  const knockout = createTournament(teams, teams[0], unchangedOrder);
  for (let i = 0; i < 3; i++) completeFixture(knockout, [3, 0], () => 0.5);
  completeFixture(knockout, [0, 3], () => 0.5);
  assert.equal(knockout.stage, 'eliminated');
  assert.equal(knockout.bracket.length, 1);
});

test('the Global Cup ranks third places across groups instead of advancing all twelve', () => {
  const teams = getLeague('global').teams;
  for (const goodDifference of [true, false]) {
    const t = createTournament(teams, teams[0], unchangedOrder);
    for (const score of goodDifference ? [[5, 0], [4, 5], [4, 5]] : [[1, 0], [0, 5], [0, 5]]) completeFixture(t, score, () => 0.5);
    assert.equal(t.groups[0].table[2].teamId, teams[0].id, 'the player finishes third');
    assert.equal(t.stage, goodDifference ? 'round32' : 'eliminated');
    if (goodDifference) {
      const qualified = new Set(t.bracket[0].matches.flatMap((m) => [m.home, m.away]));
      assert.equal(t.groups.filter((group) => qualified.has(group.table[2].teamId)).length, 8);
    }
  }
});

test('simulated shootouts cannot continue to 6–4 after the fifth kick would have decided them', () => {
  const teams = getLeague('england').teams;
  const t = createTournament(teams, teams[0], unchangedOrder);
  completeFixture(t, [3, 0], () => 0.9999);
  assert.ok(t.history.every((fixture) => Math.max(...fixture.score) <= 5));
});
