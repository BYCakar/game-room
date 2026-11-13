import meta from '../meta.js';
import { getLeague, getTeam } from '../shared/teams.js';
import { PenaltyShootersMatch } from './match.js';
import { BOT_LEVELS } from '../shared/difficulty.js';

export default {
  meta,
  validateOptions(input) {
    if (!input || typeof input !== 'object' || !['duel', 'tournament'].includes(input.mode)) {
      return { error: 'Choose a tournament or a 1v1 match.' };
    }
    if (input.mode === 'duel') {
      if (input.teamId && input.teamId !== 'custom') return { error: '1v1 matches use your own team.' };
      return { options: { mode: 'duel', teamId: 'custom' } };
    }
    const league = getLeague(input.leagueId);
    if (!league || ![32, 48].includes(league.teams.length)) return { error: 'Choose a league.' };
    if (input.teamId !== 'custom' && !getTeam(input.leagueId, input.teamId)) return { error: 'Choose a team from this league or your own team.' };
    return { options: { mode: 'tournament', leagueId: league.id, teamId: input.teamId } };
  },
  validateBot(input, options) {
    if (options?.mode !== 'tournament') return { error: 'Single-player games use tournament mode.' };
    if (!Number.isInteger(input?.level) || input.level < 1 || input.level > BOT_LEVELS) return { error: `Choose a level from 1 to ${BOT_LEVELS}.` };
    return { bot: { level: input.level }, name: `Computer level ${input.level}` };
  },
  createMatch: (args) => new PenaltyShootersMatch(args),
  preview(snapshot) {
    return { score: snapshot.score, teams: snapshot.teams.map((t) => t ? { name: t.name, primary: t.primary, secondary: t.secondary, pattern: t.pattern } : null), phase: snapshot.phase };
  },
};
