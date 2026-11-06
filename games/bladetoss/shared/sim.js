// The duel itself: the fighters, the swords, and how they move and collide.
// The server steps this as the truth. The browser steps the same code ahead
// of the last snapshot, so that the world moves smoothly between snapshots
// and the player's own presses show at once; the bot uses it to try throws
// out. Nothing in here is random, so the same world and the same presses
// always come out the same.
//
// A world is plain JSON (see pack/unpack): fighters and swords refer to each
// other by index, -1 for none, and to the surface they rest on by its index
// in geometry(world).surfaces (0 the floor, then the ledges), -1 for none.
// Ledges that move are where world.lt (the time the round has been fought)
// puts them, so they too come out the same everywhere.

import {
  AIM_AMP, AIM_MID, AIR_JUMP_SPEED, AIR_JUMPS, BODY_H, BODY_W, BOUNCE_KEEP, CEIL, CEIL_HOLD, CLING_SPEED,
  DRAW_WINDOW, FLOOR, GRAVITY, JUMP_BUFFER, JUMP_SPEED, NO_PICK, SELF_SAFE, SLOW_SCALE, SLOW_TIME, SWORD_GRAVITY,
  SWORD_LEN, SWORD_SPEED, WALK_SPEED, WALL_BOUNCES, WALL_GRACE, WALL_HOLD, AIM_SPEED,
} from './constants.js';
import { MAPS } from './maps.js';

// Each arena's walls and the surfaces that can be stood on, the floor first,
// with the ledges where they are when still.
const GEOMETRY = MAPS.map((m) => {
  const plats = m.plats.map(([x1, x2, y, motion]) => ({ x1, x2, y, motion: motion ?? null }));
  return { wl: m.wl, wr: m.wr, plats, surfaces: [{ x1: -1e4, x2: 1e4, y: FLOOR, floor: true }, ...plats] };
});

// Whether an arena has ledges that can move.
export const hasMovingLedges = (map) => GEOMETRY[map].plats.some((p) => p.motion);

// How far a moving ledge is from where it rests, `lt` seconds into the round.
const shift = (motion, lt) => (motion ? Math.sin((2 * Math.PI * lt) / motion.period + motion.phase) * motion.amp : 0);

// The arena as it is now: walls, ledges where they have moved to, and the
// surfaces (the floor, then the ledges).
export function geometry(world) {
  const still = GEOMETRY[world.map];
  if (!world.moving) return still;
  if (world.geo && world.geoAt === world.lt) return world.geo;
  const plats = still.plats.map((p) => {
    if (!p.motion) return p;
    const d = shift(p.motion, world.lt);
    return p.motion.axis === 'x' ? { ...p, x1: p.x1 + d, x2: p.x2 + d } : { ...p, y: p.y + d };
  });
  world.geo = { ...still, plats, surfaces: [still.surfaces[0], ...plats] };
  world.geoAt = world.lt;
  return world.geo;
}

// How far surface `index` moved between ledge times `from` and `to`.
function moved(world, index, from, to) {
  const p = index > 0 && world.moving ? GEOMETRY[world.map].plats[index - 1] : null;
  if (!p?.motion) return { dx: 0, dy: 0 };
  const d = shift(p.motion, to) - shift(p.motion, from);
  return p.motion.axis === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d };
}

// How many events a world keeps for the snapshots to carry.
const EVENTS_KEPT = 16;
// A sword pushed into a surface is never moved more than this along its
// own length, however shallow the angle it came in at.
const MAX_EMBED = 14;
// Flying swords move in this many steps per world step, so none slips
// through a fighter or a ledge.
const SWORD_SUBSTEPS = 4;

// ---- small geometry ----

export const aimAngle = (p) => AIM_MID + AIM_AMP * Math.sin(p.aimPh);
export const handOf = (p) => ({ x: p.x + p.facing * 13, y: p.y - 22 });
const dirOf = (s) => ({ x: Math.cos(s.ang), y: Math.sin(s.ang) });
export const tipOf = (s) => {
  const d = dirOf(s);
  return { x: s.x + (d.x * SWORD_LEN) / 2, y: s.y + (d.y * SWORD_LEN) / 2 };
};
export const hiltOf = (s) => {
  const d = dirOf(s);
  return { x: s.x - (d.x * SWORD_LEN) / 2, y: s.y - (d.y * SWORD_LEN) / 2 };
};
// Whether a point is inside a fighter standing at (bx, by), give or take `pad`.
export const inBody = (px, py, bx, by, pad = 0) =>
  px >= bx - BODY_W / 2 - pad && px <= bx + BODY_W / 2 + pad && py >= by - BODY_H - pad && py <= by + pad;

