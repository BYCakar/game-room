// The renderer, referee and computer opponent use this one motion model.
// Keeper collision uses the opaque body/shirt pixels of the displayed frame,
// never the intended dive target or the transparent part of a bounding box.
import masks from './keeper-masks.js';
import { FLIGHT_MS, KEEPER_MS, RESULT_MS } from './rules.js';

export const GOAL = { left: 170, right: 630, top: 25, bottom: 182 };
export const NET_CONTACT_MS = 160;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
export const goalPoint = target => ({ x: lerp(GOAL.left, GOAL.right, target.x), y: lerp(GOAL.bottom, GOAL.top, target.y) });

// A complete horizontal sweep takes two seconds in the reference game.
export function shotAim(elapsed, heldMs = null) {
  return { x: .5 + .65 * Math.sin(elapsed * Math.PI / 1000),
    y: heldMs === null ? 2 / 157 : Math.min(1.2, (2 + Math.max(0, heldMs) * .09) / 157) };
}

export function shooterFrame(phase, elapsed, runupMs = KEEPER_MS) {
  if (phase === 'keeper') return clamp(elapsed / runupMs * 42, 0, 42);
  if (phase === 'flight') return clamp(42 + elapsed / 1000 * 30, 42, 53);
  return ['result', 'matchEnd'].includes(phase) ? 53 : 0;
}

export function flightBallPose(shot, elapsed, flightMs = FLIGHT_MS) {
  const endpoint = goalPoint(shot);
  const ms = clamp(elapsed, 0, flightMs), t = ms / flightMs;
  const scale = lerp(1, .48, t);
  const x = lerp(400, endpoint.x, t);
  const y = lerp(411, endpoint.y + 10, t) - Math.sin(t * Math.PI) * 52;
  const seconds = flightMs / 1000;
  return { x, y, scale, frame: Math.floor(ms / 50) % 12, centerX: x, centerY: y - 20 * scale,
    radius: 20 * scale, depth: t, vx: (endpoint.x - 400) / seconds,
    vy: (endpoint.y + 10 - 411 - Math.PI * 52 * Math.cos(t * Math.PI) + 10.4) / seconds };
}

function scoredBallPose(shot, elapsed, flightMs) {
  const ball = flightBallPose(shot, flightMs, flightMs);
  const seconds = Math.max(0, elapsed) / 1000;
  if (seconds === 0) return { x: ball.x, y: ball.y, scale: ball.scale, frame: ball.frame };
  // Carry the shot into the net, which absorbs its sideways speed and
  // gives it a small recoil. Gravity then drops it onto the goal's turf.
  const netTime = NET_CONTACT_MS / 1000, progress = clamp(seconds / netTime, 0, 1);
  const netX = clamp(ball.x + ball.vx * netTime / 2, GOAL.left + 12, GOAL.right - 12);
  const settleX = netX - (netX - ball.x) * .12;
  const recoil = clamp((seconds - netTime) / .35, 0, 1);
  const x = seconds < netTime ? lerp(ball.x, netX, 1 - (1 - progress) ** 2)
    : lerp(netX, settleX, 1 - (1 - recoil) ** 2);
  const groundShot = clamp((.22 - shot.y) / .22, 0, 1);
  const depthIn = 1 - (1 - progress) ** 2, depthOut = 1 - (1 - recoil) ** 2;
  // Low shots visibly roll into the net and come back a few pixels in
  // depth, even down the middle where lateral recoil would be invisible.
  const depthOffset = groundShot * (-6 * depthIn + 7 * depthOut);
  const scale = lerp(ball.scale, .4, depthIn) + groundShot * .025 * depthOut;
  const gravity = 520, floor = Math.max(ball.centerY, GOAL.bottom - 12);
  const roofRoom = Math.max(0, ball.centerY - GOAL.top - ball.radius);
  const vy = Math.max(-Math.sqrt(2 * gravity * roofRoom), clamp(ball.vy * .12, -55, 0));
  const landing = (-vy + Math.sqrt(vy ** 2 + 2 * gravity * (floor - ball.centerY))) / gravity;
  // 50% more bounce height (height is proportional to velocity squared).
  const rebound = -(vy + gravity * landing) * .25 * Math.sqrt(1.5);
  const settledAt = landing - 2 * rebound / gravity;
  let y = ball.centerY + vy * seconds + gravity * seconds ** 2 / 2;
  if (seconds >= landing) {
    const after = seconds - landing;
    y = seconds >= settledAt ? floor : floor + rebound * after + gravity * after ** 2 / 2;
  }
  return { x, y: y + depthOffset + 20 * scale, scale,
    frame: (ball.frame + Math.floor(Math.min(seconds, Math.max(settledAt, netTime + .35)) * 16)) % 12 };
}

