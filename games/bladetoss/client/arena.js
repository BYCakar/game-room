// The duel on a canvas, and the one button. Snapshots come SEND_RATE times a
// second. Each frame the world is stepped on from the last one by the same
// code the server runs, with the player's own presses that the server has
// not answered yet laid in at the moment they were made, so a throw or a
// jump shows at once; when the next snapshot disagrees, what is drawn eases
// over to it rather than jumping.
//
// The button: Space, W, the up arrow, a mouse button or a finger on the
// arena. Pressed, it throws or jumps; held, it clings to walls; let go, it
// leaps off them.

import {
  ARENA_H, ARENA_W, BODY_H, CEIL, FLOOR, SEAT_COLOURS, STEP, SWORD_GRAVITY, SWORD_LEN, SWORD_SPEED,
} from '../shared/constants.js';
import { MAPS } from '../shared/maps.js';
import { aimAngle, handOf, hiltOf, press, step, unpack } from '../shared/sim.js';
import { el } from '/js/kit/dom.js';

// The world is not stepped on further than this past the last snapshot.
const MAX_PREDICT_MS = 400;
// How quickly a difference between the guess and the server fades (per second).
const SETTLE_RATE = 14;
// A difference bigger than this is not eased over but jumped.
const SNAP_DISTANCE = 90;
const KEYS = new Set(['Space', 'KeyW', 'ArrowUp']);
const FONT = '800 {px}px system-ui, -apple-system, "Segoe UI", sans-serif';
const font = (px) => FONT.replace('{px}', px);
const rnd = (a, b) => a + Math.random() * (b - a);