// ---- a new round ----

function newFighter(seat, geo, aimPh) {
  return {
    seat,
    x: seat ? geo.wr - 100 : geo.wl + 100,
    y: FLOOR,
    vy: 0,
    facing: seat ? -1 : 1,
    onGround: true,
    on: 0, // the surface stood on
    airJumps: AIR_JUMPS,
    alive: true,
    sword: seat, // each starts holding a sword
    aimPh, // where in its swing the held sword is
    aimFrom: aimPh, // the swing phase when the sword was taken up
    holdT: 0,
    jumpBuf: 0,
    cling: false,
    wallT: 0, // time left in which a press kicks off the wall last touched
    wallSide: 0, // -1 the left wall, 1 the right
    noPick: -1, // the sword this fighter just threw, which it cannot take back yet
    noPickT: 0,
    // Once hit: how the body flies.
    dvx: 0,
    rot: 0,
    rv: 0,
  };
}

// A world at the start of a round in arena `map`. `rand` gives the swings a
// different start each round; `eventId` carries the event count on from the
// last round; `moving` makes the ledges that can move move.
export function createWorld(map, { rand = Math.random, eventId = 0, moving = false } = {}) {
  const geo = GEOMETRY[map];
  const a = rand() * Math.PI * 2;
  const phases = [a, a + Math.PI * (0.5 + rand())];
  const world = {
    map,
    phase: 'countdown', // 'countdown' | 'playing' | 'roundOver', set by the match
    t: 0,
    lt: 0, // time the round has been fought (not counted down), which moves the ledges
    moving: Boolean(moving) && hasMovingLedges(map),
    slowT: 0,
    killT: -1, // seconds since the first hit of the round, -1 before it
    fighters: [0, 1].map((seat) => newFighter(seat, geo, phases[seat])),
    swords: [0, 1].map((holder) => ({
      x: 0, y: 0, vx: 0, vy: 0, ang: 0,
      state: 'held', // 'held' | 'flying' | 'stuck' | 'falling'
      holder,
      on: -1, // the surface it is stuck in
      bounces: 0, // times this throw has glanced off a wall
      thrower: -1,
      flyT: 0,
      dropT: 0, // while stuck in a wall or the ceiling: time until it falls out
      wallDir: 0,
      spin: 0,
      throwId: -1,
    })),
    events: [],
    eventId,
    throwId: 0,
    predict: false, // true in the browser: no hits, no events
  };
  for (const s of world.swords) holdSword(world, s);
  return world;
}

// Something the screens should show or play: a throw, a hit, a clash. Only
// the server's world records them; the browser plays them from snapshots.
function emit(world, type, data) {
  if (world.predict) return;
  world.events.push({ id: ++world.eventId, type, ...data });
  if (world.events.length > EVENTS_KEPT) world.events.shift();
}

// ---- presses ----

// The one button. Armed, it throws at swing phase `ph` (the server has
// already checked it; undefined for where the sword is now); empty-handed, it
// jumps, kicks off a wall, or remembers the press for the landing. Returns
// whether it did anything.
export function press(world, seat, ph) {
  const p = world.fighters[seat];
  if (!p || !p.alive || world.phase !== 'playing') return false;
  if (p.sword >= 0) {
    if (Number.isFinite(ph)) p.aimPh = ph;
    throwSword(world, p);
  } else if (p.onGround) jump(world, p);
  else if (p.cling || p.wallT > 0) wallJump(world, p);
  else if (p.airJumps > 0) airJump(world, p);
  else p.jumpBuf = JUMP_BUFFER;
  return true;
}

function throwSword(world, p) {
  const s = world.swords[p.sword];
  const a = aimAngle(p);
  const h = handOf(p);
  const dx = p.facing * Math.cos(a);
  const dy = -Math.sin(a);
  Object.assign(s, {
    state: 'flying', holder: -1, thrower: p.seat, flyT: 0,
    x: h.x + (dx * SWORD_LEN) / 2, y: h.y + (dy * SWORD_LEN) / 2,
    vx: dx * SWORD_SPEED, vy: dy * SWORD_SPEED, ang: Math.atan2(dy, dx),
    throwId: ++world.throwId, bounces: 0, on: -1,
  });
  p.noPick = p.sword;
  p.noPickT = NO_PICK;
  p.sword = -1;
  p.holdT = 0;
  emit(world, 'throw', { seat: p.seat, x: s.x, y: s.y });
}