export function netImpact(shot, elapsed, flightMs = FLIGHT_MS) {
  if (!shot || shot.timeout || elapsed < NET_CONTACT_MS || shot.x < 0 || shot.x > 1 || shot.y > 1) return null;
  const impact = scoredBallPose(shot, NET_CONTACT_MS, flightMs);
  return { x: impact.x, y: impact.y - 20 * impact.scale, ageMs: elapsed - NET_CONTACT_MS,
    strength: .65 + .35 * clamp(shot.y, 0, 1) };
}

// Height over turf with a small ground bounce, independent of projected
// depth. This keeps rolling misses on the ground instead of lifting them.
function turfHeight(height, velocity, seconds, gravity = 380) {
  const landing = (velocity + Math.sqrt(velocity ** 2 + 2 * gravity * height)) / gravity;
  if (seconds < landing) return Math.max(0, height + velocity * seconds - gravity * seconds ** 2 / 2);
  const after = seconds - landing, rebound = (gravity * landing - velocity) * .25;
  return Math.max(0, rebound * after - gravity * after ** 2 / 2);
}

function missedBallPose(shot, elapsed, flightMs) {
  const ball = flightBallPose(shot, flightMs, flightMs);
  const seconds = Math.max(0, elapsed) / 1000;
  if (seconds === 0) return { x: ball.x, y: ball.y, scale: ball.scale, frame: ball.frame };
  const boardTime = .28, boardScale = .36, frontFloor = GOAL.bottom + .4;
  // The advertising board's lower collision edge is at y=139. The ball
  // meets it after travelling beyond the goal, at its smaller depth scale.
  const boardFloor = 139 + 20 * boardScale;
  const height = Math.max(0, frontFloor - ball.centerY);
  const lift = height > 4 ? Math.max(0, -ball.vy - 130) : 0;
  const boardHeight = turfHeight(height, lift, boardTime);
  const boardX = ball.x + (ball.x - 400) * .188;
  const boardY = boardFloor - boardHeight * boardScale / ball.scale;
  const hitsBoard = boardX >= 0 && boardX <= 800 && boardY + 20 * boardScale >= 95;
  const p = clamp(seconds / boardTime, 0, 1);
  // Hermite continuation keeps the incoming horizontal velocity, then
  // perspective slows it down before the board instead of shooting offscreen.
  const dx = boardX - ball.x;
  let x = ball.x + (p ** 3 - 2 * p ** 2 + p) * ball.vx * boardTime
    + (-2 * p ** 3 + 3 * p ** 2) * dx + (p ** 3 - p ** 2) * dx * .35;
  let scale = lerp(ball.scale, boardScale, p);
  let ground = lerp(frontFloor, boardFloor, p);
  let h = turfHeight(height, lift, seconds);
  let alpha = 1, spinTime = seconds;
  if (seconds > boardTime) {
    const after = seconds - boardTime;
    if (hitsBoard) {
      const returnProgress = clamp(after / .9, 0, 1), ease = 1 - (1 - returnProgress) ** 2;
      x = boardX + dx * .45 * ease;
      ground = boardFloor + 38 * ease;
      scale = boardScale + .1 * ease;
      const impactLift = boardHeight < 2 ? 65 : (lift - 380 * boardTime) * .45;
      h = turfHeight(boardHeight, impactLift, after);
      spinTime = Math.min(seconds, boardTime + .9);
    } else {
      x = boardX + ball.vx * .55 * after;
      scale = Math.max(.2, boardScale - after * .12);
      ground = boardFloor - after * 35;
      // A high miss travels behind the boards/stands, rather than falling
      // back through the foreground after the result screen has finished.
      alpha = clamp((1.2 - seconds) / .35, 0, 1);
    }
  }
  const pose = { x, y: ground - h * scale / ball.scale + 20 * scale, shadowY: ground + 20 * scale, scale,
    frame: (ball.frame + Math.floor(spinTime * 20)) % 12 };
  return alpha < 1 ? { ...pose, alpha } : pose;
}

