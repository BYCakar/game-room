// League cups have 32 teams; the Global Cup has 48, with the eight best
// third-placed teams joining the group winners and runners-up in a last 32.
// Simulated fixtures use the same win/loss table as the player's shootouts.
const LABELS = { group: 'Group stage', round32: 'Round of 32', round16: 'Round of 16', quarter: 'Quarter-final', semi: 'Semi-final', final: 'Final', complete: 'Champion', eliminated: 'Eliminated' };
const ROUNDS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
const STAGES = ['round32', 'round16', 'quarter', 'semi', 'final'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const compareRows = (a, b) => b.points - a.points ||
  (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
  b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId);

function shuffle(items, random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createTournament(teams, playerTeam, random = Math.random) {
  if (![32, 48].includes(teams.length)) throw new Error('A tournament requires 32 or 48 teams.');
  const pool = clone(teams);
  const existing = pool.findIndex((team) => team.id === playerTeam.id);
  pool[existing < 0 ? 0 : existing] = clone(playerTeam);
  const seeded = shuffle(pool, random);
  const groups = Array.from({ length: pool.length / 4 }, (_, i) => {
    const ids = seeded.slice(i * 4, i * 4 + 4).map((team) => team.id);
    return {
      id: String.fromCharCode(65 + i), teams: ids,
      table: ids.map((teamId) => ({ teamId, played: 0, won: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })),
    };
  });
  const tournament = {
    stage: 'group', round: 1, playerTeamId: playerTeam.id,
    playerGroup: groups.find((g) => g.teams.includes(playerTeam.id)).id,
    teams: pool, groups, bracket: [], history: [], current: null,
    champion: null, eliminated: false,
  };
  selectCurrent(tournament);
  return tournament;
}

function groupFixtures(t) {
  return t.groups.flatMap((g) => ROUNDS[t.round - 1].map(([a, b], i) => ({
    id: `group-${g.id}-${t.round}-${i}`, stage: 'group', round: t.round,
    group: g.id, home: g.teams[a], away: g.teams[b], score: null, winner: null,
  })));
}

function selectCurrent(t) {
  const matches = t.stage === 'group' ? groupFixtures(t) : t.bracket.at(-1)?.matches ?? [];
  t.current = matches.find((m) => m.home === t.playerTeamId || m.away === t.playerTeamId) ?? null;
}

function simulatedScore(random) {
  const loser = Math.min(5, Math.floor(random() * 5));
  // After five kicks a one-goal lead ends a shootout, so 6-4 cannot occur.
  const winner = loser + 1 + (loser < 4 ? Math.floor(random() * 2) : 0);
  return random() < 0.5 ? [winner, loser] : [loser, winner];
}

function record(t, fixture, score) {
  fixture.score = score.slice();
  fixture.winner = score[0] > score[1] ? fixture.home : fixture.away;
  t.history.push(clone(fixture));
  if (fixture.stage !== 'group') return;
  const table = t.groups.find((g) => g.id === fixture.group).table;
  [fixture.home, fixture.away].forEach((id, seat) => {
    const row = table.find((r) => r.teamId === id);
    row.played++;
    row.goalsFor += score[seat];
    row.goalsAgainst += score[1 - seat];
    if (id === fixture.winner) { row.won++; row.points += 3; }
    else row.lost++;
  });
  table.sort(compareRows);
}

function qualifiers48(t) {
  const ranked = (place) => t.groups.map((group) => ({ ...group.table[place], group: group.id })).sort(compareRows);
  const winners = ranked(0), runners = ranked(1), thirds = ranked(2).slice(0, 8);
  const seeds = [...winners, ...runners.slice(0, 4)];
  const others = [...runners.slice(4), ...thirds];
  // A bipartite matching avoids duplicate teams and same-group rematches.
  const paired = Array(16).fill(-1);
  function assign(seed, seen) {
    for (let other = 0; other < others.length; other++) {
      if (seen.has(other) || seeds[seed].group === others[other].group) continue;
      seen.add(other);
      if (paired[other] === -1 || assign(paired[other], seen)) {
        paired[other] = seed;
        return true;
      }
    }
    return false;
  }
  for (let i = 0; i < seeds.length; i++) {
    if (!assign(i, new Set())) throw new Error('Could not draw the knockout round.');
  }
  return seeds.flatMap((seed, i) => [seed.teamId, others[paired.indexOf(i)].teamId]);
}

function bracketRound(t, stage, ids) {
  const matches = [];
  for (let i = 0; i < ids.length; i += 2) matches.push({
    id: `${stage}-${i / 2}`, stage, round: 1, home: ids[i], away: ids[i + 1], score: null, winner: null,
  });
  t.stage = stage;
  t.round = 1;
  t.bracket.push({ stage, matches });
  selectCurrent(t);
}

// Resolve the current player's fixture plus the fixtures happening alongside
// it. The next fixture is then ready, but the match waits for next-match.
export function completeFixture(t, playerScore, random = Math.random) {
  if (!t.current || t.eliminated || t.champion) throw new Error('There is no fixture to complete.');
  if (!Array.isArray(playerScore) || playerScore.length !== 2 || playerScore.some((n) => !Number.isInteger(n) || n < 0) || playerScore[0] === playerScore[1]) {
    throw new Error('A shootout needs a winning score.');
  }
  const fixtures = t.stage === 'group' ? groupFixtures(t) : t.bracket.at(-1).matches;
  const currentId = t.current.id;
  for (const fixture of fixtures) {
    const score = fixture.id === currentId
      ? (fixture.home === t.playerTeamId ? playerScore : playerScore.slice().reverse())
      : simulatedScore(random);
    record(t, fixture, score);
  }
  if (t.stage === 'group') {
    if (t.round < 3) { t.round++; selectCurrent(t); return; }
    const globalIds = t.groups.length === 12 ? qualifiers48(t) : null;
    const qualified = globalIds ?? t.groups.flatMap((g) => g.table.slice(0, 2).map((row) => row.teamId));
    if (!qualified.includes(t.playerTeamId)) {
      t.stage = 'eliminated'; t.eliminated = true; t.current = null; return;
    }
    if (globalIds) { bracketRound(t, 'round32', globalIds); return; }
    // Winners of adjacent groups face the other group's runners-up, with
    // the reciprocal pair in the other half of the draw.
    const ids = [];
    for (const reverse of [false, true]) {
      for (let i = 0; i < 8; i += 2) {
        const a = t.groups[i + (reverse ? 1 : 0)].table;
        const b = t.groups[i + (reverse ? 0 : 1)].table;
        ids.push(a[0].teamId, b[1].teamId);
      }
    }
    bracketRound(t, 'round16', ids);
    return;
  }
  const winners = fixtures.map((f) => f.winner);
  if (!winners.includes(t.playerTeamId)) {
    t.stage = 'eliminated'; t.eliminated = true; t.current = null; return;
  }
  if (t.stage === 'final') {
    t.champion = winners[0]; t.stage = 'complete'; t.current = null; return;
  }
  bracketRound(t, STAGES[STAGES.indexOf(t.stage) + 1], winners);
}

export function tournamentSnapshot(t) {
  return t ? { ...clone(t), stageLabel: LABELS[t.stage] } : null;
}