function jump(world, p) {
  if (p.sword >= 0 || !p.onGround || !p.alive) return;
  p.vy = -JUMP_SPEED;
  p.onGround = false;
  p.jumpBuf = 0;
  emit(world, 'jump', { seat: p.seat, x: p.x, y: p.y });
}

function wallJump(world, p) {
  if (p.sword >= 0 || !p.alive) return;
  const side = p.wallSide;
  p.cling = false;
  p.wallT = 0;
  p.facing = -side;
  p.x += -side * 3;
  p.vy = -JUMP_SPEED * 0.95;
  p.jumpBuf = 0;
  p.airJumps = AIR_JUMPS;
  emit(world, 'wallJump', { seat: p.seat, x: p.x, y: p.y - BODY_H / 2, side });
}

// The second jump, in the air.
function airJump(world, p) {
  p.vy = -AIR_JUMP_SPEED;
  p.airJumps--;
  p.jumpBuf = 0;
  emit(world, 'airJump', { seat: p.seat, x: p.x, y: p.y });
}

// ---- stepping ----

// Moves the world on by `dt` seconds. `held` says, per seat, whether the
// button is down (it decides who clings to walls). In a predicting world
// (the browser's) nobody is hit: a sword that reaches a fighter waits there
// for the server to say what happened.
export function step(world, dt, held = [false, false]) {
  const scale = world.slowT > 0 ? SLOW_SCALE : 1;
  if (world.slowT > 0) world.slowT = Math.max(0, world.slowT - dt);
  const d = dt * scale;
  world.t += d;
  if (world.killT >= 0) world.killT += d;
  const lt = world.lt;
  if (world.phase !== 'countdown') world.lt += d;
  for (const p of world.fighters) stepFighter(world, p, d, Boolean(held[p.seat]), lt);
  for (const s of world.swords) {
    stepSword(world, s, d, lt);
    keepInArena(world, s);
  }
}

// Hits count while the round is on, and for a moment after the first one.
const hitsCount = (world) => !world.predict &&
  (world.phase === 'playing' || (world.killT >= 0 && world.killT < DRAW_WINDOW));