// `send(action)` sends an action of the player's own seat. `banner(game,
// msSinceSnapshot)` gives the words written across the arena, if any:
// { big, small, colour }. `feedback(kind)` hears the player's own throws and
// jumps the moment they are made, for sounds.
export function createArena(root, { send, banner, feedback }) {
  const canvas = el('canvas', { className: 'bladetossCanvas' });
  root.replaceChildren(canvas);
  const g = canvas.getContext('2d');

  let game = null; // the last snapshot
  let gameAt = 0; // performance.now() when it came
  let view = null; // the world as drawn this frame
  let lastEvent = 0;
  let playingSince = null;
  const offsets = { fighters: [{ x: 0, y: 0 }, { x: 0, y: 0 }], swords: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
  const squash = [0, 0];
  let parts = [];
  let shake = 0;

  // ---- the button ----

  let seq = 0;
  let pending = []; // own presses and releases the server has not answered: { seq, type, ph, at }
  const down = new Set(); // what is holding the button: key codes, pointer ids

  const playing = () => Boolean(game && game.you !== null && !game.over);

  function pressDown(source, now) {
    if (!playing()) return;
    const first = down.size === 0;
    down.add(source);
    if (!first) return;
    const me = (view ?? predict(now)).fighters[game.you];
    const ph = me.sword >= 0 ? me.aimPh : undefined;
    seq++;
    pending.push({ seq, type: 'press', ph, at: now });
    send({ action: 'press', seq, ...(ph === undefined ? {} : { ph }) });
    if (game.phase === 'playing' && !game.paused && me.alive) {
      if (me.sword >= 0) feedback('throw');
      else if (me.onGround || me.cling || me.wallT > 0) {
        squash[game.you] = -0.6;
        feedback('jump');
      }
    }
  }
  function letGo(source, now) {
    if (!down.delete(source) || down.size || !playing()) return;
    seq++;
    pending.push({ seq, type: 'release', at: now });
    send({ action: 'release', seq });
  }
  function letGoAll() {
    const now = performance.now();
    for (const source of [...down]) letGo(source, now);
  }

  function onKey(e) {
    if (!KEYS.has(e.code) || e.ctrlKey || e.metaKey || e.altKey || !playing()) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog, button')) return;
    e.preventDefault();
    if (e.type === 'keydown') {
      if (!e.repeat) pressDown(e.code, performance.now());
    } else letGo(e.code, performance.now());
  }
  function onPointerDown(e) {
    if (!playing()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not needed */ }
    pressDown(`p${e.pointerId}`, performance.now());
  }
  const onPointerUp = (e) => letGo(`p${e.pointerId}`, performance.now());

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', letGoAll);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- following the server ----

  // The world as it should be at `now`: the last snapshot stepped on, with
  // the presses the server has not seen yet.
  function predict(now) {
    const w = unpack(game.world);
    if (game.over || game.paused) return w;
    const held = game.held.slice();
    const mine = game.you;
    const apply = (input) => {
      if (input.type === 'press') {
        held[mine] = true;
        press(w, mine, input.ph);
      } else held[mine] = false;
    };
    const end = Math.min(now, gameAt + MAX_PREDICT_MS);
    let i = 0;
    while (i < pending.length && pending[i].at <= gameAt) apply(pending[i++]);
    const stepMs = STEP * 1000;
    let t = gameAt;
    while (t + stepMs <= end) {
      while (i < pending.length && pending[i].at <= t + stepMs) apply(pending[i++]);
      step(w, STEP, held);
      t += stepMs;
    }
    while (i < pending.length && pending[i].at <= end) apply(pending[i++]);
    if (end > t) step(w, (end - t) / 1000, held);
    return w;
  }

  function update(snapshot) {
    const now = performance.now();
    const fresh = !game || game.id !== snapshot.id;
    const before = fresh ? null : predict(now);
    const wasPhase = game?.phase;
    game = snapshot;
    gameAt = now;
    canvas.classList.toggle('controls', playing());
    if (!playing()) down.clear();
    if (fresh) {
      pending = [];
      seq = Math.max(seq, game.you === null ? 0 : game.acks[game.you] ?? 0);
      lastEvent = game.world.eventId; // what happened before we came is not replayed
      parts = [];
      for (const o of [...offsets.fighters, ...offsets.swords]) o.x = o.y = 0;
    }
    if (game.you !== null) pending = pending.filter((p) => p.seq > (game.acks[game.you] ?? 0));
    if (game.phase === 'playing' && wasPhase !== 'playing') playingSince = now;
    else if (game.phase !== 'playing') playingSince = null;

    for (const e of game.world.events) {
      if (e.id <= lastEvent) continue;
      lastEvent = e.id;
      effect(e);
    }

    // What was drawn a moment ago stays where it was, and eases over.
    const after = predict(now);
    if (before && before.map === after.map) {
      after.fighters.forEach((p, i) => {
        const was = before.fighters[i];
        const o = offsets.fighters[i];
        const dx = was.x + o.x - p.x;
        const dy = was.y + o.y - p.y;
        if (was.alive === p.alive && Math.hypot(dx, dy) < SNAP_DISTANCE) Object.assign(o, { x: dx, y: dy });
        else Object.assign(o, { x: 0, y: 0 });
      });
      after.swords.forEach((s, i) => {
        const was = before.swords[i];
        const o = offsets.swords[i];
        const dx = was.x + o.x - s.x;
        const dy = was.y + o.y - s.y;
        if (was.state === s.state && was.holder === s.holder && s.state !== 'held' && Math.hypot(dx, dy) < SNAP_DISTANCE) {
          Object.assign(o, { x: dx, y: dy });
        } else Object.assign(o, { x: 0, y: 0 });
      });
    }
  }

  // Sparks, dust and shakes for what the server says happened. The
  // player's own throws and jumps were shown when they were made.
  function effect(e) {
    const own = e.seat !== undefined && e.seat === game.you;
    switch (e.type) {
      case 'throw': break;
      case 'jump': if (!own) squash[e.seat] = -0.6; dust(e.x, e.y, 6); break;
      case 'wallJump':
        if (!own) squash[e.seat] = -0.5;
        burst(e.x - e.side * 14, e.y, 8, ['#d9cdf5', '#fff'], 180, { dir: e.side < 0 ? 0 : Math.PI, spread: 0.9, g: 300, lmin: 0.2, lmax: 0.45 });
        break;
      case 'land': squash[e.seat] = 0.7; dust(e.x, e.y, 5); break;
      case 'stick':
        shake = Math.max(shake, 3);
        if (e.side === 0) dust(e.x, e.y, 7);
        else burst(e.x, e.y, 8, ['#cfc4ee', '#fff'], 160, { dir: e.side === 2 ? Math.PI / 2 : e.side < 0 ? 0 : Math.PI, spread: 1, g: 400 });
        break;
      case 'pick':
        burst(e.x, e.y, 12, ['#fff', '#ffe68a', '#ffd23f'], 220, { type: 'star', g: 0, lmin: 0.3, lmax: 0.55, smin: 2, smax: 4 });
        break;
      case 'clash':
        burst(e.x, e.y, 26, ['#fff', '#ffe68a', '#ffd23f', '#ffb347'], 520, { g: 300, lmin: 0.2, lmax: 0.5, smin: 1.5, smax: 3.5 });
        shake = Math.max(shake, 8);
        break;
      case 'hit': {
        const c = SEAT_COLOURS[e.seat];
        burst(e.x, e.y, 34, [c.main, c.light, '#fff', '#ffd23f'], 520, { type: 'star', lmin: 0.5, lmax: 1.1, smin: 3, smax: 7, g: 700 });
        burst(e.x, e.y, 16, ['#fff'], 300, { g: 0, lmin: 0.15, lmax: 0.3, smin: 2, smax: 3 });
        shake = 14;
        break;
      }
      default:
    }
  }

  function burst(x, y, n, colours, speed, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.dir != null ? o.dir + rnd(-o.spread, o.spread) : Math.random() * Math.PI * 2;
      const v = rnd(speed * 0.35, speed);
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(o.lmin || 0.35, o.lmax || 0.8),
        size: rnd(o.smin || 2, o.smax || 5), colour: colours[(Math.random() * colours.length) | 0],
        g: o.g ?? 900, type: o.type || 'dot', rot: Math.random() * 6, vr: rnd(-12, 12),
      });
    }
  }
  const dust = (x, y, n = 8) => burst(x, y, n, ['#d9cdf5', '#b9aee0', '#fff'], 140, {
    dir: -Math.PI / 2, spread: 1.4, g: 200, lmin: 0.25, lmax: 0.5, smin: 2, smax: 5,
  });

  // ---- each frame ----

  let lastFrame = performance.now();
  let frame = requestAnimationFrame(tick);

  function tick(now) {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!game) return;
    resize();
    view = predict(now);
    const fade = Math.exp(-SETTLE_RATE * dt);
    for (const o of [...offsets.fighters, ...offsets.swords]) { o.x *= fade; o.y *= fade; }
    for (let i = 0; i < 2; i++) squash[i] *= 0.0005 ** dt;
    shake = Math.max(0, shake - dt * 40);
    const slow = view.slowT > 0 ? 0.3 : 1;
    for (const q of parts) {
      const d = dt * slow;
      q.life += d;
      q.vy += q.g * d;
      q.x += q.vx * d;
      q.y += q.vy * d;
      q.rot += q.vr * d;
      q.vx *= 0.3 ** d;
      if (q.y > FLOOR && q.vy > 0 && q.type !== 'dot') { q.y = FLOOR; q.vy *= -0.4; }
    }
    parts = parts.filter((q) => q.life < q.max);
    for (const p of view.fighters) {
      if (p.cling && Math.random() < dt * 14) {
        const m = MAPS[view.map];
        burst(p.wallSide < 0 ? m.wl + 2 : m.wr - 2, p.y - 6, 1, ['#e6defa', '#fff'], 40, {
          dir: -Math.PI / 2, spread: 0.6, g: 0, lmin: 0.2, lmax: 0.4, smin: 1.5, smax: 3,
        });
      }
    }
    draw(now);
  }

  let size = { w: 0, h: 0, ratio: 0 };
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2.5);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === size.w && h === size.h && ratio === size.ratio) return;
    size = { w, h, ratio };
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    backdrop = null;
  }

  // ---- drawing ----

  let backdrop = null; // the arena's still parts, drawn once per size and arena
  let backdropMap = -1;

  function draw(now) {
    const scale = canvas.width / ARENA_W;
    if (!backdrop || backdropMap !== view.map) {
      backdrop = drawBackdrop(MAPS[view.map], canvas.width, canvas.height, scale);
      backdropMap = view.map;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(backdrop, 0, 0);
    const sx = shake > 0 ? rnd(-shake, shake) * 0.5 : 0;
    const sy = shake > 0 ? rnd(-shake, shake) * 0.5 : 0;
    g.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);

    const map = MAPS[view.map];
    if (map.stars) {
      for (const st of STARS) {
        g.globalAlpha = 0.35 + 0.35 * Math.sin(now / 500 + st.p);
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    const swordAt = (s, i) => ({ ...s, x: s.x + offsets.swords[i].x, y: s.y + offsets.swords[i].y });
    const fighterAt = (p, i) => ({ ...p, x: p.x + offsets.fighters[i].x, y: p.y + offsets.fighters[i].y });
    const fighters = view.fighters.map(fighterAt);
    const swords = view.swords.map(swordAt);
    // A held sword is drawn in the hand it is in, wherever that is drawn.
    swords.forEach((s, i) => {
      if (s.state !== 'held') return;
      const p = fighters[s.holder];
      const a = aimAngle(p);
      const h = handOf(p);
      const dx = p.facing * Math.cos(a);
      const dy = -Math.sin(a);
      Object.assign(s, { x: h.x + (dx * SWORD_LEN) / 2, y: h.y + (dy * SWORD_LEN) / 2, ang: Math.atan2(dy, dx) });
    });

    swords.forEach((s) => { if (s.state === 'stuck' || s.state === 'falling') drawSword(s, now); });
    if (view.phase !== 'roundOver' && !game.over) fighters.forEach((p) => { if (p.alive && p.sword >= 0) drawAim(p); });
    fighters.forEach((p) => { if (!p.alive) drawFighter(p, now); });
    fighters.forEach((p) => { if (p.alive) drawFighter(p, now); });
    swords.forEach((s) => { if (s.state === 'held') drawSword(s, now); });
    fighters.forEach((p) => drawHand(p));
    swords.forEach((s) => { if (s.state === 'flying') { drawStreak(s); drawSword(s, now); } });
    drawParts();
    // Names of fighters side by side are put one above the other.
    const close = Math.abs(fighters[0].x - fighters[1].x) < 110 && Math.abs(fighters[0].y - fighters[1].y) < 30;
    fighters.forEach((p) => drawName(p, close && p.seat === 1 ? 16 : 0));

    g.setTransform(scale, 0, 0, scale, 0, 0);
    drawScore();
    drawWords(now);
    if (view.slowT > 0.7) {
      g.fillStyle = 'rgba(255,255,255,0.1)';
      g.fillRect(0, 0, ARENA_W, ARENA_H);
    }
  }

  function rrect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function text(str, x, y, px, fill, align = 'center', lw = px * 0.22) {
    g.font = font(px);
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    if (lw > 0) {
      g.lineWidth = lw;
      g.strokeStyle = '#1b1233';
      g.strokeText(str, x, y);
    }
    g.fillStyle = fill;
    g.fillText(str, x, y);
  }

  function drawSword(s, now) {
    const h = hiltOf(s);
    g.save();
    g.translate(h.x, h.y);
    g.rotate(s.ang);
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.arc(-3, 0, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7a4a2a';
    rrect(-1, -2.8, 12, 5.6, 2);
    g.fill();
    g.fillStyle = '#5a3418';
    g.fillRect(3, -2.8, 1.5, 5.6);
    g.fillRect(7, -2.8, 1.5, 5.6);
    g.fillStyle = '#ffd23f';
    rrect(10, -9, 5, 18, 2);
    g.fill();
    g.fillStyle = '#c7961f';
    g.fillRect(10, 2, 5, 7);
    g.beginPath();
    g.moveTo(15, -4);
    g.lineTo(SWORD_LEN - 9, -4);
    g.lineTo(SWORD_LEN + 1, 0);
    g.lineTo(SWORD_LEN - 9, 4);
    g.lineTo(15, 4);
    g.closePath();
    g.fillStyle = '#e8eef8';
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = '#2a2150';
    g.stroke();
    g.fillStyle = '#b7c3d9';
    g.fillRect(15, 0.5, SWORD_LEN - 24, 3);
    g.fillStyle = '#fff';
    g.fillRect(16, -2.5, SWORD_LEN - 26, 1.6);
    if (s.state === 'stuck') {
      // A glint running along a sword waiting to be picked up.
      const gx = 15 + ((now / 1000) * 30 + s.x) % 90;
      if (gx < SWORD_LEN) {
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.fillRect(gx, -4, 3, 8);
      }
    }
    g.restore();
  }

  function drawStreak(s) {
    const len = Math.hypot(s.vx, s.vy) * 0.05;
    const d = { x: Math.cos(s.ang), y: Math.sin(s.ang) };
    const grad = g.createLinearGradient(s.x, s.y, s.x - d.x * len, s.y - d.y * len);
    grad.addColorStop(0, 'rgba(255,255,255,.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grad;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(s.x - d.x * len, s.y - d.y * len);
    g.stroke();
  }

  // Where the held sword would go, a few dots of it, in the holder's colour.
  function drawAim(p) {
    const a = aimAngle(p);
    const h = handOf(p);
    const dx = p.facing * Math.cos(a);
    const dy = -Math.sin(a);
    const m = MAPS[view.map];
    let x = h.x + dx * SWORD_LEN;
    let y = h.y + dy * SWORD_LEN;
    let vx = dx * SWORD_SPEED;
    let vy = dy * SWORD_SPEED;
    g.fillStyle = SEAT_COLOURS[p.seat].light;
    const st = 0.022;
    for (let i = 1; i <= 9; i++) {
      vy += SWORD_GRAVITY * st;
      x += vx * st;
      y += vy * st;
      if (y > FLOOR || x < m.wl || x > m.wr || y < CEIL) break;
      g.globalAlpha = 0.55 * (1 - i / 10);
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function shadowOf(p) {
    const m = MAPS[view.map];
    let best = null;
    for (const [x1, x2, y] of [[-1e4, 1e4, FLOOR], ...m.plats]) {
      if (y >= p.y - 1 && p.x >= x1 && p.x <= x2 && (!best || y < best)) best = y;
    }
    if (best === null) return;
    const d = Math.min(1, (best - p.y) / 220);
    g.fillStyle = `rgba(15,8,35,${0.35 * (1 - d * 0.7)})`;
    g.beginPath();
    g.ellipse(p.x, best + 1, 17 * (1 - d * 0.5), 4.5 * (1 - d * 0.5), 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawFighter(p, now) {
    const c = SEAT_COLOURS[p.seat];
    const f = p.facing;
    if (p.alive) shadowOf(p);
    g.save();
    g.translate(p.x, p.y);
    if (!p.alive) {
      g.translate(0, -BODY_H / 2);
      g.rotate(p.rot);
      g.translate(0, BODY_H / 2);
    }
    const sq = squash[p.seat];
    g.scale(1 + sq * 0.18, 1 - sq * 0.18);
    if (p.cling) {
      g.translate(p.wallSide * 2, 0);
      g.scale(0.88, 1.06);
    }
    const moving = p.alive && p.onGround && view.phase !== 'countdown';
    const anim = (now / 1000) * 14 + p.seat * 2;
    const stride = moving ? Math.sin(anim) : 0;
    g.fillStyle = c.dark;
    const fy = p.onGround || !p.alive ? -3 : -6;
    g.beginPath();
    g.ellipse(-7 + stride * 5, fy - Math.max(0, stride) * 3, 6, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(7 - stride * 5, fy - Math.max(0, -stride) * 3, 6, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.translate(0, moving ? -Math.abs(Math.cos(anim)) * 2 : 0);
    g.fillStyle = c.dark;
    rrect(-15, -BODY_H, 30, 40, 13);
    g.fill();
    g.fillStyle = c.main;
    rrect(-15, -BODY_H, 30, 36, 13);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)';
    rrect(-10, -BODY_H + 4, 9, 6, 3);
    g.fill();
    // The headband, its tails streaming behind.
    g.fillStyle = '#22163d';
    g.fillRect(-15, -BODY_H + 11, 30, 6);
    const wave = Math.sin(now / 62 + p.seat) * 3;
    g.strokeStyle = '#22163d';
    g.lineWidth = 3.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-f * 14, -BODY_H + 14);
    g.quadraticCurveTo(-f * 22, -BODY_H + 12 + wave, -f * 29, -BODY_H + 9 - wave);
    g.stroke();
    g.beginPath();
    g.moveTo(-f * 14, -BODY_H + 15);
    g.quadraticCurveTo(-f * 21, -BODY_H + 19 - wave, -f * 27, -BODY_H + 20 + wave);
    g.stroke();
    const ex = f * 5;
    const ey = -BODY_H + 23;
    if (!p.alive) {
      g.strokeStyle = '#22163d';
      g.lineWidth = 2.5;
      for (const ox of [-5, 5]) {
        g.beginPath();
        g.moveTo(ex + ox - 3, ey - 3);
        g.lineTo(ex + ox + 3, ey + 3);
        g.moveTo(ex + ox + 3, ey - 3);
        g.lineTo(ex + ox - 3, ey + 3);
        g.stroke();
      }
    } else {
      const blink = (now / 1000 + p.seat * 1.3) % 3.4 < 0.12;
      const look = p.sword >= 0 ? -Math.sin(aimAngle(p)) * 2 : 0;
      for (const ox of [-5, 5]) {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(ex + ox, ey, 4, blink ? 0.8 : 5, 0, 0, Math.PI * 2);
        g.fill();
        if (!blink) {
          g.fillStyle = '#22163d';
          g.beginPath();
          g.arc(ex + ox + f * 1.6, ey + look, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  }

  function drawHand(p) {
    if (!p.alive || p.sword < 0) return;
    const h = handOf(p);
    g.fillStyle = SEAT_COLOURS[p.seat].dark;
    g.beginPath();
    g.arc(h.x, h.y, 5.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = SEAT_COLOURS[p.seat].main;
    g.beginPath();
    g.arc(h.x - 0.8, h.y - 0.8, 4, 0, Math.PI * 2);
    g.fill();
  }

  // Each fighter's player above its head, the player's own in yellow.
  function drawName(p, lift) {
    if (!p.alive) return;
    const name = game.players[p.seat] + (p.seat === game.you ? ' (you)' : '');
    text(name, p.x, p.y - BODY_H - 14 - lift, 12, p.seat === game.you ? '#ffe066' : '#fff', 'center', 3);
  }

  function drawParts() {
    for (const q of parts) {
      const k = 1 - q.life / q.max;
      g.globalAlpha = Math.min(1, k * 1.6);
      g.fillStyle = q.colour;
      if (q.type === 'star') {
        g.save();
        g.translate(q.x, q.y);
        g.rotate(q.rot);
        const r = q.size * (0.5 + k * 0.5);
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const rad = i % 2 ? r * 0.42 : r;
          const a = (i * Math.PI) / 4;
          g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        g.closePath();
        g.fill();
        g.restore();
      } else {
        g.beginPath();
        g.arc(q.x, q.y, q.size * (0.4 + k * 0.6), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  // The rounds won, as pips in the top corners, and the button's use now.
  function drawScore() {
    const needed = (game.options.rounds + 1) / 2;
    const m = MAPS[view.map];
    for (let seat = 0; seat < 2; seat++) {
      const c = SEAT_COLOURS[seat];
      const left = seat === 0;
      const bx = left ? m.wl + 18 : m.wr - 18;
      for (let k = 0; k < needed; k++) {
        const x = left ? bx + 8 + k * 22 : bx - 8 - k * 22;
        const y = 38;
        g.beginPath();
        g.arc(x, y, 8, 0, Math.PI * 2);
        g.fillStyle = '#1b1233';
        g.fill();
        g.beginPath();
        g.arc(x, y, 6, 0, Math.PI * 2);
        g.fillStyle = k < game.score[seat] ? c.main : 'rgba(255,255,255,.16)';
        g.fill();
      }
    }
    if (!playing() || game.phase === 'roundOver') return;
    const me = view.fighters[game.you];
    if (!me.alive) return;
    const what = me.sword >= 0 ? 'THROW' : me.cling ? 'LET GO TO LEAP' : 'JUMP · HOLD TO CLING';
    const label = `${matchMedia('(pointer: coarse)').matches ? 'TAP' : 'SPACE'}  ·  ${what}`;
    g.font = font(15);
    const w = g.measureText(label).width + 28;
    const x = ARENA_W / 2 - w / 2;
    const y = ARENA_H - 40;
    g.fillStyle = 'rgba(20,12,40,.55)';
    rrect(x, y, w, 26, 13);
    g.fill();
    g.strokeStyle = SEAT_COLOURS[game.you].main;
    g.lineWidth = 2;
    g.stroke();
    text(label, ARENA_W / 2, y + 14, 15, '#fff', 'center', 0);
  }

  function drawWords(now) {
    const since = now - gameAt;
    let words = banner(game, since);
    if (!words && playingSince !== null && now - playingSince < 700) words = { big: 'FIGHT!', colour: '#fff' };
    if (game.phase === 'playing' && !game.over && !game.paused) {
      const left = Math.max(0, game.roundMsLeft - since);
      if (left < 10_000) text(`0:${String(Math.ceil(left / 1000)).padStart(2, '0')}`, ARENA_W / 2, 40, 22, left < 5000 ? '#ff7a7a' : '#fff');
    }
    if (!words) return;
    if (words.big) text(words.big, ARENA_W / 2, ARENA_H / 2 - 50, words.big.length > 12 ? 52 : 70, words.colour || '#fff', 'center', 12);
    if (words.small) text(words.small, ARENA_W / 2, ARENA_H / 2 + 4, 24, '#fff', 'center', 6);
  }

  return {
    update,
    // The world as it is drawn now, for the bot to think about.
    world: () => (game ? view ?? predict(performance.now()) : null),
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', letGoAll);
      root.replaceChildren();
    },
  };
}

// ---- the arena's backdrop ----

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const starRand = seeded(7);
const STARS = Array.from({ length: 60 }, () => ({ x: starRand() * ARENA_W, y: starRand() * 260, r: starRand() * 1.6 + 0.4, p: starRand() * 6 }));
function ridge(seed, base, amp, stepX) {
  const r = seeded(seed);
  const pts = [];
  for (let x = -20; x <= ARENA_W + 40; x += stepX) pts.push([x, base - r() * amp]);
  return pts;
}
const RIDGES = [ridge(11, 330, 120, 70), ridge(23, 380, 90, 55), ridge(37, 430, 60, 45)];

function roundRect(b, x, y, w, h, r) {
  b.beginPath();
  b.moveTo(x + r, y);
  b.arcTo(x + w, y, x + w, y + h, r);
  b.arcTo(x + w, y + h, x, y + h, r);
  b.arcTo(x, y + h, x, y, r);
  b.arcTo(x, y, x + w, y, r);
  b.closePath();
}

function drawRidge(b, pts, colour, deco, layer) {
  b.fillStyle = colour;
  b.beginPath();
  b.moveTo(-20, FLOOR);
  if (deco === 'dunes') {
    b.lineTo(pts[0][0], pts[0][1] + 30);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      b.quadraticCurveTo(x0, y0 + 30 - layer * 4, (x0 + x1) / 2, (y0 + y1) / 2 + 34);
    }
  } else if (deco === 'trees') {
    const r = seeded(91 + layer * 13);
    let x = -20;
    const base = 360 + layer * 40;
    b.lineTo(-20, base);
    while (x < ARENA_W + 40) {
      const w = 26 + r() * 30;
      const h = 70 + r() * 90 - layer * 10;
      b.lineTo(x + w / 2, base - h);
      b.lineTo(x + w, base);
      x += w * 0.7;
    }
  } else {
    for (const [x, y] of pts) b.lineTo(x, y);
  }
  b.lineTo(ARENA_W + 40, FLOOR);
  b.closePath();
  b.fill();
  if (deco === 'snow' && layer === 0) {
    b.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const [xl, yl] = pts[i - 1];
      const [xr, yr] = pts[i + 1];
      if (y < yl && y < yr) {
        b.beginPath();
        b.moveTo(x, y);
        b.lineTo(x + (xl - x) * 0.28, y + (yl - y) * 0.28);
        b.lineTo(x - 6, y + 14);
        b.lineTo(x + 5, y + 10);
        b.lineTo(x + (xr - x) * 0.28, y + (yr - y) * 0.28);
        b.closePath();
        b.fill();
      }
    }
  }
}

// Sky, sun or moon, hills, floor, walls, ceiling and ledges, on a canvas of
// its own.
function drawBackdrop(M, width, height, scale) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const b = c.getContext('2d');
  b.setTransform(scale, 0, 0, scale, 0, 0);
  const sky = b.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, M.sky[0]);
  sky.addColorStop(0.45, M.sky[1]);
  sky.addColorStop(0.8, M.sky[2]);
  sky.addColorStop(1, M.sky[3]);
  b.fillStyle = sky;
  b.fillRect(0, 0, ARENA_W, ARENA_H);
  const sunY = M.stripes ? 360 : 150;
  const sunX = M.stripes ? ARENA_W / 2 : ARENA_W * 0.72;
  const glow = b.createRadialGradient(sunX, sunY, 10, sunX, sunY, M.sunR * 3);
  glow.addColorStop(0, `rgba(${M.glow},.9)`);
  glow.addColorStop(0.35, `rgba(${M.glow},.4)`);
  glow.addColorStop(1, `rgba(${M.glow},0)`);
  b.fillStyle = glow;
  b.fillRect(0, 0, ARENA_W, FLOOR);
  b.fillStyle = M.sun;
  b.beginPath();
  b.arc(sunX, sunY, M.sunR, 0, Math.PI * 2);
  b.fill();
  if (M.stripes) {
    b.fillStyle = M.sky[2];
    b.globalAlpha = 0.55;
    for (let i = 0; i < 4; i++) b.fillRect(sunX - M.sunR - 8, sunY - 8 + i * 13, (M.sunR + 8) * 2, 3 + i);
    b.globalAlpha = 1;
  }
  RIDGES.forEach((pts, i) => drawRidge(b, pts, M.ridges[i], M.deco, i));
  if (M.lava) {
    const lava = b.createLinearGradient(0, FLOOR - 70, 0, FLOOR);
    lava.addColorStop(0, 'rgba(255,110,40,0)');
    lava.addColorStop(1, 'rgba(255,110,40,.35)');
    b.fillStyle = lava;
    b.fillRect(0, FLOOR - 70, ARENA_W, 70);
  }
  const floor = b.createLinearGradient(0, FLOOR, 0, ARENA_H);
  floor.addColorStop(0, M.floor[0]);
  floor.addColorStop(1, M.floor[1]);
  b.fillStyle = floor;
  b.fillRect(0, FLOOR, ARENA_W, ARENA_H - FLOOR);
  b.fillStyle = M.floor[2];
  b.fillRect(0, FLOOR, ARENA_W, 5);
  b.fillStyle = 'rgba(255,255,255,.18)';
  b.fillRect(0, FLOOR, ARENA_W, 2);
  b.strokeStyle = 'rgba(20,12,40,.35)';
  b.lineWidth = 2;
  for (let x = 0; x < ARENA_W; x += 64) {
    const off = ((x / 64) % 2) * 32;
    b.beginPath();
    b.moveTo(x + off, FLOOR + 5);
    b.lineTo(x + off, FLOOR + 30);
    b.stroke();
  }
  b.beginPath();
  b.moveTo(0, FLOOR + 30);
  b.lineTo(ARENA_W, FLOOR + 30);
  b.stroke();
  for (const [x0, x1] of [[0, M.wl], [M.wr, ARENA_W]]) {
    const wall = b.createLinearGradient(x0, 0, x1, 0);
    wall.addColorStop(0, x0 === 0 ? M.wall[0] : M.wall[1]);
    wall.addColorStop(1, x0 === 0 ? M.wall[1] : M.wall[0]);
    b.fillStyle = wall;
    b.fillRect(x0, 0, x1 - x0, ARENA_H);
    b.strokeStyle = 'rgba(15,8,30,.45)';
    b.lineWidth = 2;
    for (let y = 0; y < ARENA_H; y += 26) {
      b.beginPath();
      b.moveTo(x0, y);
      b.lineTo(x1, y);
      b.stroke();
      const off = (y / 26) % 2 ? 0 : 20;
      for (let mx = x0 + off + 13; mx < x1; mx += 40) {
        b.beginPath();
        b.moveTo(mx, y);
        b.lineTo(mx, y + 26);
        b.stroke();
      }
    }
    b.fillStyle = 'rgba(255,255,255,.08)';
    b.fillRect(x0 === 0 ? M.wl - 3 : M.wr, 0, 3, ARENA_H);
  }
  b.fillStyle = M.wall[0];
  b.fillRect(0, 0, ARENA_W, CEIL);
  b.strokeStyle = 'rgba(15,8,30,.45)';
  for (let x = 0; x < ARENA_W; x += 48) {
    b.beginPath();
    b.moveTo(x, 0);
    b.lineTo(x, CEIL);
    b.stroke();
  }
  b.fillStyle = 'rgba(255,255,255,.1)';
  b.fillRect(0, CEIL - 3, ARENA_W, 3);
  for (const [x1, x2, y] of M.plats) {
    b.fillStyle = 'rgba(10,5,25,.25)';
    roundRect(b, x1 + 4, y + 6, x2 - x1, 18, 7);
    b.fill();
    const plat = b.createLinearGradient(0, y, 0, y + 18);
    plat.addColorStop(0, M.plat[0]);
    plat.addColorStop(1, M.plat[1]);
    b.fillStyle = plat;
    roundRect(b, x1, y, x2 - x1, 18, 7);
    b.fill();
    b.fillStyle = M.plat[2];
    roundRect(b, x1, y, x2 - x1, 5, 3);
    b.fill();
    b.strokeStyle = 'rgba(20,12,40,.35)';
    b.lineWidth = 2;
    for (let x = x1 + 38; x < x2 - 10; x += 38) {
      b.beginPath();
      b.moveTo(x, y + 6);
      b.lineTo(x, y + 17);
      b.stroke();
    }
  }
  return c;
}