export function ballPose(phase, elapsed, shot, outcome, contact = null, now = 0, flightMs = FLIGHT_MS, flightStartedAt = null, frameContact = null) {
  if (frameContact && now >= frameContact.at && (!contact || frameContact.at < contact.at)) {
    return postBallPose(frameContact, now, flightMs);
  }
  if (contact && now >= contact.at) {
    const seconds = Math.max(0, now - contact.at) / 1000;
    // A glove/body impact sends the ball back out with a visible upward arc.
    // It then drops under gravity and makes a smaller second bounce.
    const gravity = 620, floor = 414;
    const landing = (-contact.vy + Math.sqrt(contact.vy ** 2 + 2 * gravity * Math.max(0, floor - contact.y))) / gravity;
    let y = contact.y + contact.vy * seconds + gravity * seconds ** 2 / 2;
    if (seconds > landing) {
      const after = seconds - landing, bounceV = -(contact.vy + gravity * landing) * .32;
      y = Math.min(floor, floor + bounceV * after + gravity * after ** 2 / 2);
    }
    const scale = Math.min(.95, contact.scale + seconds * .22);
    return { x: contact.x + contact.vx * Math.min(seconds, 2), y: y + 20 * scale,
      scale, frame: (contact.frame + Math.floor(seconds * 22)) % 12 };
  }
  if (!shot || !['flight', 'result', 'matchEnd'].includes(phase)) return { x: 400, y: 411, scale: 1, frame: 0 };
  if (['goal', 'miss'].includes(outcome) && !shot.timeout && ['result', 'matchEnd'].includes(phase)) {
    // Keep the flight clock through result -> matchEnd and reconnects;
    // phase-local elapsed time resets when the result banner changes.
    const sinceGoal = flightStartedAt === null ? elapsed + (phase === 'matchEnd' ? RESULT_MS : 0)
      : now - flightStartedAt - flightMs;
    return outcome === 'goal' ? scoredBallPose(shot, sinceGoal, flightMs) : missedBallPose(shot, sinceGoal, flightMs);
  }
  const ball = flightBallPose(shot, phase === 'flight' ? elapsed : flightMs, flightMs);
  return { x: ball.x, y: ball.y, scale: ball.scale, frame: ball.frame };
}

