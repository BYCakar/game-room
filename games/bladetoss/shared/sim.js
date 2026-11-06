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
//
// Power-ups (world.items) are put in by the server, the only one to roll
// dice; what happens once one is there is worked out here like the rest. A
// fighter keeps a shield, a while of steady hand, and one power for its next
// throw or empty hand (p.power). The extra swords of a triple throw are
// `temp`: they vanish as soon as they stop flying, and are never picked up;
// a sword that has gone stays in world.swords as 'gone', so that indexes
// held elsewhere keep pointing at the right one.

import {
  AIM_AMP, AIM_MID, AIR_JUMP_SPEED, AIR_JUMPS, BODY_H, BODY_W, BOOMERANG_MAX, BOOMERANG_PULL, BOOMERANG_TURN,
  BOUNCE_KEEP, CEIL, CEIL_HOLD, CLING_SPEED, DRAW_WINDOW, FLOOR, GIANT_SCALE, GIANT_SPEED, GRAVITY, ITEM_LIFE,
  ITEM_RADIUS, JUMP_BUFFER, JUMP_SPEED, MAGNET_SPEED, NO_PICK, SELF_SAFE, SLOW_SCALE, SLOW_TIME, SPRING_HALF_W,
  SPRING_LIFE, SPRING_SPEED, STEADY_RATE, STEADY_TIME, SWORD_GRAVITY, SWORD_LEN, SWORD_SPEED, TRIPLE_SPREAD,
  WALK_SPEED, WALL_BOUNCES, WALL_GRACE, WALL_HOLD, AIM_SPEED,
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
// A giant blade is twice as long, until someone picks it up.
export const lenOf = (s) => (s.giant ? SWORD_LEN * GIANT_SCALE : SWORD_LEN);
export const tipOf = (s) => {
  const d = dirOf(s);
  const half = lenOf(s) / 2;
  return { x: s.x + d.x * half, y: s.y + d.y * half };
};
export const hiltOf = (s) => {
  const d = dirOf(s);
  const half = lenOf(s) / 2;
  return { x: s.x - d.x * half, y: s.y - d.y * half };
};
// Whether the held sword swings slowly just now.
export const aimRate = (p) => (p.steadyT > 0 ? STEADY_RATE : 1);
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
    // Power-ups.
    shield: false,
    steadyT: 0, // time left with a steady hand
    power: '', // for the next throw ('triple', 'laser', 'giant', 'boomerang') or an empty hand ('magnet')
    springT: 0, // a spring does not launch the same fighter twice at once
    // Once hit: how the body flies.
    dvx: 0,
    rot: 0,
    rv: 0,
  };
}

