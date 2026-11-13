import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../../../server/index.js';
import { connect } from '../../../test/helpers.js';
import { DEFAULT_TEAM, getLeague } from '../shared/teams.js';

test('Turkey preset and custom teams start 32-team tournaments through the real WebSocket API', async (t) => {
  const server = await startServer({ port: 0 });
  const client = connect(server.port);
  t.after(async () => {
    client.close();
    server.close();
    await server.saved();
  });
  await client.opened;
  client.send({ type: 'join', name: 'Turkey tester' });
  await client.next('joined');

  const preset = getLeague('turkey').teams[0];
  for (const teamId of [preset.id, 'custom']) {
    client.send({ type: 'bot', game: 'penaltyshooters',
      options: { mode: 'tournament', leagueId: 'turkey', teamId }, bot: { level: 1 }, seat: 0 });
    const setup = (await client.next('match')).snapshot;
    assert.equal(setup.phase, 'setup');
    assert.equal(setup.options.leagueId, 'turkey');
    assert.equal(setup.options.teamId, teamId);

    client.send({ type: 'action', action: 'ready', team: { ...DEFAULT_TEAM, name: 'Turkey Custom Team' } });
    const started = (await client.next('match', message => message.snapshot.phase === 'shoot')).snapshot;
    assert.equal(started.tournament.teams.length, 32);
    assert.equal(started.teams[0].name, teamId === 'custom' ? 'Turkey Custom Team' : preset.name);
    assert.ok(started.tournament.teams.some(team => team.id === started.teams[0].id));

    client.send({ type: 'action', action: 'resign' });
    await client.next('match', message => Boolean(message.snapshot.over));
  }
});
