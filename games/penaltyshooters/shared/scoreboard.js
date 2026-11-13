// Both teams share round columns. In sudden death the active round stays
// on the right, preceded by the four previous rounds (including pending
// answers), rather than independently slicing each team's completed kicks.
export function kickWindow(game) {
  const kicks = game.kicks ?? [[], []];
  const shooter = game.shooter === 1 ? 1 : 0;
  const completed = ['result', 'matchEnd'].includes(game.phase);
  const round = Math.max(1, (kicks[shooter]?.length ?? 0) + (completed ? 0 : 1));
  const start = Math.max(0, round - 5);
  return {
    start, round, suddenDeath: round > 5,
    rows: [0, 1].map(seat => Array.from({ length: 5 }, (_, column) => kicks[seat]?.[start + column] ?? null)),
  };
}
