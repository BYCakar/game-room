import { netImpact } from '../shared/physics.js';
import { FLIGHT_MS, RESULT_MS } from '../shared/rules.js';

export const NET_RIPPLE_MS = 850;

// The same absolute flight clock as the ball keeps a ripple stable through
// a pause, a resumed view and the result -> matchEnd transition.
export function netResponse(game, now) {
  if (!game || game.outcome !== 'goal' || game.contact || game.shot?.timeout ||
      !['result', 'matchEnd'].includes(game.phase)) return null;
  const flightMs = game.flightDurationMs ?? FLIGHT_MS;
  const postGoal = game.frameContact?.target && game.frameContact.goalAt != null;
  const sinceGoal = postGoal ? now - game.frameContact.goalAt : game.flightStartedAt == null
    ? now - game.phaseStartedAt + (game.phase === 'matchEnd' ? RESULT_MS : 0)
    : now - game.flightStartedAt - flightMs;
  const impact = netImpact(postGoal ? game.frameContact.target : game.shot, sinceGoal, flightMs);
  return impact && impact.ageMs < NET_RIPPLE_MS ? impact : null;
}

// A short wave travels out from the ball's impact. Only the fabric moves:
// all four attachment edges stay pinned, and distant netting stays still.
export function netDisplacement(x, y, bounds, impact) {
  const zero = { x: 0, y: 0 };
  if (!impact || impact.ageMs <= 0 || impact.ageMs >= NET_RIPPLE_MS) return zero;
  const edge = Math.min(x - bounds.left, bounds.right - x, y - bounds.top, bounds.bottom - y);
  if (edge <= 0) return zero;
  const dx = x - impact.x, dy = y - impact.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= 150) return zero;
  const waveAge = impact.ageMs - distance / .55;
  if (waveAge <= 0) return zero;
  const attachment = Math.min(1, edge / 14);
  const fade = (1 - impact.ageMs / NET_RIPPLE_MS) ** 2;
  const wave = 10 * impact.strength * Math.sin(waveAge * Math.PI * 2 / 280) *
    Math.exp(-waveAge / 260) * Math.exp(-((distance / 90) ** 2)) * fade * attachment;
  const reach = Math.max(30, distance);
  return { x: wave * dx / reach, y: wave * (.65 + .45 * dy / reach) };
}
