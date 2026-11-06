// The match on a canvas, and the controls. Snapshots come SEND_RATE times a
// second. Each frame the world is stepped on from the last one by the same
// code the server runs, with the player's own inputs that the server has
// not answered yet laid in at the moment they were made, so a run, a jump or
// a kick shows at once; when the next snapshot disagrees, what is drawn
// eases over to it rather than jumping.
//
// Keys: A/D or ←/→ to run, W or ↑ to jump, Space, S or ↓ to kick. On a
// touch screen, buttons under the pitch do the same.

import {
  BIG_BALL_TIME, BIG_HEAD_TIME, CROSSBAR_Y, FLOOR, FREEZE_TIME, GOAL_W, ITEM_LIFE, ITEM_R, LOW_TIME_MS,
  MOON_JUMP_TIME, NECK, PITCH_H, PITCH_W, POWER_NAMES, SEAT_COLOURS, SHRINK_TIME, SPEED_TIME, STEP, WALL_TIME,
  BAR_R,
} from '../shared/constants.js';
import { ballRadius, bootOf, facingOf, goalLineOf, headOf, hipOf, kick, setInput, step, unpack } from '../shared/sim.js';
import { el } from '/js/kit/dom.js';

// The colour and the short word on each power-up's bubble.
export const POWER_LOOKS = {
  bigHead: { colour: '#ff9f43', word: 'BIG' },
  shrink: { colour: '#b48cff', word: 'MINI' },
  speed: { colour: '#ffd23f', word: 'FAST' },
  freeze: { colour: '#5ad8ff', word: 'ICE' },
  fire: { colour: '#ff4d4d', word: 'FIRE' },
  bigBall: { colour: '#ff7ad9', word: 'BALL' },
  wall: { colour: '#34d3a6', word: 'WALL' },
  moonJump: { colour: '#9fe870', word: 'JUMP' },
};
// How long each timed power lasts, for the bars under the names.
const POWER_TIMES = {
  bigT: ['bigHead', BIG_HEAD_TIME], smallT: ['shrink', SHRINK_TIME], speedT: ['speed', SPEED_TIME],
  freezeT: ['freeze', FREEZE_TIME], moonT: ['moonJump', MOON_JUMP_TIME], wallT: ['wall', WALL_TIME],
};

// The world is not stepped on further than this past the last snapshot.
const MAX_PREDICT_MS = 350;
// How quickly a difference between the guess and the server fades (per second).
const SETTLE_RATE = 12;
// A difference bigger than this is not eased over but jumped.
const SNAP_DISTANCE = 120;
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump',
  Space: 'kick', ArrowDown: 'kick', KeyS: 'kick',
};
const FONT = '800 {px}px system-ui, -apple-system, "Segoe UI", sans-serif';
const font = (px) => FONT.replace('{px}', px);
const rnd = (a, b) => a + Math.random() * (b - a);
// Whether a key went to something being typed in (the chat) or to a dialog
// of the page, rather than to the match.
const NOT_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range']);
const typing = (t) => t instanceof Element && Boolean(t.closest('textarea, select, dialog, [contenteditable]') ||
  (t.matches('input') && !NOT_TEXT.has(t.type)));
// The two looks of the players' heads.
const LOOKS = [
  { skin: '#f3c9a3', shade: '#d9a37c', hair: '#3b2416', style: 'spikes' },
  { skin: '#c98f62', shade: '#a8714a', hair: '#f2c94c', style: 'quiff' },
];