function postBallPose(contact, now, flightMs) {
  const seconds = Math.max(0, now - contact.at) / 1000;
  if (contact.outcome === 'goal') {
    const duration = (contact.goalAt - contact.at) / 1000;
    if (seconds >= duration) {
      const pose = scoredBallPose(contact.target, now - contact.goalAt, flightMs);
      pose.frame = (contact.frame + Math.floor(duration * 24) + pose.frame - Math.floor(flightMs / 50) % 12 + 12) % 12;
      return pose;
    }
    const end = flightBallPose(contact.target, flightMs, flightMs);
    const p = seconds / duration;
    const carry = (p ** 3 - 2 * p ** 2 + p) * duration;
    const settle = -2 * p ** 3 + 3 * p ** 2;
    const scale = lerp(contact.scale, end.scale, p);
    // The reflected velocity starts the bend; the net then absorbs it.
    return { x: contact.x + contact.vx * carry + (end.centerX - contact.x) * settle,
      y: contact.y + contact.vy * carry + (end.centerY - contact.y) * settle + 20 * scale,
      scale, frame: (contact.frame + Math.floor(seconds * 24)) % 12 };
  }
  const gravity = 620, floor = contact.vz < 0 ? 414 : 182;
  const landing = (-contact.vy + Math.sqrt(contact.vy ** 2 + 2 * gravity * Math.max(0, floor - contact.y))) / gravity;
  let y = contact.y + contact.vy * seconds + gravity * seconds ** 2 / 2;
  if (seconds > landing) {
    const after = seconds - landing, rebound = -(contact.vy + gravity * landing) * .3;
    y = Math.min(floor, floor + rebound * after + gravity * after ** 2 / 2);
  }
  const scale = clamp(contact.scale - contact.vz * Math.min(seconds, 1.5) / 1300, .25, .95);
  return { x: contact.x + contact.vx * Math.min(seconds, 1.8), y: y + 20 * scale, scale,
    frame: (contact.frame + Math.floor(Math.min(seconds, 1.8) * 24)) % 12 };
}

// A ball meets the frame only at its actual depth, not while its screen
// projection crosses a post on the way from the penalty spot. The visible
// opening is x170..630/y25..182; the metal tubes sit just outside it.
const FRAME_RADIUS = 5, FRAME_DEPTH = 200;
const FRAME = [
  { name: 'left', x: GOAL.left - FRAME_RADIUS, from: GOAL.top - FRAME_RADIUS, to: GOAL.bottom, vertical: true },
  { name: 'right', x: GOAL.right + FRAME_RADIUS, from: GOAL.top - FRAME_RADIUS, to: GOAL.bottom, vertical: true },
  { name: 'crossbar', y: GOAL.top - FRAME_RADIUS, from: GOAL.left - FRAME_RADIUS, to: GOAL.right + FRAME_RADIUS, vertical: false },
];

export function findFrameContact({ shot, flightStartedAt, flightMs = FLIGHT_MS, fromAt, toAt }) {
  if (!shot || shot.timeout || flightStartedAt == null || toAt < fromAt || fromAt > flightStartedAt + flightMs) return null;
  const first = Math.ceil(Math.max(flightMs * .9, fromAt - flightStartedAt) / 2) * 2;
  const last = Math.min(flightMs, toAt - flightStartedAt);
  for (let ms = Math.min(first, flightMs); ms <= last; ms = Math.min(ms + 2, flightMs)) {
    const ball = flightBallPose(shot, ms, flightMs);
    const z = (ms / flightMs - 1) * FRAME_DEPTH;
    for (const post of FRAME) {
      const px = post.vertical ? post.x : clamp(ball.centerX, post.from, post.to);
      const py = post.vertical ? clamp(ball.centerY, post.from, post.to) : post.y;
      const dx = ball.centerX - px, dy = ball.centerY - py;
      const distance = Math.hypot(dx, dy, z);
      if (distance > ball.radius + FRAME_RADIUS || distance < .001) continue;
      const nx = dx / distance, ny = dy / distance, nz = z / distance;
      const vzIn = FRAME_DEPTH / (flightMs / 1000);
      const toward = ball.vx * nx + ball.vy * ny + vzIn * nz;
      if (toward >= 0) continue;
      const vx = ball.vx - 1.68 * toward * nx;
      const vy = ball.vy - 1.68 * toward * ny;
      const vz = vzIn - 1.68 * toward * nz;
      const crossing = vz > 0 ? -z / vz : Infinity;
      const crossX = ball.centerX + vx * crossing, crossY = ball.centerY + vy * crossing + 310 * crossing ** 2;
      const goal = vz > 0 && crossing < .3 && crossX > GOAL.left && crossX < GOAL.right && crossY > GOAL.top && crossY < GOAL.bottom;
      const at = flightStartedAt + ms, travel = .18;
      const target = goal ? {
        x: (clamp(ball.centerX + vx * travel, GOAL.left + 14, GOAL.right - 14) - GOAL.left) / (GOAL.right - GOAL.left),
        y: (GOAL.bottom - clamp(ball.centerY + vy * travel + 310 * travel ** 2 - .4, GOAL.top + 14, GOAL.bottom - 8)) / (GOAL.bottom - GOAL.top),
      } : null;
      return { kind: 'post', post: post.name, at, x: ball.centerX, y: ball.centerY,
        z, scale: ball.scale, frame: ball.frame, vx, vy, vz, normalX: nx, normalY: ny, normalZ: nz,
        outcome: goal ? 'goal' : 'miss', target, goalAt: goal ? at + travel * 1000 : null };
    }
    if (ms === flightMs) break;
  }
  return null;
}