// `lt` is the ledge time at the start of the step: whatever stands on a
// moving ledge goes where it went since.
function stepFighter(world, p, dt, held, lt) {
  const geo = geometry(world);
  if (!p.alive) {
    // Knocked flying: bounce along the floor and come to rest.
    p.vy += GRAVITY * dt;
    p.x += p.dvx * dt;
    p.y += p.vy * dt;
    p.rot += p.rv * dt;
    if (p.x < geo.wl + 16) { p.x = geo.wl + 16; p.dvx = Math.abs(p.dvx) * 0.5; }
    if (p.x > geo.wr - 16) { p.x = geo.wr - 16; p.dvx = -Math.abs(p.dvx) * 0.5; }
    if (p.y >= FLOOR) {
      p.y = FLOOR;
      if (p.vy > 250) { p.vy = -p.vy * 0.35; p.rv *= 0.6; }
      else { p.vy = 0; p.dvx *= 0.02 ** dt; p.rv *= 0.02 ** dt; }
    }
    return;
  }

  if (p.sword >= 0) { p.aimPh += AIM_SPEED * dt; p.holdT += dt; }
  if (world.phase === 'countdown') return;

  if (p.onGround && p.on > 0) {
    const { dx, dy } = moved(world, p.on, lt, world.lt);
    p.x += dx;
    p.y += dy;
  }
  if (p.wallT > 0) p.wallT = Math.max(0, p.wallT - dt);
  if (p.noPickT > 0) { p.noPickT = Math.max(0, p.noPickT - dt); if (!p.noPickT) p.noPick = -1; }

  if (p.cling) {
    // Holding on to the wall and sliding down it; letting go of the button
    // leaps off.
    p.x = p.wallSide < 0 ? geo.wl + BODY_W / 2 : geo.wr - BODY_W / 2;
    p.facing = -p.wallSide;
    if (p.sword >= 0) p.cling = false;
    else if (!held && world.phase === 'playing') wallJump(world, p);
  } else {
    p.x += p.facing * WALK_SPEED * dt;
    let hit = 0;
    if (p.x < geo.wl + BODY_W / 2) { p.x = geo.wl + BODY_W / 2; p.facing = 1; hit = -1; }
    if (p.x > geo.wr - BODY_W / 2) { p.x = geo.wr - BODY_W / 2; p.facing = -1; hit = 1; }
    if (hit && !p.onGround) {
      p.wallSide = hit;
      p.wallT = WALL_GRACE;
      if (held && p.sword < 0 && world.phase === 'playing') {
        p.cling = true;
        p.jumpBuf = 0;
        p.vy = Math.max(p.vy, 0) * 0.2;
      }
    }
  }

  const prevY = p.y;
  const wasOnGround = p.onGround;
  p.vy = p.cling ? Math.min(p.vy + GRAVITY * dt, CLING_SPEED) : p.vy + GRAVITY * dt;
  p.y += p.vy * dt;
  p.onGround = false;
  p.on = -1;
  if (p.vy >= 0) {
    geo.surfaces.some((s, i) => {
      if (!(prevY <= s.y + 0.5 && p.y >= s.y && p.x >= s.x1 - 4 && p.x <= s.x2 + 4)) return false;
      if (!wasOnGround && p.vy > 500) emit(world, 'land', { seat: p.seat, x: p.x, y: s.y });
      p.y = s.y;
      p.vy = 0;
      p.onGround = true;
      p.on = i;
      p.cling = false;
      p.airJumps = AIR_JUMPS;
      return true;
    });
  }
  if (p.y < CEIL + BODY_H) { p.y = CEIL + BODY_H; if (p.vy < 0) p.vy = 0; }
  if (p.jumpBuf > 0) {
    p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    if (p.onGround && p.sword < 0) jump(world, p);
  }

  // Running over a sword picks it up, one at a time.
  if (p.sword < 0) {
    world.swords.forEach((s, i) => {
      if (p.sword >= 0 || (s.state !== 'stuck' && s.state !== 'falling') || i === p.noPick) return;
      const h = hiltOf(s);
      if (inBody(s.x, s.y, p.x, p.y, 7) || inBody(h.x, h.y, p.x, p.y, 7)) {
        Object.assign(s, { state: 'held', holder: p.seat, thrower: -1, dropT: 0, on: -1 });
        p.sword = i;
        p.holdT = 0;
        p.cling = false;
        p.aimPh = -Math.PI / 2 + 0.3; // the swing starts low
        p.aimFrom = p.aimPh;
        holdSword(world, s);
        emit(world, 'pick', { seat: p.seat, x: s.x, y: s.y });
      }
    });
  }
}

// Puts a held sword in its holder's hand, at the angle of the swing.
function holdSword(world, s) {
  const p = world.fighters[s.holder];
  const a = aimAngle(p);
  const h = handOf(p);
  const dx = p.facing * Math.cos(a);
  const dy = -Math.sin(a);
  s.x = h.x + (dx * SWORD_LEN) / 2;
  s.y = h.y + (dy * SWORD_LEN) / 2;
  s.ang = Math.atan2(dy, dx);
}

function stepSword(world, s, dt, lt) {
  if (s.state === 'held') { holdSword(world, s); return; }
  if (s.state === 'stuck' && s.on > 0) {
    const { dx, dy } = moved(world, s.on, lt, world.lt);
    s.x += dx;
    s.y += dy;
  }
  if (world.phase === 'countdown') return; // everything waits for the round to start
  if (s.state === 'flying') {
    if (s.waiting) return; // the browser's guess that it hit someone
    s.flyT += dt;
    const sdt = dt / SWORD_SUBSTEPS;
    for (let k = 0; k < SWORD_SUBSTEPS; k++) {
      const prevTip = tipOf(s);
      s.vy += SWORD_GRAVITY * sdt;
      s.x += s.vx * sdt;
      s.y += s.vy * sdt;
      s.ang = Math.atan2(s.vy, s.vx);
      if (collide(world, s, prevTip)) break;
    }
    return;
  }
  if (s.state === 'stuck') {
    if (s.dropT > 0) {
      s.dropT -= dt;
      if (s.dropT <= 0) {
        s.dropT = 0;
        s.state = 'falling';
        s.on = -1;
        s.vx = -s.wallDir * 70;
        s.vy = s.wallDir ? -60 : 0;
        s.spin = s.wallDir ? -s.wallDir * 9 : (s.x % 2 < 1 ? 6 : -6);
      }
    }
    return;
  }
  if (s.state === 'falling') {
    const geo = geometry(world);
    const prevY = s.y;
    s.vy += GRAVITY * 0.75 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.ang += s.spin * dt;
    if (s.x < geo.wl + 22) { s.x = geo.wl + 22; s.vx = Math.abs(s.vx) * 0.4; }
    if (s.x > geo.wr - 22) { s.x = geo.wr - 22; s.vx = -Math.abs(s.vx) * 0.4; }
    if (s.vy > 0) {
      geo.surfaces.some((sf, i) => {
        // The floor catches anything at or below it; a ledge only what
        // comes down onto it.
        const landed = sf.floor ? s.y + 4 >= sf.y : prevY + 4 <= sf.y + 8 && s.y + 4 >= sf.y;
        if (!landed || s.x < sf.x1 || s.x > sf.x2) return false;
        layFlat(s, sf.y);
        s.on = i;
        emit(world, 'stick', { x: s.x, y: sf.y, side: 0 });
        return true;
      });
    }
  }
}

