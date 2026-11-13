// Pure rules shared by the authoritative match and the browser's animation.
export const PENALTIES = 5;
export const SHOOT_MS = 15_000;
export const KEEPER_MS = 1_400;
export const FLIGHT_MS = 600;
export const RESULT_MS = 1_200;
export const SAVE_PHASES = Object.freeze(['shoot', 'keeper', 'flight']);

// Reject malformed coordinates rather than turning a forged input into a shot.
export function targetOf(input, goalkeeper = false) {
  if (!input || !Number.isFinite(input.x) || !Number.isFinite(input.y)) return null;
  if (input.x < (goalkeeper ? 0 : -0.15) || input.x > (goalkeeper ? 1 : 1.15) || input.y < 0 || input.y > (goalkeeper ? 1 : 1.2)) return null;
  return { x: input.x, y: input.y };
}

export function shotOutcome(shot, contact, frameContact = null) {
  if (!shot || shot.timeout) return 'miss';
  if (contact?.kind === 'keeper') return 'saved';
  if (frameContact?.kind === 'post') return frameContact.outcome === 'goal' ? 'goal' : 'miss';
  if (shot.x < 0 || shot.x > 1 || shot.y > 1) return 'miss';
  return 'goal';
}

// A series ends early when the trailing side cannot catch up. In sudden
// death both sides must take the same number of kicks before it can end.
export function shootoutWinner(kicks) {
  const taken = kicks.map((row) => row.length);
  const score = kicks.map((row) => row.filter((kick) => kick === 'goal' || kick?.outcome === 'goal').length);
  if (taken[0] < PENALTIES || taken[1] < PENALTIES) {
    if (score[0] > score[1] + Math.max(0, PENALTIES - taken[1])) return 0;
    if (score[1] > score[0] + Math.max(0, PENALTIES - taken[0])) return 1;
    return null;
  }
  if (taken[0] !== taken[1] || score[0] === score[1]) return null;
  return score[0] > score[1] ? 0 : 1;
}