function newSword(holder) {
  return {
    x: 0, y: 0, vx: 0, vy: 0, ang: 0,
    state: 'held', // 'held' | 'flying' | 'stuck' | 'falling' | 'homing' (to a magnet) | 'gone'
    holder, // who holds it, or who it is homing to
    on: -1, // the surface it is stuck in
    bounces: 0, // times this throw has glanced off a wall
    thrower: -1,
    flyT: 0,
    dropT: 0, // while stuck in a wall or the ceiling: time until it falls out
    wallDir: 0,
    spin: 0,
    throwId: -1,
    group: -1, // the throw it was part of: swords of one triple throw do not clash
    temp: false,
    giant: false,
    laser: false,
    boomerang: false,
    returning: false,
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
    swords: [0, 1].map(newSword),
    items: [], // power-ups floating in the arena: { id, kind, x, y, t }
    springs: [], // spring pads on the floor: { x, t }
    itemId: 0,
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

const THROW_POWERS = new Set(['triple', 'laser', 'giant', 'boomerang']);

function throwSword(world, p) {
  const s = world.swords[p.sword];
  const power = THROW_POWERS.has(p.power) ? p.power : '';
  if (power) p.power = '';
  const a = aimAngle(p);
  const group = world.throwId + 1;
  launch(world, p, s, a, power, group);
  if (power === 'triple') {
    for (const spread of [-TRIPLE_SPREAD, TRIPLE_SPREAD]) {
      const extra = newSword(-1);
      extra.temp = true;
      world.swords.push(extra);
      launch(world, p, extra, a + spread, power, group);
    }
  }
  p.noPick = p.sword;
  p.noPickT = NO_PICK;
  p.sword = -1;
  p.holdT = 0;
  emit(world, 'throw', { seat: p.seat, x: s.x, y: s.y, power });
}

// Sends sword `s` off from `p`'s hand at angle `a` above the horizontal.
function launch(world, p, s, a, power, group) {
  s.giant = power === 'giant';
  const h = handOf(p);
  const dx = p.facing * Math.cos(a);
  const dy = -Math.sin(a);
  const speed = SWORD_SPEED * (s.giant ? GIANT_SPEED : 1);
  const half = lenOf(s) / 2;
  Object.assign(s, {
    state: 'flying', holder: -1, thrower: p.seat, flyT: 0,
    x: h.x + dx * half, y: h.y + dy * half,
    vx: dx * speed, vy: dy * speed, ang: Math.atan2(dy, dx),
    throwId: ++world.throwId, group, bounces: 0, on: -1,
    laser: power === 'laser', boomerang: power === 'boomerang', returning: false,
  });
}

// A power-up appears; only the server calls this.
export function spawnItem(world, kind, x, y) {
  const item = { id: ++world.itemId, kind, x, y, t: 0 };
  world.items.push(item);
  emit(world, 'spawn', { kind, x, y });
  return item;
}

// What a power-up does for the fighter that takes it.
function takePower(world, p, item) {
  if (item.kind === 'shield') p.shield = true;
  else if (item.kind === 'steady') p.steadyT = STEADY_TIME;
  else if (item.kind === 'spring') world.springs.push({ x: Math.round(item.x), t: 0 });
  else p.power = item.kind;
  emit(world, 'power', { seat: p.seat, kind: item.kind, x: item.x, y: item.y });
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
  world.swords.forEach((s, i) => {
    stepSword(world, s, d, lt, i);
    keepInArena(world, s);
  });
  if (world.phase !== 'countdown') stepItems(world, d);
}

// Power-ups float, fade, and go to whoever touches them first; spring pads
// wear out.
function stepItems(world, dt) {
  world.items = world.items.filter((item) => {
    item.t += dt;
    if (item.t >= ITEM_LIFE) return false;
    const p = world.fighters.find((f) => f.alive &&
      item.x >= f.x - BODY_W / 2 - ITEM_RADIUS && item.x <= f.x + BODY_W / 2 + ITEM_RADIUS &&
      item.y >= f.y - BODY_H - ITEM_RADIUS && item.y <= f.y + ITEM_RADIUS);
    if (!p) return true;
    takePower(world, p, item);
    return false;
  });
  world.springs = world.springs.filter((sp) => (sp.t += dt) < SPRING_LIFE);
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

  if (p.sword >= 0) { p.aimPh += AIM_SPEED * aimRate(p) * dt; p.holdT += dt; }
  if (world.phase === 'countdown') return;
  if (p.steadyT > 0) p.steadyT = Math.max(0, p.steadyT - dt);
  if (p.springT > 0) p.springT = Math.max(0, p.springT - dt);

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

  // A spring pad launches whoever runs over it, sword in hand or not.
  if (p.onGround && p.on === 0 && !p.springT) {
    const pad = world.springs.find((sp) => Math.abs(sp.x - p.x) < SPRING_HALF_W);
    if (pad) {
      p.vy = -SPRING_SPEED;
      p.onGround = false;
      p.on = -1;
      p.springT = 0.4;
      p.airJumps = AIR_JUMPS;
      emit(world, 'spring', { seat: p.seat, x: pad.x, y: FLOOR });
    }
  }

  // A magnet, once the hand is empty, calls the nearest sword lying about.
  if (p.power === 'magnet' && p.sword < 0 && !world.swords.some((s) => s.state === 'homing' && s.holder === p.seat)) {
    let best = -1;
    let bestD = Infinity;
    world.swords.forEach((s, i) => {
      if ((s.state !== 'stuck' && s.state !== 'falling') || s.temp || i === p.noPick) return;
      const dd = Math.hypot(s.x - p.x, s.y - (p.y - 22));
      if (dd < bestD) { best = i; bestD = dd; }
    });
    if (best >= 0) {
      const s = world.swords[best];
      Object.assign(s, { state: 'homing', holder: p.seat, on: -1, dropT: 0, vx: 0, vy: 0 });
      p.power = '';
      emit(world, 'magnet', { seat: p.seat, x: s.x, y: s.y });
    }
  }

  // Running over a sword picks it up, one at a time.
  if (p.sword < 0) {
    world.swords.forEach((s, i) => {
      if (p.sword >= 0 || (s.state !== 'stuck' && s.state !== 'falling') || s.temp || i === p.noPick) return;
      const h = hiltOf(s);
      if (inBody(s.x, s.y, p.x, p.y, 7) || inBody(h.x, h.y, p.x, p.y, 7)) take(world, p, s, i);
    });
  }
}

// Fighter `p` takes sword `s` (number `i`) in hand.
function take(world, p, s, i) {
  Object.assign(s, { state: 'held', holder: p.seat, thrower: -1, dropT: 0, on: -1, giant: false, laser: false, boomerang: false, returning: false });
  p.sword = i;
  p.holdT = 0;
  p.cling = false;
  p.aimPh = -Math.PI / 2 + 0.3; // the swing starts low
  p.aimFrom = p.aimPh;
  holdSword(world, s);
  emit(world, 'pick', { seat: p.seat, x: s.x, y: s.y });
}

// Puts a held sword in its holder's hand, at the angle of the swing.
function holdSword(world, s) {
  const p = world.fighters[s.holder];
  const a = aimAngle(p);
  const h = handOf(p);
  const dx = p.facing * Math.cos(a);
  const dy = -Math.sin(a);
  const half = lenOf(s) / 2;
  s.x = h.x + dx * half;
  s.y = h.y + dy * half;
  s.ang = Math.atan2(dy, dx);
}

function stepSword(world, s, dt, lt, index) {
  if (s.state === 'gone') return;
  if (s.state === 'held') { holdSword(world, s); return; }
  if (s.state === 'stuck' && s.on > 0) {
    const { dx, dy } = moved(world, s.on, lt, world.lt);
    s.x += dx;
    s.y += dy;
  }
  if (world.phase === 'countdown') return; // everything waits for the round to start
  if (s.state === 'homing') {
    // Called by a magnet: straight to the hand, harming nobody.
    const p = world.fighters[s.holder];
    if (!p.alive || p.sword >= 0) {
      Object.assign(s, { state: 'falling', holder: -1, vx: 0, vy: 0, spin: 8 });
      return;
    }
    const h = handOf(p);
    const dx = h.x - s.x;
    const dy = h.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) { take(world, p, s, index); return; }
    const k = Math.min(1, (MAGNET_SPEED * dt) / dist);
    s.x += dx * k;
    s.y += dy * k;
    s.vx = (dx / dist) * MAGNET_SPEED;
    s.vy = (dy / dist) * MAGNET_SPEED;
    s.ang = Math.atan2(dy, dx);
    return;
  }
  if (s.state === 'flying') {
    if (s.waiting) return; // the browser's guess that it hit someone
    s.flyT += dt;
    const thrower = world.fighters[s.thrower];
    if (s.boomerang && (s.flyT > BOOMERANG_MAX || !thrower?.alive)) {
      s.boomerang = false;
      s.returning = false;
    }
    if (s.boomerang && s.flyT > BOOMERANG_TURN) s.returning = true;
    const sdt = dt / SWORD_SUBSTEPS;
    for (let k = 0; k < SWORD_SUBSTEPS; k++) {
      const prevTip = tipOf(s);
      if (s.returning) {
        // Heading home: it brakes, turns and makes for the thrower's hand
        // at the speed it was thrown, rather than looping wide.
        const h = handOf(thrower);
        const dx = h.x - s.x;
        const dy = h.y - s.y;
        const dist = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, BOOMERANG_PULL * sdt);
        s.vx += ((dx / dist) * SWORD_SPEED - s.vx) * k;
        s.vy += ((dy / dist) * SWORD_SPEED - s.vy) * k;
      } else if (!s.laser) s.vy += SWORD_GRAVITY * sdt;
      s.x += s.vx * sdt;
      s.y += s.vy * sdt;
      s.ang = Math.atan2(s.vy, s.vx);
      if (collide(world, s, prevTip, index)) break;
    }
    if (s.state !== 'flying') {
      s.laser = false;
      s.boomerang = false;
      s.returning = false;
      if (s.temp) s.state = 'gone';
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

// A flying sword against fighters, the other swords, ledges, floor, walls
// and ceiling. Returns true once it has stopped flying, or turned.
function collide(world, s, prevTip, index) {
  const geo = geometry(world);
  const t = tipOf(s);
  // Points along the front of the blade (a giant one reaches further).
  const points = [0, 0.5, 1].map((k) => ({ x: s.x + (t.x - s.x) * k, y: s.y + (t.y - s.y) * k }));
  for (const p of world.fighters) {
    if (!p.alive) continue;
    const touching = points.some((q) => inBody(q.x, q.y, p.x, p.y));
    if (p.seat === s.thrower && s.returning) {
      // A boomerang comes back to the hand it left, harmlessly.
      if (!touching) continue;
      if (p.sword < 0) take(world, p, s, index);
      else Object.assign(s, { state: 'falling', vx: 0, vy: -200, spin: 10 });
      emit(world, 'catch', { seat: p.seat, x: s.x, y: s.y });
      return true;
    }
    if (!touching || (p.seat === s.thrower && s.flyT < SELF_SAFE)) continue;
    if (world.predict) { s.waiting = true; return true; }
    if (!hitsCount(world)) continue;
    if (p.shield) {
      // The shield takes it, once: the sword is turned away, harmless.
      p.shield = false;
      Object.assign(s, { state: 'falling', on: -1, vx: -s.vx * 0.3, vy: -320, spin: -13 * (Math.sign(s.vx) || 1) });
      emit(world, 'shield', { seat: p.seat, x: p.x, y: p.y - BODY_H / 2 });
      return true;
    }
    hitFighter(world, p, s);
    s.state = 'falling';
    s.on = -1;
    s.spin = 13 * (Math.sign(s.vx) || 1);
    s.vx *= 0.12;
    s.vy = -260;
    return true;
  }
  for (const o of world.swords) {
    if (o === s || o.state !== 'flying' || o.waiting || o.group === s.group) continue;
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
        s.x = face - side * ((Math.abs(Math.cos(s.ang)) * lenOf(s)) / 2 + 1);
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
  if (s.state === 'held' || s.state === 'gone' || s.state === 'homing') return;
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
    itemId: world.itemId,
    items: world.items.map((i) => ({ ...i, t: r3(i.t) })),
    springs: world.springs.map((sp) => ({ ...sp, t: r3(sp.t) })),
    events: world.events,
    fighters: world.fighters.map((p) => ({
      seat: p.seat, x: r1(p.x), y: r1(p.y), vy: r1(p.vy), facing: p.facing, onGround: p.onGround, on: p.on,
      airJumps: p.airJumps, alive: p.alive,
      sword: p.sword, aimPh: r4(p.aimPh), aimFrom: r4(p.aimFrom), holdT: r3(p.holdT), jumpBuf: r3(p.jumpBuf),
      cling: p.cling, wallT: r3(p.wallT), wallSide: p.wallSide, noPick: p.noPick, noPickT: r3(p.noPickT),
      dvx: r1(p.dvx), rot: r3(p.rot), rv: r3(p.rv),
      shield: p.shield, steadyT: r3(p.steadyT), power: p.power, springT: r3(p.springT),
    })),
    swords: world.swords.map((s) => ({
      x: r1(s.x), y: r1(s.y), vx: r1(s.vx), vy: r1(s.vy), ang: r3(s.ang), state: s.state, holder: s.holder,
      thrower: s.thrower, flyT: r3(s.flyT), dropT: r3(s.dropT), wallDir: s.wallDir, spin: r3(s.spin), throwId: s.throwId,
      on: s.on, bounces: s.bounces, group: s.group, temp: s.temp, giant: s.giant, laser: s.laser,
      boomerang: s.boomerang, returning: s.returning,
    })),
  };
}

// A world to step from a packed one; `predict` for the browser's.
export function unpack(packed, predict = true) {
  return {
    ...packed,
    events: [],
    items: (packed.items ?? []).map((i) => ({ ...i })),
    springs: (packed.springs ?? []).map((sp) => ({ ...sp })),
    fighters: packed.fighters.map((p) => ({ ...p })),
    swords: packed.swords.map((s) => ({ ...s, waiting: false })),
    predict,
  };
}
