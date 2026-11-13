// Difficulty changes what the computer attempts, never the referee's rules
// or the goalkeeper's strength. All randomness is injectable.
import { FLIGHT_MS } from './rules.js';
import { findKeeperContact, keeperPose } from './physics.js';
import { difficulty, keeperCompetenceMix } from './difficulty.js';
export { difficulty } from './difficulty.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function chooseKeeperRead(shot, level, random = Math.random, repeats = 0) {
  const settings = difficulty(level);
  const competentMix = keeperCompetenceMix(settings, repeats);
  if (competentMix > 0 && random() < competentMix) {
    return { kind: 'read', competent: true,
      target: { x: clamp(shot.x, .02, .98), y: clamp(shot.y, .03, .97) } };
  }
  // Repetition helps a little without erasing a level's characteristic errors.
  const learned = Math.min(
    Math.min(.06, Math.max(0, repeats) * .02) * settings.strength / 8,
    Math.min(settings.wrongCorner, settings.shortReach) * 1.5,
  );
  const wrong = settings.wrongCorner - learned * .5;
  const short = settings.shortReach - learned * .5;
  const roll = random();
  const side = shot.x < .5 ? -1 : shot.x > .5 ? 1 : random() < .5 ? -1 : 1;
  if (roll < wrong) {
    return { kind: 'wrong-corner', target: {
      x: .5 - side * (.28 + random() * .16),
      y: random() < .5 ? .12 + random() * .22 : .67 + random() * .24,
    } };
  }
  if (roll < wrong + short) {
    return { kind: 'short-reach', target: {
      x: .5 + (clamp(shot.x, 0, 1) - .5) * (.28 + random() * .30),
      y: clamp(shot.y > .55 ? shot.y * (.35 + random() * .25) : shot.y - .16 - random() * .10, .04, .55),
    } };
  }
  return { kind: 'read', target: {
    x: clamp(shot.x + (random() * 2 - 1) * settings.readError, .02, .98),
    y: clamp(shot.y + (random() * 2 - 1) * settings.readError, .03, .97),
  } };
}

function activeContact(input, at) {
  const save = { ...input.target, at };
  // Solve against the chosen interpretation, not the real shot: otherwise
  // the solver silently corrects a wrong-corner or short-reach guess.
  const contact = findKeeperContact({ ...input, shot: input.target, save,
    fromAt: Math.max(input.now, input.flightStartedAt), toAt: input.flightStartedAt + input.flightMs });
  if (!contact || contact.at < at) return null;
  const pose = keeperPose({ ...input, save, now: contact.at });
  if (pose.animation.endsWith('Parade')) {
    if (pose.frame < 6 || pose.frame > 14) return null;
  } else if (pose.frame > 14) return null;
  return { contact, pose };
}

// Search latest-first. Accept low dives touching down during active frames,
// but never choose an already completed floor pose as the saving strategy.
export function planActiveInterception({ target, now, flightStartedAt, flightMs = FLIGHT_MS, turnStartedAt, turnId, bot = true }) {
  const input = { target, now, flightStartedAt, flightMs, turnStartedAt, turnId, bot };
  const end = flightStartedAt + flightMs;
  const latest = end - 24;
  const earliest = Math.max(now, end - 850);
  for (let at = latest; at >= earliest; at -= 12) {
    const hit = activeContact(input, at);
    if (hit) return { at, delayMs: at - now, target: { ...target }, contactAt: hit.contact.at, frame: hit.pose.frame, airborne: hit.pose.y < 124.5 };
  }
  return null;
}

export function planKeeperAction({ decision, level, random = Math.random, now, flightStartedAt, flightMs = FLIGHT_MS, turnStartedAt, turnId, bot = true }) {
  const end = flightStartedAt + flightMs;
  if (now >= end - 24) return null;
  const timing = { target: decision.target, now, flightStartedAt, flightMs, turnStartedAt, turnId, bot };
  const plan = planActiveInterception(timing);
  const settings = difficulty(level);
  // An unreachable wrong guess still produces an attempt, timed against
  // that perceived target. Never fall back to solving the actual shot.
  let at = plan?.at ?? Math.max(now, end - (decision.target.y > .65 ? 320 : 140));
  let jitterMs = 0;
  if (!decision.competent && random() < settings.timingError) {
    jitterMs = (random() - .2) * settings.timingErrorMs;
    if (jitterMs < 0 && plan && !activeContact(timing, at + jitterMs)) jitterMs = 0;
    at += jitterMs;
  }
  at = clamp(at, now, end - 24);
  return { kind: decision.kind, target: { ...decision.target }, at, delayMs: at - now,
    viable: Boolean(plan), plannedContactAt: plan?.contactAt ?? null, jitterMs };
}

export function chooseBotShot(level, random = Math.random) {
  const settings = difficulty(level);
  const left = random() < .5;
  const outside = random() < settings.shotOutside;
  let target, kind;
  if (outside) {
    kind = 'outside';
    target = random() < .65
      ? { x: .08 + random() * .84, y: 1.025 + random() * .155 }
      : { x: left ? -.025 - random() * .105 : 1.025 + random() * .105, y: .12 + random() * .76 };
  } else if (random() < settings.shotCorner) {
    kind = 'corner';
    target = { x: left ? .04 + random() * .17 : .79 + random() * .17,
      y: random() < .5 ? .06 + random() * .24 : .70 + random() * .24 };
  } else {
    kind = 'middle';
    target = { x: .28 + random() * .44, y: .15 + random() * .64 };
  }
  return { kind, target, delayMs: 800 + random() * 1000 - settings.strength * 20 };
}