function layFlat(s, y) {
  Object.assign(s, { y: y - 4, state: 'stuck', dropT: 0, vx: 0, vy: 0 });
  s.ang = Math.cos(s.ang) >= 0 ? 0.06 : Math.PI - 0.06;
}

// Pushes a sword's tip to `target` along its own length (by at most
// MAX_EMBED) and leaves it stuck there.
function embed(s, axis, target) {
  const d = dirOf(s);
  const t = tipOf(s);
  const k = axis === 'y' ? (target - t.y) / d.y : (target - t.x) / d.x;
  const kk = Number.isFinite(k) ? Math.max(-MAX_EMBED, Math.min(MAX_EMBED, k)) : 0;
  s.x += d.x * kk;
  s.y += d.y * kk;
  s.vx = 0;
  s.vy = 0;
  s.state = 'stuck';
}

// A flying sword against fighters, the other sword, ledges, floor, walls and
// ceiling. Returns true once it has stopped flying.
function collide(world, s, prevTip) {
  const geo = geometry(world);
  const t = tipOf(s);
  const mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
  for (const p of world.fighters) {
    if (!p.alive || (p.seat === s.thrower && s.flyT < SELF_SAFE)) continue;
    if (!(inBody(t.x, t.y, p.x, p.y) || inBody(mid.x, mid.y, p.x, p.y) || inBody(s.x, s.y, p.x, p.y))) continue;
    if (world.predict) { s.waiting = true; return true; }
    if (!hitsCount(world)) continue;
    hitFighter(world, p, s);
    s.state = 'falling';
    s.on = -1;
    s.spin = 13 * (Math.sign(s.vx) || 1);
    s.vx *= 0.12;
    s.vy = -260;
    return true;
  }
  for (const o of world.swords) {
    if (o === s || o.state !== 'flying' || o.waiting) continue;
    if (Math.hypot(o.x - s.x, o.y - s.y) < 34) {
      const x = (o.x + s.x) / 2;
      const y = (o.y + s.y) / 2;
      [s, o].forEach((q, i) => Object.assign(q, { state: 'falling', on: -1, vx: -q.vx * 0.22, vy: -340, spin: i ? 14 : -14 }));
      emit(world, 'clash', { x, y });
      return true;
    }
  }
  for (const [i, sf] of geo.surfaces.entries()) {
    // The floor stops a tip at or below it, even one that started there (a
    // throw straight down); a ledge one coming down into its top.
    const crossed = sf.floor ? t.y >= sf.y : s.vy > 0 && prevTip.y <= sf.y + 14 && t.y >= sf.y && t.y <= sf.y + 30;
    if (crossed && t.x >= sf.x1 && t.x <= sf.x2) {
      embed(s, 'y', sf.y + 10);
      s.on = i;
      emit(world, 'stick', { x: t.x, y: sf.y, side: 0 });
      return true;
    }
  }
  if (t.y <= CEIL && s.vy < 0) {
    embed(s, 'y', CEIL - 9);
    Object.assign(s, { dropT: CEIL_HOLD, wallDir: 0 });
    emit(world, 'stick', { x: t.x, y: CEIL, side: 2 });
    return true;
  }
  for (const side of [-1, 1]) {
    const face = side < 0 ? geo.wl : geo.wr;
    if (side < 0 ? t.x <= face : t.x >= face) {
      if (s.bounces < WALL_BOUNCES) {
        // It glances off like light off a mirror: out at the angle it came
        // in, a little slower, and as deadly as before, its thrower included.
        s.bounces++;
        s.vx = -s.vx * BOUNCE_KEEP;
        s.vy *= BOUNCE_KEEP;
        s.ang = Math.atan2(s.vy, s.vx);
        s.x = face - side * ((Math.abs(Math.cos(s.ang)) * SWORD_LEN) / 2 + 1);
        emit(world, 'bounce', { x: face, y: t.y, side });
        return true;
      }
      embed(s, 'x', face + side * 9);
      Object.assign(s, { dropT: WALL_HOLD, wallDir: side });
      emit(world, 'stick', { x: face, y: t.y, side });
      return true;
    }
  }
  return false;
}