export function keeperIdleX(bot, elapsed, turnId) {
  return 400 + (bot ? 11 * Math.sin(Math.max(0, elapsed) / 700 + turnId * 1.7) : 0);
}

export function keeperPose({ save, now, turnStartedAt, turnId, bot }) {
  const restingX = keeperIdleX(bot, now - turnStartedAt, turnId);
  if (!save) return { x: restingX, y: 125, animation: 'Idle', frame: Math.floor(Math.max(0, now - turnStartedAt) / 200) % 12, flip: false };
  const since = Math.max(0, now - save.at), takeoffX = keeperIdleX(bot, save.at - turnStartedAt, turnId);
  const point = goalPoint(save), dx = point.x - takeoffX;
  const animation = point.y < 70 ? 'HighParade' : Math.abs(dx) <= 30 ? (point.y > 150 ? 'LowCatch' : 'MidCatch') : 'MidParade';
  const { frames, fps } = masks[animation];
  // The reference starts a dive at frame 6: its earlier standing frames
  // belong to the idle preparation, not to the response after the click.
  const frame = clamp((animation === 'LowCatch' ? 0 : 6) + since * fps / 1000, 0, frames.length - 1);

  // Measured reference physics: 0.02 world scale, .72 kg body, impulse
  // 1..5, 0.5 linear damping and 500 px/s² gravity. Integrate analytically
  // so clients and the referee agree independently of their frame rate.
  const dy = Math.max(point.y, 25) - (125 + 39.21768);
  const distance = Math.hypot(dx, dy);
  const impulse = distance > 150 ? 5 : 1 + Math.floor(distance / 50);
  const speed = impulse / (.72 * .02);
  const vx = speed * dx / (distance || 1), vy = speed * dy / (distance || 1);
  const damping = .5, gravity = 500, terminal = gravity / damping;
  const decayTime = seconds => -Math.expm1(-damping * seconds) / damping;
  const height = seconds => (vy - terminal) * decayTime(seconds) + terminal * seconds;
  let lower = 0, upper = 3;
  if (vy < 0) {
    for (let i = 0; i < 24; i++) {
      const middle = (lower + upper) / 2;
      if (height(middle) < 0) lower = middle; else upper = middle;
    }
  } else upper = 0;
  const seconds = since / 1000, landing = upper, airborne = Math.min(seconds, landing);
  let x = takeoffX + vx * decayTime(airborne);
  const y = 125 + Math.min(0, height(airborne));
  if (seconds > landing) {
    // Ground contact removes sideways speed through impact friction, then
    // the body slides to rest under the same damping and floor friction.
    const impactVY = (vy - terminal) * Math.exp(-damping * landing) + terminal;
    const groundVX = Math.max(0, Math.abs(vx) * Math.exp(-damping * landing) - Math.max(0, impactVY) * .5);
    const friction = gravity * .5;
    const stopAt = Math.log1p(groundVX * damping / friction) / damping;
    const t = Math.min(seconds - landing, stopAt);
    x += Math.sign(vx) * ((groundVX + friction / damping) * decayTime(t) - friction / damping * t);
  }
  return { x, y, animation, frame, flip: dx > 0 };

}

