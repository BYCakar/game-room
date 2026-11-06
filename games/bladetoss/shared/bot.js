// The computer opponent. It sees what a player sees, the world, and does
// what a player does: presses the button. Armed, it tries the throw it would
// make a moment from now against where its opponent will be, and throws when
// that would hit, straight or off a wall (not always: lower levels let more
// chances go, and miss more). Empty-handed, it jumps over swords coming at it,
// using its second jump if it must, hops up to swords lying on ledges, and
// from level 3 on kicks off walls.

import {
  AIM_AMP, AIM_MID, AIM_SPEED, BODY_H, BODY_W, BOUNCE_KEEP, CEIL, FLOOR, GIANT_SCALE, GIANT_SPEED, SWORD_GRAVITY,
  SWORD_LEN, SWORD_SPEED, WALK_SPEED, WALL_BOUNCES, WALL_GRACE,
} from './constants.js';
import { aimRate, geometry, inBody } from './sim.js';

export const BOT_LEVELS = 8;

// Per level, from 1 to 8: how quickly it acts on a throw it likes (seconds),
// how likely it is to take one, how far off its timing is (swing phase,
// either way), how likely it is to jump over a sword coming at it, and to
// kick off a wall it touches in the air.
const REACTION = [0.24, 0.2, 0.16, 0.13, 0.1, 0.08, 0.06, 0.05];
const TAKES = [0.3, 0.38, 0.46, 0.55, 0.62, 0.7, 0.78, 0.86];
const TIMING_ERROR = [0.5, 0.38, 0.28, 0.2, 0.14, 0.09, 0.05, 0.02];
const DODGE = [0.12, 0.25, 0.38, 0.5, 0.6, 0.7, 0.8, 0.88];
const WALL_JUMPS = [0, 0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
// It throws anyway once it has held a sword this long.
const IMPATIENT = 5;

// Where a fighter walking from `x` will be in `t` seconds, turning at the walls.
export function walkedX(geo, x, facing, t) {
  const lo = geo.wl + BODY_W / 2;
  const hi = geo.wr - BODY_W / 2;
  let nx = x + facing * WALK_SPEED * t;
  for (let i = 0; i < 3; i++) {
    if (nx > hi) nx = 2 * hi - nx;
    else if (nx < lo) nx = 2 * lo - nx;
  }
  return nx;
}

// Whether the sword `seat` holds, thrown `lead` seconds from now, would hit
// the other fighter (who is assumed to keep walking as it is). It counts the
// thrower's steady hand, and a laser or giant throw to come.
export function throwWouldHit(world, seat, lead) {
  const geo = geometry(world);
  const p = world.fighters[seat];
  const o = world.fighters[1 - seat];
  if (p.sword < 0 || !o.alive) return false;
  const giant = p.power === 'giant';
  const gravity = p.power === 'laser' ? 0 : SWORD_GRAVITY;
  const len = SWORD_LEN * (giant ? GIANT_SCALE : 1);
  const speed = SWORD_SPEED * (giant ? GIANT_SPEED : 1);
  const a = AIM_MID + AIM_AMP * Math.sin(p.aimPh + AIM_SPEED * aimRate(p) * lead);
  const px = walkedX(geo, p.x, p.facing, lead);
  const dx = p.facing * Math.cos(a);
  const dy = -Math.sin(a);
  let x = px + p.facing * 13 + (dx * len) / 2;
  let y = p.y - 22 + (dy * len) / 2;
  let vx = dx * speed;
  let vy = dy * speed;
  let bounces = 0;
  const st = 1 / 90;
  for (let t = 0; t < 1.3; t += st) {
    const prevTipY = y + (Math.sin(Math.atan2(vy, vx)) * len) / 2;
    vy += gravity * st;
    x += vx * st;
    y += vy * st;
    const ang = Math.atan2(vy, vx);
    const tx = x + (Math.cos(ang) * len) / 2;
    const ty = y + (Math.sin(ang) * len) / 2;
    const ox = walkedX(geo, o.x, o.facing, lead + t);
    if (Math.abs(tx - ox) < BODY_W / 2 - 3 && ty > o.y - BODY_H + 4 && ty < o.y - 3) return true;
    if ((tx < geo.wl || tx > geo.wr) && bounces < WALL_BOUNCES) {
      // Off the wall, as the sword would go (see sim.js).
      const side = tx < geo.wl ? -1 : 1;
      bounces++;
      vx = -vx * BOUNCE_KEEP;
      vy *= BOUNCE_KEEP;
      x = (side < 0 ? geo.wl : geo.wr) - side * ((Math.abs(Math.cos(Math.atan2(vy, vx))) * len) / 2 + 1);
      continue;
    }
    if (tx < geo.wl || tx > geo.wr || ty > FLOOR || ty < CEIL) return false;
    for (const pl of geo.plats) if (vy > 0 && prevTipY <= pl.y && ty >= pl.y && tx >= pl.x1 && tx <= pl.x2) return false;
  }
  return false;
}

// How soon the flying sword `s` reaches the fighter `p`, if it does within
// half a second; -1 if not.
export function timeToHit(world, s, p) {
  const geo = geometry(world);
  let { x, y, vx, vy, bounces } = s;
  const gravity = s.laser || s.returning ? 0 : SWORD_GRAVITY;
  const st = 1 / 120;
  for (let t = 0; t < 0.5; t += st) {
    vy += gravity * st;
    x += vx * st;
    y += vy * st;
    const ang = Math.atan2(vy, vx);
    const tx = x + (Math.cos(ang) * SWORD_LEN) / 2;
    const ty = y + (Math.sin(ang) * SWORD_LEN) / 2;
    const px = walkedX(geo, p.x, p.facing, t);
    if (inBody(tx, ty, px, p.y, 6) || inBody(x, y, px, p.y, 6)) return t;
    if ((tx < geo.wl || tx > geo.wr) && bounces < WALL_BOUNCES) {
      bounces++;
      vx = -vx * BOUNCE_KEEP;
      vy *= BOUNCE_KEEP;
      continue;
    }
    if (ty > FLOOR || tx < geo.wl || tx > geo.wr || ty < CEIL) return -1;
  }
  return -1;
}

// A bot of `level` (1 to 8). `decide(world, seat, dt)` is asked again and
// again, `dt` seconds apart, and returns a press to make, { ph } where ph is
// the swing phase it throws at (undefined when it jumps), or null.
export function createBrain(level, rand = Math.random) {
  const k = Math.max(1, Math.min(BOT_LEVELS, level)) - 1;
  let waitLeft = -1; // counting down to a throw it has decided on
  let likedBefore = false;
  let dodged = -1; // the last throw it decided whether to jump over
  let triedWall = 0;

  return {
    decide(world, seat, dt) {
      const p = world.fighters[seat];
      const o = world.fighters[1 - seat];
      if (world.phase !== 'playing' || !p.alive) return null;

      if (p.sword >= 0) {
        if (waitLeft >= 0) {
          waitLeft -= dt;
          if (waitLeft >= 0) return null;
          waitLeft = -1;
          return { ph: p.aimPh + (rand() * 2 - 1) * TIMING_ERROR[k] };
        }
        const likes = o.alive && throwWouldHit(world, seat, REACTION[k]);
        if (likes && !likedBefore && rand() < TAKES[k]) waitLeft = REACTION[k];
        likedBefore = likes;
        if (p.holdT > IMPATIENT && rand() < dt * 0.8) return { ph: p.aimPh };
        return null;
      }

      likedBefore = false;
      waitLeft = -1;
      if (p.onGround) triedWall = 0;
      // A power-up a jump away, just ahead.
      for (const item of world.items ?? []) {
        const ahead = (item.x - p.x) * p.facing;
        const above = p.y - BODY_H - item.y;
        if (ahead > 10 && ahead < 70 && above > 0 && above < 190 && (p.onGround || p.airJumps > 0) && rand() < dt * 10) return {};
      }
      if (!p.onGround && p.wallT > 0 && p.wallT < WALL_GRACE - 0.03 && triedWall !== p.wallSide) {
        triedWall = p.wallSide;
        if (rand() < WALL_JUMPS[k]) return {};
      }
      for (const s of world.swords) {
        if (s.state !== 'flying' || s.thrower === seat || s.throwId === dodged) continue;
        const t = timeToHit(world, s, p);
        if (t >= 0 && t < 0.3) {
          dodged = s.throwId;
          if ((p.onGround || p.airJumps > 0) && rand() < DODGE[k]) return {};
        }
      }
      if (p.onGround) {
        // A sword on a ledge a jump above, just ahead.
        for (const s of world.swords) {
          if (s.state === 'stuck' && s.y < p.y - 30 && s.y > p.y - 210 &&
            Math.abs(s.x - (p.x + p.facing * 45)) < 30 && rand() < dt * 8) return {};
        }
        if (rand() < dt * 0.35) return {};
      } else if (p.airJumps > 0 && p.vy > -120 && rand() < dt * 1.2) return {}; // now and then, a second jump at the top
      return null;
    },
  };
}