function hitFighter(world, p, s) {
  p.alive = false;
  p.cling = false;
  const dir = Math.sign(s.vx) || -p.facing;
  p.dvx = s.vx * 0.35 + dir * 120;
  p.vy = -620;
  p.rv = dir * 11;
  if (p.sword >= 0) {
    Object.assign(world.swords[p.sword], { state: 'falling', holder: -1, on: -1, vx: dir * 90, vy: -380, spin: 14 });
    p.sword = -1;
  }
  world.slowT = SLOW_TIME;
  if (world.killT < 0) world.killT = 0;
  emit(world, 'hit', { seat: p.seat, x: p.x, y: p.y - BODY_H / 2, by: s.thrower });
}

// Nothing ever leaves the arena: a sword that somehow does is laid on the floor.
function keepInArena(world, s) {
  if (s.state === 'held') return;
  const geo = GEOMETRY[world.map];
  const lost = !Number.isFinite(s.x + s.y) || s.y > FLOOR + 6 || (s.y < CEIL - 40 && s.state !== 'flying') ||
    s.x < geo.wl - 6 || s.x > geo.wr + 6;
  if (!lost) return;
  s.x = Math.max(geo.wl + 26, Math.min(geo.wr - 26, Number.isFinite(s.x) ? s.x : (geo.wl + geo.wr) / 2));
  s.waiting = false;
  layFlat(s, FLOOR);
  s.on = 0;
}

// ---- to and from snapshots ----

// Positions to a tenth of a pixel and angles to a thousandth of a radian,
// which keeps snapshots short. Phases of the swing are kept finer, since the
// browser throws at the phase it shows.
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const r4 = (n) => Math.round(n * 10000) / 10000;

export function pack(world) {
  return {
    map: world.map,
    phase: world.phase,
    t: r3(world.t),
    lt: world.lt, // kept exact: it says where the ledges are
    moving: world.moving,
    slowT: r3(world.slowT),
    killT: r3(world.killT),
    eventId: world.eventId,
    throwId: world.throwId,
    events: world.events,
    fighters: world.fighters.map((p) => ({
      seat: p.seat, x: r1(p.x), y: r1(p.y), vy: r1(p.vy), facing: p.facing, onGround: p.onGround, on: p.on,
      airJumps: p.airJumps, alive: p.alive,
      sword: p.sword, aimPh: r4(p.aimPh), aimFrom: r4(p.aimFrom), holdT: r3(p.holdT), jumpBuf: r3(p.jumpBuf),
      cling: p.cling, wallT: r3(p.wallT), wallSide: p.wallSide, noPick: p.noPick, noPickT: r3(p.noPickT),
      dvx: r1(p.dvx), rot: r3(p.rot), rv: r3(p.rv),
    })),
    swords: world.swords.map((s) => ({
      x: r1(s.x), y: r1(s.y), vx: r1(s.vx), vy: r1(s.vy), ang: r3(s.ang), state: s.state, holder: s.holder,
      thrower: s.thrower, flyT: r3(s.flyT), dropT: r3(s.dropT), wallDir: s.wallDir, spin: r3(s.spin), throwId: s.throwId,
      on: s.on, bounces: s.bounces,
    })),
  };
}

// A world to step from a packed one; `predict` for the browser's.
export function unpack(packed, predict = true) {
  return {
    ...packed,
    events: [],
    fighters: packed.fighters.map((p) => ({ ...p })),
    swords: packed.swords.map((s) => ({ ...s, waiting: false })),
    predict,
  };
}