// Circle against opaque horizontal pixel runs. Empty corners of the sprite
// and gaps between arms/legs remain empty, including after mirroring.
export function keeperPixelContact(pose, ball) {
  const animation = masks[pose.animation];
  const mask = animation.frames[clamp(Math.floor(pose.frame), 0, animation.frames.length - 1)];
  const direction = pose.flip ? -1 : 1;
  const x = (ball.centerX - pose.x) * direction, y = ball.centerY - pose.y, r = ball.radius;
  const [left, top, right, bottom] = mask.bounds;
  if (x + r < left || x - r > right || y + r < top || y - r > bottom) return null;
  let nearest = null, best = r * r;
  for (const row of mask.rows) {
    const dy = y - clamp(y, row[0], row[0] + 1);
    if (Math.abs(dy) > r) continue;
    for (let i = 1; i < row.length; i += 2) {
      const dx = x - clamp(x, row[i], row[i + 1]);
      const distance = dx * dx + dy * dy;
      if (distance <= best) { best = distance; nearest = { dx: dx * direction, dy }; }
    }
  }
  if (!nearest) return null;
  const length = Math.hypot(nearest.dx, nearest.dy);
  return length > .001 ? { x: nearest.dx / length, y: nearest.dy / length } : { x: 0, y: 1 };
}

export function findKeeperContact({ shot, save, turnStartedAt, turnId, bot, flightStartedAt, flightMs = FLIGHT_MS, fromAt, toAt }) {
  if (!shot || shot.timeout || flightStartedAt == null || toAt < fromAt) return null;
  // Screen-space overlap while the ball is still near the shooter is not
  // physical contact: only test once it reaches the keeper's depth plane.
  const gate = flightMs * .88;
  if (fromAt > flightStartedAt + flightMs || toAt < flightStartedAt + gate) return null;
  const first = Math.ceil(Math.max(0, gate, fromAt - flightStartedAt) / 4) * 4;
  const last = Math.min(flightMs, toAt - flightStartedAt);
  // Include the exact goal-plane endpoint even for a non-multiple-of-four
  // duration, while keeping all other samples on the absolute flight grid.
  for (let ms = Math.min(first, flightMs); ms <= last; ms = Math.min(ms + 4, flightMs)) {
    const at = flightStartedAt + ms;
    const ball = flightBallPose(shot, ms, flightMs);
    const pose = keeperPose({ save: save && save.at <= at ? save : null, now: at, turnStartedAt, turnId, bot });
    const normal = keeperPixelContact(pose, ball);
    if (!normal) { if (ms === flightMs) break; continue; }
    const side = ball.centerX < pose.x ? -1 : ball.centerX > pose.x ? 1 : turnId % 2 ? 1 : -1;
    const vx = side * clamp(Math.abs(ball.vx) * .25 + Math.abs(normal.x) * 120, 90, 250);
    return { kind: 'keeper', at, x: ball.centerX, y: ball.centerY, scale: ball.scale,
      normalX: normal.x, normalY: normal.y, vx, vy: -170 - Math.abs(normal.y) * 30, frame: ball.frame };
  }
  return null;
}

// Find a physically viable dive time for the chosen (possibly mistaken)
// target. Bot difficulty changes that target and reaction jitter in the client.
export function optimalDiveDelay({ shot, target = shot, now, flightStartedAt, flightMs = FLIGHT_MS, turnStartedAt, turnId, bot = true }) {
  const last = flightStartedAt + flightMs;
  if (!shot || !target || now >= last) return null;
  let best = null;
  for (let at = now; at < last; at += 24) {
    const contact = findKeeperContact({ shot, save: { ...target, at }, turnStartedAt, turnId, bot,
      flightStartedAt, flightMs, fromAt: Math.max(now, flightStartedAt), toAt: last });
    if (contact && (!best || contact.at < best.contactAt)) best = { delayMs: at - now, target: { x: target.x, y: target.y }, contactAt: contact.at };
  }
  return best;
}