// `send(action)` sends an action of the player's own seat. `banner(game,
// msSinceSnapshot)` gives the words written across the pitch, if any:
// { big, small, colour }. The touch buttons go in `padRoot`, under the
// pitch, so that they never hide the goals.
export function createArena(root, { send, banner, padRoot }) {
  const canvas = el('canvas', { className: 'kickmyballsCanvas' });
  const pad = el('div', { className: 'kickmyballsPad' });
  root.replaceChildren(canvas);
  padRoot.replaceChildren(pad);
  const g = canvas.getContext('2d');

  let game = null; // the last snapshot
  let gameAt = 0; // performance.now() when it came
  let view = null; // the world as drawn this frame
  let lastEvent = 0;
  let playingSince = null;
  const offsets = { players: [{ x: 0, y: 0 }, { x: 0, y: 0 }], ball: { x: 0, y: 0 } };
  let parts = [];
  let shake = 0;
  let netShake = [0, 0]; // how much each net still ripples from a goal
  let mood = [0, 0]; // +1 just scored, -1 just let one in, fading

  // ---- the controls ----

  let seq = 0;
  let pending = []; // own inputs and kicks the server has not answered: { seq, type, input, at }
  const held = { left: new Set(), right: new Set(), jump: new Set() }; // what holds each: key codes, pointer ids
  let sentInput = { left: false, right: false, jump: false };

  const playing = () => Boolean(game && game.you !== null && !game.over);

  function sendInput(now) {
    const input = { left: held.left.size > 0, right: held.right.size > 0, jump: held.jump.size > 0 };
    if (input.left === sentInput.left && input.right === sentInput.right && input.jump === sentInput.jump) return;
    sentInput = input;
    if (!playing()) return;
    seq++;
    pending.push({ seq, type: 'input', input, at: now });
    send({ action: 'input', seq, ...input });
  }
  function pressKick(now) {
    if (!playing()) return;
    seq++;
    pending.push({ seq, type: 'kick', at: now });
    send({ action: 'kick', seq });
  }
  function hold(what, source, down, now) {
    if (what === 'kick') {
      if (down) pressKick(now);
      return;
    }
    if (down) held[what].add(source);
    else held[what].delete(source);
    sendInput(now);
  }
  function letGoAll() {
    for (const set of Object.values(held)) set.clear();
    sendInput(performance.now());
  }

  function onKey(e) {
    const what = KEYS[e.code];
    if (!what || e.ctrlKey || e.metaKey || e.altKey || !playing()) return;
    if (typing(e.target)) return;
    e.preventDefault();
    // A button or checkbox clicked a moment ago (Resign, the chat's switch)
    // would take Space as a click of its own.
    if (e.target instanceof HTMLElement && e.target !== document.body) e.target.blur();
    if (e.type === 'keydown' && e.repeat) return;
    hold(what, e.code, e.type === 'keydown', performance.now());
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', letGoAll);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Buttons under the pitch for a touch screen: run left and right on one
  // side, jump and kick on the other. Each finger is followed by its id.
  const buttons = [['left', '◀'], ['right', '▶'], ['jump', '▲'], ['kick', 'KICK']].map(([what, label]) => {
    const button = el('button', { type: 'button', className: `kickmyballsPadButton ${what}`, textContent: label, tabIndex: -1 });
    const down = (e) => {
      e.preventDefault();
      try { button.setPointerCapture(e.pointerId); } catch { /* not needed */ }
      button.classList.add('down');
      hold(what, `p${e.pointerId}`, true, performance.now());
    };
    const up = (e) => {
      button.classList.remove('down');
      hold(what, `p${e.pointerId}`, false, performance.now());
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
    return button;
  });
  pad.append(el('div', { className: 'kickmyballsPadSide' }, buttons[0], buttons[1]),
    el('div', { className: 'kickmyballsPadSide' }, buttons[2], buttons[3]));

  // ---- following the server ----

  // The world as it should be at `now`: the last snapshot stepped on, with
  // the inputs the server has not seen yet.
  function predict(now) {
    const w = unpack(game.world);
    if (game.over || game.paused || w.phase === 'countdown') return w;
    const mine = game.you;
    const apply = (entry) => {
      if (entry.type === 'input') setInput(w, mine, entry.input);
      else kick(w, mine);
    };
    const end = Math.min(now, gameAt + MAX_PREDICT_MS);
    let i = 0;
    while (i < pending.length && pending[i].at <= gameAt) apply(pending[i++]);
    const stepMs = STEP * 1000;
    let t = gameAt;
    while (t + stepMs <= end) {
      while (i < pending.length && pending[i].at <= t + stepMs) apply(pending[i++]);
      step(w, STEP);
      t += stepMs;
    }
    while (i < pending.length && pending[i].at <= end) apply(pending[i++]);
    if (end > t) step(w, (end - t) / 1000);
    return w;
  }

  function update(snapshot) {
    const now = performance.now();
    const fresh = !game || game.id !== snapshot.id;
    const before = fresh ? null : view ?? predict(now);
    const wasPhase = game?.phase;
    game = snapshot;
    gameAt = now;
    const live = playing();
    pad.classList.toggle('on', live);
    canvas.classList.toggle('controls', live);
    if (!live) for (const set of Object.values(held)) set.clear();
    if (fresh) {
      pending = [];
      seq = Math.max(seq, game.you === null ? 0 : game.acks[game.you] ?? 0);
      sentInput = { left: false, right: false, jump: false };
      lastEvent = game.world.eventId; // what happened before we came is not replayed
      parts = [];
      mood = [0, 0];
      for (const o of [...offsets.players, offsets.ball]) o.x = o.y = 0;
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
    if (before && !(wasPhase === 'goal' && game.phase === 'countdown')) {
      after.players.forEach((p, i) => {
        const was = before.players[i];
        const o = offsets.players[i];
        const dx = was.x + o.x - p.x;
        const dy = was.y + o.y - p.y;
        if (Math.hypot(dx, dy) < SNAP_DISTANCE) Object.assign(o, { x: dx, y: dy });
        else Object.assign(o, { x: 0, y: 0 });
      });
      const o = offsets.ball;
      const dx = before.ball.x + o.x - after.ball.x;
      const dy = before.ball.y + o.y - after.ball.y;
      if (Math.hypot(dx, dy) < SNAP_DISTANCE) Object.assign(o, { x: dx, y: dy });
      else Object.assign(o, { x: 0, y: 0 });
    } else {
      for (const o of [...offsets.players, offsets.ball]) o.x = o.y = 0;
    }
    view = after;
  }

  // Sparks, dust and shakes for what the server says happened.
  function effect(e) {
    switch (e.type) {
      case 'kick':
        burst(e.x, e.y, 10, ['#fff', '#e8f5d0'], 260, { g: 400, lmin: 0.15, lmax: 0.35, smin: 1.5, smax: 3.5 });
        shake = Math.max(shake, 2);
        break;
      case 'fire':
        burst(e.x, e.y, 22, ['#ffd23f', '#ff9f43', '#ff4d4d', '#fff'], 420, { g: 0, lmin: 0.25, lmax: 0.55, smin: 2, smax: 5 });
        shake = Math.max(shake, 7);
        break;
      case 'header':
        burst(e.x, e.y, 6, ['#fff'], 160, { g: 300, lmin: 0.12, lmax: 0.25, smin: 1.5, smax: 3 });
        break;
      case 'post':
        burst(e.x, e.y, 14, ['#fff', '#ffe68a', '#ffd23f'], 320, { g: 300, lmin: 0.15, lmax: 0.35, smin: 1.5, smax: 3 });
        shake = Math.max(shake, 4);
        break;
      case 'block':
        burst(e.x, e.y, 16, [POWER_LOOKS.wall.colour, '#fff'], 320, { g: 200, lmin: 0.2, lmax: 0.4, smin: 2, smax: 4 });
        shake = Math.max(shake, 4);
        break;
      case 'goal': {
        const net = e.seat ? 0 : 1; // the goal it went into
        netShake[net] = 1;
        mood[e.seat] = 1;
        mood[1 - e.seat] = -1;
        const colours = [SEAT_COLOURS[e.seat].main, SEAT_COLOURS[e.seat].light, '#fff', '#ffd23f'];
        burst(e.x, e.y, 40, colours, 520, { type: 'star', lmin: 0.6, lmax: 1.3, smin: 3, smax: 7, g: 500 });
        for (let k = 0; k < 50; k++) {
          parts.push({
            x: rnd(120, PITCH_W - 120), y: rnd(-40, 0), vx: rnd(-40, 40), vy: rnd(60, 180), life: 0, max: rnd(1.6, 2.6),
            size: rnd(3, 6), colour: colours[k % colours.length], g: 40, type: 'confetti', rot: rnd(0, 6), vr: rnd(-8, 8),
          });
        }
        shake = 12;
        break;
      }
      case 'spawn':
        burst(e.x, e.y, 14, [POWER_LOOKS[e.kind]?.colour ?? '#fff', '#fff'], 160, { type: 'star', g: 0, lmin: 0.3, lmax: 0.6, smin: 2, smax: 4 });
        break;
      case 'power': {
        const look = POWER_LOOKS[e.kind] ?? { colour: '#fff' };
        burst(e.x, e.y, 20, [look.colour, '#fff'], 260, { type: 'star', g: 0, lmin: 0.3, lmax: 0.6, smin: 2, smax: 5 });
        label(POWER_NAMES[e.kind] ?? '', e.x, e.y - 30, look.colour);
        break;
      }
      case 'flatten':
        burst(e.x, e.y, 24, ['#ffd23f', '#ff9f43', '#fff'], 360, { type: 'star', g: 400, lmin: 0.3, lmax: 0.7, smin: 2, smax: 5 });
        shake = Math.max(shake, 9);
        break;
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
  // Words that rise and fade: the name of a power-up just taken.
  function label(words, x, y, colour) {
    parts.push({ x, y, vx: 0, vy: -45, life: 0, max: 1.4, size: 0, colour, g: 0, type: 'text', words, rot: 0, vr: 0 });
  }

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
    for (const o of [...offsets.players, offsets.ball]) { o.x *= fade; o.y *= fade; }
    shake = Math.max(0, shake - dt * 40);
    netShake = netShake.map((n) => Math.max(0, n - dt * 0.6));
    mood = mood.map((m) => (Math.abs(m) < 0.01 ? 0 : m * 0.4 ** dt));
    for (const q of parts) {
      q.life += dt;
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.type !== 'confetti') q.vx *= 0.3 ** dt;
      if (q.y > FLOOR && q.vy > 0 && q.type !== 'dot' && q.type !== 'text') { q.y = FLOOR; q.vy *= -0.3; q.vx *= 0.5; }
    }
    // A fire shot leaves flames behind it.
    const ball = view.ball;
    if (ball.fireT > 0 && game.phase !== 'countdown') {
      for (let k = 0; k < 3; k++) {
        parts.push({
          x: ball.x + offsets.ball.x + rnd(-6, 6), y: ball.y + offsets.ball.y + rnd(-6, 6), vx: -ball.vx * 0.1 + rnd(-30, 30),
          vy: rnd(-60, -10), life: 0, max: rnd(0.2, 0.4), size: rnd(4, 9),
          colour: ['#ffd23f', '#ff9f43', '#ff4d4d'][k], g: -100, type: 'dot', rot: 0, vr: 0,
        });
      }
    }
    parts = parts.filter((q) => q.life < q.max);
    if (parts.length > 600) parts = parts.slice(-600);
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

  let backdrop = null; // the stadium, drawn once per size

  function draw(now) {
    const scale = canvas.width / PITCH_W;
    if (!backdrop) backdrop = drawBackdrop(canvas.width, canvas.height, scale);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(backdrop, 0, 0);
    const sx = shake ? rnd(-shake, shake) : 0;
    const sy = shake ? rnd(-shake, shake) : 0;
    g.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);

    const w = view;
    const players = w.players.map((p, i) => ({ ...p, x: p.x + offsets.players[i].x, y: p.y + offsets.players[i].y }));
    const ball = { ...w.ball, x: w.ball.x + offsets.ball.x, y: w.ball.y + offsets.ball.y };

    for (const side of [0, 1]) drawNet(side, now);
    for (const p of players) shadow(p.x, 44);
    shadow(ball.x, ballRadius(ball) * 2, Math.max(0, FLOOR - ball.y) / 300);
    for (const item of w.items) drawItem(item, now);
    for (const p of players) drawPlayer(p, ball, now);
    drawBall(ball);
    for (const side of [0, 1]) drawGoalFront(side, players[side].wallT, now);
    drawParts();
    drawScoreboard(now);
    drawPowers(players);
    drawWords(now);
  }

  // A soft dark patch on the grass under something `width` across, fainter
  // the higher `lift` (0 on the grass, 1 high up) has it.
  function shadow(x, width, lift = 0) {
    g.save();
    g.globalAlpha = 0.28 * (1 - Math.min(0.8, lift));
    g.fillStyle = '#0b2a0b';
    g.beginPath();
    g.ellipse(x, FLOOR + 3, (width / 2) * (1 - lift * 0.4), 5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // The back and side of a goal's net, which ripples after a goal.
  function drawNet(side, now) {
    const x1 = side ? PITCH_W - GOAL_W : 0;
    const top = CROSSBAR_Y;
    const ripple = netShake[side];
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.2;
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(x1, top, GOAL_W, FLOOR - top);
    for (let x = 6; x < GOAL_W; x += 10) {
      g.beginPath();
      for (let y = top; y <= FLOOR; y += 8) {
        const wave = ripple ? Math.sin(now / 50 + y / 12 + x) * ripple * 4 : 0;
        const px = x1 + x + wave;
        if (y === top) g.moveTo(px, y);
        else g.lineTo(px, y);
      }
      g.stroke();
    }
    for (let y = top + 8; y < FLOOR; y += 10) {
      const wave = ripple ? Math.sin(now / 60 + y / 10) * ripple * 3 : 0;
      g.beginPath();
      g.moveTo(x1, y + wave);
      g.lineTo(x1 + GOAL_W, y - wave);
      g.stroke();
    }
    // The back post.
    g.fillStyle = '#e9edf2';
    g.fillRect(side ? PITCH_W - 6 : 0, top - BAR_R, 6, FLOOR - top + BAR_R);
    g.restore();
  }

  // The crossbar and the front post, in front of the players; and a goal
  // wall, if one is up.
  function drawGoalFront(side, wallT, now) {
    const [x1, x2] = side ? [PITCH_W - GOAL_W, PITCH_W] : [0, GOAL_W];
    const line = goalLineOf(side);
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = BAR_R * 2 + 3;
    g.beginPath();
    g.moveTo(x1, CROSSBAR_Y + 2);
    g.lineTo(x2, CROSSBAR_Y + 2);
    g.stroke();
    g.strokeStyle = '#ffffff';
    g.lineWidth = BAR_R * 2;
    g.beginPath();
    g.moveTo(x1, CROSSBAR_Y);
    g.lineTo(x2, CROSSBAR_Y);
    g.stroke();
    g.lineWidth = 4;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(line, CROSSBAR_Y);
    g.lineTo(line, FLOOR);
    g.stroke();
    if (wallT > 0) {
      const flicker = wallT < 1.5 ? 0.5 + 0.5 * Math.sin(now / 40) : 1;
      g.globalAlpha = 0.55 * flicker;
      const grad = g.createLinearGradient(line - 8, 0, line + 8, 0);
      grad.addColorStop(0, 'rgba(52,211,166,0)');
      grad.addColorStop(0.5, POWER_LOOKS.wall.colour);
      grad.addColorStop(1, 'rgba(52,211,166,0)');
      g.fillStyle = grad;
      g.fillRect(line - 8, CROSSBAR_Y, 16, FLOOR - CROSSBAR_Y);
      g.globalAlpha = 0.9 * flicker;
      g.strokeStyle = '#d6fff2';
      g.lineWidth = 2;
      for (let y = CROSSBAR_Y + ((now / 20) % 16); y < FLOOR; y += 16) {
        g.beginPath();
        g.moveTo(line - 6, y);
        g.lineTo(line + 6, y + 6);
        g.stroke();
      }
    }
    g.restore();
  }

  function drawItem(item, now) {
    const look = POWER_LOOKS[item.kind] ?? { colour: '#fff', word: '?' };
    const bob = Math.sin(now / 300 + item.id) * 4;
    const fading = item.t > ITEM_LIFE - 2 && Math.floor(now / 120) % 2 === 0;
    const x = item.x;
    const y = item.y + bob;
    g.save();
    g.globalAlpha = fading ? 0.35 : 1;
    const glow = g.createRadialGradient(x, y, ITEM_R * 0.3, x, y, ITEM_R * 1.7);
    glow.addColorStop(0, `${look.colour}aa`);
    glow.addColorStop(1, `${look.colour}00`);
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, ITEM_R * 1.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = look.colour;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, ITEM_R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(x - 6, y - 8, 8, 5, -0.5, 0, Math.PI * 2);
    g.fill();
    text(look.word, x, y + 5, look.word.length > 3 ? 11 : 13, '#fff', 'center', 3);
    g.restore();
  }

  function drawPlayer(p, ball, now) {
    const seat = p.seat;
    const facing = facingOf(seat);
    const colour = SEAT_COLOURS[seat];
    const look = LOOKS[seat];
    const head = headOf(p);
    const r = head.r;
    const flat = p.flatT > 0;
    g.save();
    if (flat) {
      // Flattened by a fire shot: squashed on the grass, seeing stars.
      g.translate(p.x, FLOOR);
      g.scale(1.35, 0.42);
      g.translate(-p.x, -FLOOR);
    }
    // Speed boots leave lines behind a runner.
    if (p.speedT > 0 && Math.abs(p.vx) > 50) {
      g.strokeStyle = 'rgba(255,210,63,0.7)';
      g.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        const yy = p.y - 12 - k * 16;
        g.beginPath();
        g.moveTo(p.x - Math.sign(p.vx) * (24 + k * 4), yy);
        g.lineTo(p.x - Math.sign(p.vx) * (44 + k * 8), yy);
        g.stroke();
      }
    }
    // The back boot, and the body.
    g.fillStyle = '#1d1d22';
    g.beginPath();
    g.ellipse(p.x - facing * 8, p.y - 6, 11, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = colour.dark;
    rrect(p.x - 13, p.y - NECK - 8, 26, 22, 8);
    g.fill();
    g.fillStyle = colour.main;
    rrect(p.x - 11, p.y - NECK - 6, 22, 16, 6);
    g.fill();
    // The kicking leg and its boot.
    const hip = hipOf(p);
    const boot = bootOf(p);
    g.strokeStyle = colour.light;
    g.lineWidth = 8;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hip.x, hip.y);
    g.lineTo(boot.x, boot.y);
    g.stroke();
    g.save();
    g.translate(boot.x, boot.y);
    g.rotate(Math.atan2(boot.y - hip.y, boot.x - hip.x) - facing * Math.PI / 2 + (facing > 0 ? 0 : Math.PI));
    g.fillStyle = p.fire ? '#ff6a3d' : '#1d1d22';
    g.beginPath();
    g.ellipse(facing * 4, 0, boot.r + 3, boot.r - 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = colour.main;
    g.fillRect(-3, -boot.r + 4, 6, (boot.r - 4) * 2);
    g.restore();
    if (p.fire) {
      // A fire shot waits in the boot.
      for (let k = 0; k < 2; k++) {
        g.fillStyle = k ? '#ffd23f' : '#ff4d4d';
        g.beginPath();
        g.arc(boot.x + rnd(-4, 4), boot.y - 8 - rnd(0, 8), rnd(3, 6), 0, Math.PI * 2);
        g.fill();
      }
    }
    if (p.moonT > 0) {
      g.fillStyle = 'rgba(159,232,112,0.35)';
      g.beginPath();
      g.ellipse(p.x, p.y - 2, 26, 6, 0, 0, Math.PI * 2);
      g.fill();
    }

    // The head.
    g.fillStyle = look.shade;
    g.beginPath();
    g.arc(head.x, head.y + 2, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = look.skin;
    g.beginPath();
    g.arc(head.x, head.y, r, 0, Math.PI * 2);
    g.fill();
    // The ear on the far side from where it faces.
    g.fillStyle = look.shade;
    g.beginPath();
    g.ellipse(head.x - facing * r * 0.78, head.y + r * 0.08, r * 0.17, r * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    drawHair(head, facing, look);
    // A headband in the seat's colour.
    g.save();
    g.beginPath();
    g.arc(head.x, head.y, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = colour.main;
    g.fillRect(head.x - r, head.y - r * 0.5, r * 2, r * 0.22);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(head.x - r, head.y - r * 0.5, r * 2, r * 0.05);
    g.restore();
    drawFace(p, head, facing, ball, flat);
    g.restore();

    if (flat) {
      // Stars circling the flattened head.
      for (let k = 0; k < 4; k++) {
        const a = now / 200 + (k * Math.PI) / 2;
        star(p.x + Math.cos(a) * 30, FLOOR - 30 + Math.sin(a) * 8, 6, '#ffd23f');
      }
    }
    if (p.freezeT > 0) {
      // A block of ice.
      const top = head.y - r - 6;
      g.save();
      g.globalAlpha = 0.5;
      g.fillStyle = '#bfefff';
      rrect(p.x - r - 8, top, (r + 8) * 2, p.y - top + 4, 8);
      g.fill();
      g.globalAlpha = 0.9;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.stroke();
      g.beginPath();
      g.moveTo(p.x - r, top + 10);
      g.lineTo(p.x - r + 14, top + 24);
      g.moveTo(p.x + r - 4, p.y - 30);
      g.lineTo(p.x + r - 16, p.y - 14);
      g.stroke();
      g.restore();
    }
  }

  function drawHair(head, facing, look) {
    const { x, y, r } = head;
    g.fillStyle = look.hair;
    g.beginPath();
    if (look.style === 'spikes') {
      g.moveTo(x - r * 0.98, y - r * 0.15);
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        const out = k % 2 ? 1.0 : 1.28;
        g.lineTo(x + Math.cos(a) * r * out - facing * r * 0.1 * (k % 2 ? 0 : 1), y + Math.sin(a) * r * out);
      }
      g.lineTo(x + r * 0.98, y - r * 0.15);
      g.quadraticCurveTo(x, y - r * 0.55, x - r * 0.98, y - r * 0.15);
    } else {
      g.moveTo(x - r * 0.98, y - r * 0.05);
      g.quadraticCurveTo(x - r * 1.05, y - r * 1.2, x + facing * r * 0.2, y - r * 1.15);
      g.quadraticCurveTo(x + facing * r * 1.35, y - r * 1.2, x + facing * r * 1.05, y - r * 0.55);
      g.quadraticCurveTo(x + facing * r * 0.3, y - r * 0.75, x - r * 0.98, y - r * 0.05);
    }
    g.fill();
  }

  // Eyes that follow the ball, and a mouth that grins after a goal and
  // gapes after one let in.
  function drawFace(p, head, facing, ball, flat) {
    const { x, y, r } = head;
    const eyeY = y - r * 0.12;
    const eyes = [x + facing * r * 0.12, x + facing * r * 0.5];
    const look = Math.atan2(ball.y - eyeY, ball.x - x);
    for (const ex of eyes) {
      if (flat) {
        g.strokeStyle = '#2a1a12';
        g.lineWidth = 2.5;
        const s = r * 0.12;
        g.beginPath();
        g.moveTo(ex - s, eyeY - s);
        g.lineTo(ex + s, eyeY + s);
        g.moveTo(ex + s, eyeY - s);
        g.lineTo(ex - s, eyeY + s);
        g.stroke();
        continue;
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(ex, eyeY, r * 0.17, r * 0.21, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1f1410';
      g.beginPath();
      g.arc(ex + Math.cos(look) * r * 0.07, eyeY + Math.sin(look) * r * 0.08, r * 0.085, 0, Math.PI * 2);
      g.fill();
    }
    // Eyebrows, lower and angrier with a fire shot ready.
    g.strokeStyle = LOOKS[p.seat].hair;
    g.lineWidth = Math.max(2, r * 0.08);
    g.lineCap = 'round';
    for (const ex of eyes) {
      const tilt = p.fire ? 0.12 : -0.04;
      g.beginPath();
      g.moveTo(ex - r * 0.16, eyeY - r * 0.3 - facing * tilt * r * (ex === eyes[0] ? 1 : -1));
      g.lineTo(ex + r * 0.16, eyeY - r * 0.3 + facing * tilt * r * (ex === eyes[0] ? 1 : -1));
      g.stroke();
    }
    const m = mood[p.seat];
    const mx = x + facing * r * 0.32;
    const my = y + r * 0.42;
    g.strokeStyle = '#5a2a1c';
    g.lineWidth = Math.max(2, r * 0.08);
    g.beginPath();
    if (m > 0.2) {
      g.fillStyle = '#5a2a1c';
      g.arc(mx, my - r * 0.06, r * 0.24, 0.1, Math.PI - 0.1);
      g.closePath();
      g.fill();
    } else if (m < -0.2 || flat) {
      g.fillStyle = '#5a2a1c';
      g.ellipse(mx, my, r * 0.1, r * 0.14, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.arc(mx, my - r * 0.15, r * 0.2, 0.35, Math.PI - 0.35);
      g.stroke();
    }
  }

  function drawBall(ball) {
    const r = ballRadius(ball);
    g.save();
    if (ball.fireT > 0) {
      const glow = g.createRadialGradient(ball.x, ball.y, r * 0.5, ball.x, ball.y, r * 2.4);
      glow.addColorStop(0, 'rgba(255,170,60,0.9)');
      glow.addColorStop(1, 'rgba(255,60,40,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(ball.x, ball.y, r * 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.translate(ball.x, ball.y);
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = ball.bigT > 0 ? '#fff5d6' : '#ffffff';
    g.fill();
    g.save();
    g.clip();
    g.rotate(ball.rot);
    if (ball.bigT > 0) {
      // A beach ball: coloured segments.
      const colours = ['#ff5a6e', '#ffd23f', '#46b3ff', '#8ee35a', '#ff9f43', '#b48cff'];
      for (let k = 0; k < 6; k++) {
        g.fillStyle = colours[k];
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, r, (k * Math.PI) / 3, ((k + 0.5) * Math.PI) / 3);
        g.closePath();
        g.fill();
      }
    } else {
      // A football: a dark patch in the middle and five around the edge.
      g.fillStyle = '#23232a';
      pentagon(0, 0, r * 0.38, 0);
      for (let k = 0; k < 5; k++) {
        const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
        pentagon(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.32, a + Math.PI);
      }
      g.strokeStyle = '#9aa0a8';
      g.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38);
        g.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
        g.stroke();
      }
    }
    g.restore();
    const shine = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    shine.addColorStop(0, 'rgba(255,255,255,0.55)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0)');
    shine.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = shine;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  function pentagon(x, y, r, a) {
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const b = a + (k * 2 * Math.PI) / 5;
      if (k) g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r);
      else g.moveTo(x + Math.cos(b) * r, y + Math.sin(b) * r);
    }
    g.closePath();
    g.fill();
  }

  function star(x, y, r, colour) {
    g.fillStyle = colour;
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5 - Math.PI / 2;
      const rr = k % 2 ? r * 0.45 : r;
      if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }

  function drawParts() {
    for (const q of parts) {
      const a = 1 - q.life / q.max;
      g.globalAlpha = Math.max(0, Math.min(1, a * 1.5));
      if (q.type === 'text') {
        text(q.words, q.x, q.y, 20, q.colour, 'center', 5);
      } else if (q.type === 'star') {
        star(q.x, q.y, q.size, q.colour);
      } else if (q.type === 'confetti') {
        g.save();
        g.translate(q.x, q.y);
        g.rotate(q.rot);
        g.fillStyle = q.colour;
        g.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        g.restore();
      } else {
        g.fillStyle = q.colour;
        g.beginPath();
        g.arc(q.x, q.y, q.size * (0.4 + 0.6 * a), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
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
    g.textBaseline = 'alphabetic';
    if (lw) {
      g.lineJoin = 'round';
      g.lineWidth = lw;
      g.strokeStyle = 'rgba(10,20,35,0.85)';
      g.strokeText(str, x, y);
    }
    g.fillStyle = fill;
    g.fillText(str, x, y);
  }

  // The clock left, counting down between snapshots while the ball is in play.
  function clockLeft(now) {
    let ms = game.clockMs;
    if (game.phase === 'playing' && !game.paused && !game.over) ms = Math.max(0, ms - (now - gameAt));
    return ms;
  }

  // The names, the score and the clock along the top.
  function drawScoreboard(now) {
    const ms = clockLeft(now);
    const secs = Math.ceil(ms / 1000);
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const cx = PITCH_W / 2;
    g.save();
    g.fillStyle = 'rgba(12,22,40,0.82)';
    rrect(cx - 250, 8, 500, 44, 12);
    g.fill();
    for (const seat of [0, 1]) {
      const dir = seat ? 1 : -1;
      g.fillStyle = SEAT_COLOURS[seat].main;
      rrect(cx + dir * 46 - (seat ? 0 : 44), 14, 44, 32, 8);
      g.fill();
      text(String(game.score[seat]), cx + dir * 68, 40, 26, '#fff', 'center', 0);
      const name = game.players[seat] + (seat === game.you ? ' (you)' : '');
      text(fit(name, 145), cx + dir * 100, 37, 15, '#fff', seat ? 'left' : 'right', 0);
    }
    const low = ms <= LOW_TIME_MS && !game.over;
    text(clock, cx, 38, 20, low && Math.floor(now / 500) % 2 === 0 ? '#ff7a7a' : '#ffffff', 'center', 0);
    g.restore();
  }

  // Shortens a name to fit `width` pitch pixels in the scoreboard's font.
  function fit(name, width) {
    g.font = font(15);
    if (g.measureText(name).width <= width) return name;
    let s = name;
    while (s.length > 1 && g.measureText(`${s}…`).width > width) s = s.slice(0, -1);
    return `${s}…`;
  }

  // Under each name, the power-ups that player has running, with what is
  // left of them.
  function drawPowers(players) {
    for (const p of players) {
      const list = [];
      for (const [key, [kind, total]] of Object.entries(POWER_TIMES)) if (p[key] > 0) list.push({ kind, left: p[key] / total });
      if (p.fire) list.push({ kind: 'fire', left: 1 });
      const dir = p.seat ? 1 : -1;
      list.forEach((power, k) => {
        const look = POWER_LOOKS[power.kind];
        const x = PITCH_W / 2 + dir * (70 + k * 46);
        const y = 72;
        g.save();
        g.fillStyle = 'rgba(12,22,40,0.75)';
        rrect(x - 21, y - 12, 42, 24, 7);
        g.fill();
        g.fillStyle = look.colour;
        rrect(x - 19, y + 6, 38 * power.left, 4, 2);
        g.fill();
        text(look.word, x, y + 3, 11, look.colour, 'center', 0);
        g.restore();
      });
    }
    const ball = view.ball;
    if (ball.bigT > 0) {
      const look = POWER_LOOKS.bigBall;
      g.save();
      g.fillStyle = 'rgba(12,22,40,0.75)';
      rrect(PITCH_W / 2 - 21, 60, 42, 24, 7);
      g.fill();
      g.fillStyle = look.colour;
      rrect(PITCH_W / 2 - 19, 78, 38 * (ball.bigT / BIG_BALL_TIME), 4, 2);
      g.fill();
      text(look.word, PITCH_W / 2, 75, 11, look.colour, 'center', 0);
      g.restore();
    }
  }

  function drawWords(now) {
    const since = now - gameAt;
    let words = banner(game, since);
    if (!words && playingSince !== null && now - playingSince < 800) words = { big: 'KICK OFF!', colour: '#ffffff' };
    if (!words) return;
    if (words.big) text(words.big, PITCH_W / 2, PITCH_H / 2 - 40, words.big.length > 12 ? 54 : 74, words.colour || '#fff', 'center', 12);
    if (words.small) text(words.small, PITCH_W / 2, PITCH_H / 2 + 8, 24, '#fff', 'center', 6);
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
      padRoot.replaceChildren();
    },
  };
}

// ---- the stadium ----

// The same pseudo-random numbers every time, so that the crowd does not
// change between redraws.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// The still parts: the sky, the stands and their crowd, the floodlights,
// the boards and the grass with its lines, drawn once per size.
function drawBackdrop(width, height, scale) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const b = c.getContext('2d');
  b.setTransform(scale, 0, 0, scale, 0, 0);
  const rand = seeded(7);

  const sky = b.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, '#0d1b3d');
  sky.addColorStop(0.55, '#26457a');
  sky.addColorStop(1, '#4c76a8');
  b.fillStyle = sky;
  b.fillRect(0, 0, PITCH_W, FLOOR);

  // Floodlights on their masts.
  for (const x of [120, PITCH_W - 120]) {
    const beam = b.createRadialGradient(x, 40, 5, x, 40, 260);
    beam.addColorStop(0, 'rgba(255,250,220,0.55)');
    beam.addColorStop(1, 'rgba(255,250,220,0)');
    b.fillStyle = beam;
    b.fillRect(x - 260, 0, 520, 320);
    b.fillStyle = '#2a3346';
    b.fillRect(x - 3, 40, 6, 120);
    b.fillStyle = '#e8ecf5';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) b.fillRect(x - 22 + i * 11, 22 + j * 10, 9, 8);
  }

  // The stands: rows of seats going back, filled with a crowd.
  const standTop = 150;
  const standBottom = FLOOR - 70;
  b.fillStyle = '#1a2440';
  b.beginPath();
  b.moveTo(0, standBottom);
  b.lineTo(0, standTop + 40);
  b.quadraticCurveTo(PITCH_W / 2, standTop - 30, PITCH_W, standTop + 40);
  b.lineTo(PITCH_W, standBottom);
  b.closePath();
  b.fill();
  b.save();
  b.clip();
  const crowd = ['#ef4a5d', '#3fa4f5', '#ffd23f', '#f5f5f5', '#8ee35a', '#ff9f43', '#2b2b36', '#b48cff'];
  for (let y = standTop - 20; y < standBottom; y += 9) {
    b.fillStyle = 'rgba(255,255,255,0.05)';
    b.fillRect(0, y + 6, PITCH_W, 2);
    for (let x = 3 + ((y / 9) % 2) * 4; x < PITCH_W; x += 8) {
      if (rand() < 0.12) continue;
      b.fillStyle = crowd[Math.floor(rand() * crowd.length)];
      b.globalAlpha = 0.55 + rand() * 0.4;
      b.beginPath();
      b.arc(x, y + 2, 2.6, 0, Math.PI * 2);
      b.fill();
    }
  }
  b.globalAlpha = 1;
  b.restore();

  // The boards around the pitch.
  const boardTop = standBottom;
  const boardH = FLOOR - 40 - boardTop;
  for (let x = 0, k = 0; x < PITCH_W; x += 160, k++) {
    b.fillStyle = k % 2 ? '#13325c' : '#1b4479';
    b.fillRect(x, boardTop, 160, boardH);
    b.fillStyle = 'rgba(255,255,255,0.85)';
    b.font = '800 16px system-ui, -apple-system, "Segoe UI", sans-serif';
    b.textAlign = 'center';
    b.fillText(k % 2 ? 'GAME ROOM' : 'KICKMYBALLS', x + 80, boardTop + boardH / 2 + 6);
  }

  // The grass, in stripes, seen a little from above.
  const grassTop = FLOOR - 40;
  for (let x = 0, k = 0; x < PITCH_W; x += 80, k++) {
    b.fillStyle = k % 2 ? '#3f9a3a' : '#4aa944';
    b.fillRect(x, grassTop, 80, PITCH_H - grassTop);
  }
  const fadeTop = b.createLinearGradient(0, grassTop, 0, grassTop + 14);
  fadeTop.addColorStop(0, 'rgba(0,0,0,0.25)');
  fadeTop.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = fadeTop;
  b.fillRect(0, grassTop, PITCH_W, 14);
  b.strokeStyle = 'rgba(255,255,255,0.75)';
  b.lineWidth = 2;
  b.beginPath();
  b.moveTo(PITCH_W / 2, grassTop + 4);
  b.lineTo(PITCH_W / 2, PITCH_H);
  b.stroke();
  b.beginPath();
  b.ellipse(PITCH_W / 2, FLOOR + 14, 110, 22, 0, 0, Math.PI * 2);
  b.stroke();
  b.beginPath();
  b.moveTo(0, FLOOR);
  b.lineTo(PITCH_W, FLOOR);
  b.stroke();
  for (const side of [0, 1]) {
    const x = side ? PITCH_W - GOAL_W - 70 : GOAL_W + 70;
    b.beginPath();
    b.moveTo(side ? PITCH_W : 0, grassTop + 8);
    b.lineTo(x, grassTop + 8);
    b.lineTo(x + (side ? -20 : 20), PITCH_H - 6);
    b.lineTo(side ? PITCH_W : 0, PITCH_H - 6);
    b.stroke();
  }
  return c;
}
