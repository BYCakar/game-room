import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TEAM, LEAGUES, PATTERNS, getLeague, getTeam, normalizeTeam } from '../shared/teams.js';

// TFF 2026-2027 tables checked on 2026-11-12; source links and selection
// policy are recorded in client/assets/README.md. Amed is explicitly excluded.
const superLig = [
  'Galatasaray', 'Trabzonspor', 'Beşiktaş', 'Kasımpaşa', 'Fenerbahçe',
  'Kocaelispor', 'İstanbul Başakşehir', 'Çorum FK', 'Göztepe', 'Çaykur Rizespor',
  'Erzurumspor FK', 'Alanyaspor', 'Gençlerbirliği', 'Konyaspor', 'Gaziantep FK',
  'Samsunspor', 'Eyüpspor',
];
const firstLig = [
  'Bursaspor', 'Kayserispor', 'Iğdır FK', 'Mardin 1969 Spor', 'Batman Petrolspor',
  'Ankara Keçiörengücü', 'Bodrum FK', 'Antalyaspor', 'Fatih Karagümrük',
  'Esenler Erokspor', 'Muğlaspor', 'Ümraniyespor', 'Sarıyer', 'Van Spor FK',
  'Bandırmaspor',
];

test('Turkey replaces the Mexico club league while Global Cup keeps Mexico', () => {
  const turkey = getLeague('turkey');
  assert.equal(turkey.name, 'Turkey');
  assert.equal(turkey.flag, '🇹🇷');
  assert.equal(turkey.teams.length, 32);
  assert.equal(getLeague('mexico'), null);
  assert.equal(getTeam('mexico', 'mexico-1'), null);
  assert.equal(getLeague('global').teams.length, 48);
  assert.equal(getTeam('global', 'global-1').name, 'Mexico');
  assert.equal(LEAGUES.length, 12);
  for (const league of LEAGUES) assert.equal(league.teams.length, league.id === 'global' ? 48 : 32);
});

test('Turkey includes every eligible Süper Lig club and the top fifteen 1. Lig clubs', () => {
  const teams = getLeague('turkey').teams;
  assert.deepEqual(teams.map(team => team.name), [...superLig, ...firstLig]);
  assert.ok(teams.every(team => !/amed/i.test(team.name)));
  assert.equal(new Set(teams.map(team => team.id)).size, 32);
  assert.equal(new Set(teams.map(team => team.name)).size, 32);
  for (const team of teams) {
    assert.match(team.id, /^turkey-[a-z0-9]+$/);
    assert.equal(getTeam('turkey', team.id), team);
    assert.ok(Number.isFinite(team.rating) && team.rating > 0 && team.rating <= 100);
    assert.deepEqual(normalizeTeam(team), {
      name: team.name, primary: team.primary, secondary: team.secondary,
      shorts: team.shorts, pattern: team.pattern,
    });
  }
});

test('league and kit labels use English without changing club spelling', () => {
  assert.deepEqual(LEAGUES.map(league => league.name), [
    'England', 'Spain', 'Global Cup', 'Italy', 'France', 'Brazil', 'Turkey',
    'North America', 'Argentina', 'Netherlands', 'Germany', 'Russia',
  ]);
  assert.deepEqual(PATTERNS.map(pattern => pattern.name), [
    'Vertical stripes', 'Horizontal stripes', 'Plain', 'Halves', 'Diagonal sash',
    'Contrast sleeves', 'Chest band', 'Center stripe', 'Shoulder bands', 'Checks',
    'Cross', 'Side stripes', 'Sleeve and chest bands',
  ]);
  assert.equal(DEFAULT_TEAM.name, 'My Team');
  assert.equal(getTeam('turkey', 'turkey-besiktas').name, 'Beşiktaş');
  assert.equal(getTeam('turkey', 'turkey-igdir').name, 'Iğdır FK');
});
