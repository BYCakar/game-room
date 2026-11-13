// The original game's published sprite atlases supply the artwork; this
// renderer, input handling and multiplayer animation are independent code.
import { PATTERNS } from '../shared/teams.js';
import { FLIGHT_MS, KEEPER_MS, SAVE_PHASES } from '../shared/rules.js';
import { GOAL, goalPoint, shotAim, shooterFrame, ballPose, keeperPose } from './motion.js';
import { netResponse, netDisplacement } from './net.js';
import { kickWindow } from '../shared/scoreboard.js';

const W = 800, H = 450;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const assetsURL = new URL('./assets/', import.meta.url);
let resources;
function loadResources() {
  if (!resources) resources = fetch(new URL('sprites.json', assetsURL)).then(r => {
    if (!r.ok) throw new Error('Unable to load the stadium.');
    return r.json();
  }).then(async sprites => {
    const files = [...new Set(Object.values(sprites).flatMap(o => Object.values(o).flatMap(a => a.frames.map(f => f.file))))];
    const images = new Map();
    await Promise.all(files.map(file => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { images.set(file, img); resolve(); };
      img.onerror = () => reject(new Error('Unable to load the stadium.'));
      img.src = new URL(file, assetsURL).href;
    })));
    return { sprites, images };
  }).catch(e => { resources = null; throw e; });
  return resources;
}

export function createArena(canvas, { onShoot, onSave }) {
  const g = canvas.getContext('2d');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Penalty pitch. Hold and release to shoot. Press a target to dive once per penalty. Keyboard: hold and release Space to shoot; arrow keys and Space to dive.');
  canvas.style.touchAction = 'none';
  let data = null, loadError = '', dead = false, raf;
  const frames = new Map();
  let game = null, receivedAt = 0, clockOffset = 0;
  let pressedAt = null, selectedSave = { x: .5, y: .5 };
  let sent = '', localDive = null;
  const ready = loadResources().then(r => { if (!dead) data = r; return !dead; });
  ready.catch(e => { if (!dead) loadError = e.message; });

  function frame(name, animation = 'Default', n = 0, tint = '') {
    const anim = data?.sprites[name]?.[animation] || data?.sprites[name]?.Default;
    if (!anim) return null;
    n = clamp(Math.floor(n), 0, anim.frames.length - 1);
    const f = anim.frames[n];
    const key = `${name}/${animation}/${n}/${tint}`;
    if (frames.has(key)) return frames.get(key);
    const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    const c2 = c.getContext('2d');
    if (f.rotated) {
      c2.translate(0, f.h); c2.rotate(-Math.PI / 2);
      c2.drawImage(data.images.get(f.file), f.x, f.y, f.h, f.w, 0, 0, f.h, f.w);
      c2.setTransform(1, 0, 0, 1, 0, 0);
    } else c2.drawImage(data.images.get(f.file), f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    if (tint) {
      // Original kit masks are black: replace their RGB and retain alpha.
      // The separate shadow layer restores the folds and body shading.
      c2.globalCompositeOperation = 'source-in'; c2.fillStyle = tint; c2.fillRect(0, 0, f.w, f.h);
      c2.globalCompositeOperation = 'source-over';
    }
    const result = { image: c, ...f };
    frames.set(key, result);
    return result;
  }
  function sprite(name, x, y, { animation = 'Default', n = 0, scale = 1, width, height, tint = '', flip = false, alpha = 1 } = {}) {
    const f = frame(name, animation, n, tint);
    if (!f) return;
    const w = width ?? f.w * scale, h = height ?? f.h * scale;
    g.save(); g.translate(x, y); if (flip) g.scale(-1, 1); g.globalAlpha = alpha;
    g.drawImage(f.image, -f.originX * w, -f.originY * h, w, h); g.restore();
  }
  function netTriangle(image, source, destination) {
    const [s0, s1, s2] = source, [p0, p1, p2] = destination;
    const sx1 = s1.x - s0.x, sy1 = s1.y - s0.y, sx2 = s2.x - s0.x, sy2 = s2.y - s0.y;
    const px1 = p1.x - p0.x, py1 = p1.y - p0.y, px2 = p2.x - p0.x, py2 = p2.y - p0.y;
    const determinant = sx1 * sy2 - sx2 * sy1;
    const a = (px1 * sy2 - px2 * sy1) / determinant;
    const b = (py1 * sy2 - py2 * sy1) / determinant;
    const c = (px2 * sx1 - px1 * sx2) / determinant;
    const d = (py2 * sx1 - py1 * sx2) / determinant;
    g.save();
    g.beginPath();
    // Tiny overlap hides antialiasing seams between adjacent triangles.
    const center = { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
    destination.forEach((point, i) => {
      const length = Math.hypot(point.x - center.x, point.y - center.y);
      const x = point.x + (point.x - center.x) / length * .25;
      const y = point.y + (point.y - center.y) / length * .25;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.closePath(); g.clip();
    g.transform(a, b, c, d, p0.x - a * s0.x - c * s0.y, p0.y - b * s0.x - d * s0.y);
    g.drawImage(image, 0, 0);
    g.restore();
  }
  function netSprite(name, x, y, options, impact) {
    if (!impact || impact.ageMs <= 0) { sprite(name, x, y, options); return; }
    const f = frame(name);
    if (!f) return;
    const { width: width = f.w, height: height = f.h, flip = false } = options;
    const direction = flip ? -1 : 1;
    const startX = x - direction * f.originX * width, top = y - f.originY * height;
    const endX = startX + direction * width;
    const bounds = { left: Math.min(startX, endX), right: Math.max(startX, endX), top, bottom: top + height };
    const nearestX = clamp(impact.x, bounds.left, bounds.right), nearestY = clamp(impact.y, bounds.top, bounds.bottom);
    if (Math.hypot(nearestX - impact.x, nearestY - impact.y) >= 150) { sprite(name, x, y, options); return; }
    const patch = { left: Math.max(bounds.left, impact.x - 150), right: Math.min(bounds.right, impact.x + 150),
      top: Math.max(bounds.top, impact.y - 150), bottom: Math.min(bounds.bottom, impact.y + 150) };
    // Outside the impact patch, draw the original sprite unchanged. Inside,
    // draw only the warped fabric, without a second stationary net beneath.
    g.save(); g.beginPath(); g.rect(bounds.left, bounds.top, width, height);
    g.rect(patch.left, patch.top, patch.right - patch.left, patch.bottom - patch.top); g.clip('evenodd');
    sprite(name, x, y, options); g.restore();
    g.save(); g.beginPath(); g.rect(patch.left, patch.top, patch.right - patch.left, patch.bottom - patch.top); g.clip();
    const columns = Math.max(2, Math.ceil(width / 28)), rows = Math.ceil(height / 18);
    const mesh = Array.from({ length: rows + 1 }, (_, row) => Array.from({ length: columns + 1 }, (_, column) => {
      const u = column / columns, v = row / rows;
      const px = startX + direction * width * u, py = top + height * v;
      const offset = netDisplacement(px, py, bounds, impact);
      return { source: { x: f.w * u, y: f.h * v }, target: { x: px + offset.x, y: py + offset.y } };
    }));
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = mesh[row][column], b = mesh[row][column + 1], c = mesh[row + 1][column], d = mesh[row + 1][column + 1];
      for (const triangle of [[a, b, d], [a, d, c]]) netTriangle(f.image, triangle.map(p => p.source), triangle.map(p => p.target));
    }
    g.restore();
  }
  function text(s, x, y, size = 22, color = '#fff', align = 'center') {
    g.font = `800 ${size}px "Arial Narrow", Arial, sans-serif`; g.textAlign = align;
    g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = '#132237'; g.strokeText(s, x, y);
    g.fillStyle = color; g.fillText(s, x, y);
  }
  function pill(x, y, w, h, fill) {
    g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  }
  const xy = goalPoint;
  function pointer(e) {
    const r = canvas.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width * W - GOAL.left) / (GOAL.right - GOAL.left), 0, 1),
      y: clamp((GOAL.bottom - (e.clientY - r.top) / r.height * H) / (GOAL.bottom - GOAL.top), 0, 1) };
  }
  function active(phase) { return data && game && !game.over && !game.paused && game.you !== null && game.phase === phase; }
  function myShot() { return active('shoot') && game.you === game.shooter; }
  function mySave() {
    return SAVE_PHASES.some(active) && game.you !== game.shooter && !game.save && !game.contact && !game.frameContact && !localDive &&
      (game.phase !== 'flight' || performance.now() + clockOffset < game.deadline);
  }
  function aim(now) {
    const elapsed = now + clockOffset - game.phaseStartedAt;
    return shotAim(elapsed, pressedAt === null ? null : now - pressedAt);
  }
  function dive(point) {
    if (!mySave()) return;
    selectedSave = point;
    localDive = { ...point, at: performance.now() + clockOffset };
    onSave({ ...point });
  }
  function down(e) {
    if (e.button != null && e.button !== 0) return;
    if (!(myShot() || mySave()) || sent === `${game.turnId}:${game.phase}`) return;
    e.preventDefault(); canvas.focus({ preventScroll: true });
    if (e.pointerId != null) { try { canvas.setPointerCapture(e.pointerId); } catch {} }
    if (myShot()) pressedAt = performance.now();
    else dive(pointer(e));
  }
  function move(e) {
    if (mySave()) selectedSave = pointer(e);
  }
  function up(e) {
    if (pressedAt === null) return;
    e.preventDefault();
    if (myShot()) { const target = aim(performance.now()); sent = `${game.turnId}:shoot`; onShoot(target); }
    pressedAt = null;
  }
  const cancel = () => { pressedAt = null; };
  function key(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.type === 'keydown' && !e.repeat && pressedAt === null && (myShot() || mySave()) && sent !== `${game.turnId}:${game.phase}`) {
        if (myShot()) pressedAt = performance.now();
        else dive({ ...selectedSave });
      } else if (e.type === 'keyup') up(e);
    } else if (mySave() && e.type === 'keydown' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
      selectedSave.x = clamp(selectedSave.x + (e.code === 'ArrowRight' ? .08 : e.code === 'ArrowLeft' ? -.08 : 0), 0, 1);
      selectedSave.y = clamp(selectedSave.y + (e.code === 'ArrowUp' ? .15 : e.code === 'ArrowDown' ? -.15 : 0), 0, 1);
    }
  }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('keydown', key); canvas.addEventListener('keyup', key);
  window.addEventListener('blur', cancel);

  function stadium(impact) {
    if (!data) {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#133e62'); sky.addColorStop(.4, '#267742'); sky.addColorStop(1, '#5c9e35');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      return;
    }
    sprite('mainBackground', 400, 225, { width: 809, height: 812.362 });
    sprite('audience3', 0, -34, { width: 800, height: 140 });
    sprite('audience2', 0, 8, { width: 800, height: 143 });
    sprite('field', 400, 229, { width: 800, height: 1280 });
    netSprite('bigNet', 398.718, 96.05, { width: 418, height: 139 }, impact);
    netSprite('smallNet', 620.09, 101.793, { width: 26.144, height: 180 }, impact);
    netSprite('smallNet', 178.223, 102.414, { width: 23.99, height: 176, flip: true }, impact);
    sprite('goalBars', 400.018, 182.407, { width: 481, height: 163.288 });
  }
  function drawShooter(n, team) {
    const opts = { n, scale: 1.1 };
    // The atlases share an anchor, including trimmed frames of the run-up.
    g.save(); g.fillStyle = '#20331755'; g.beginPath(); g.ellipse(315, 432, 39, 9, 0, 0, Math.PI * 2); g.fill(); g.restore();
    sprite('Shooter', 350, 285, opts);
    sprite('shooterShirt', 350, 285, { ...opts, tint: team?.primary || '#eaeaea' });
    const pattern = PATTERNS.find(p => p.id === team?.pattern);
    const animation = pattern?.animation || (String(team?.pattern || '').startsWith('s') ? team.pattern : null);
    if (animation && data?.sprites.Stripes?.[animation]) sprite('Stripes', 350, 285, { ...opts, animation, tint: team?.secondary || '#131923' });
    sprite('shooterShorts', 350, 285, { ...opts, scale: 1.65, tint: team?.shorts || '#151820' });
    sprite('strikerOwnShadow', 350, 285, { ...opts, alpha: .48 });
  }
  function drawKeeper(serverNow) {
    const { x, y, animation, frame: n, flip } = keeperPose({
      save: game.save || localDive, now: serverNow,
      turnStartedAt: game.turnStartedAt ?? game.phaseStartedAt,
      turnId: game.turnId, bot: Boolean(game.bots?.[1 - game.shooter]),
    });
    const opts = { animation, n, flip };
    sprite('goalkeeperNoShirt', x, y, opts);
    sprite('goalkeeperShirtOrange', x, y, { ...opts, tint: '#70e8ee' });
  }
  function target(point, saving = false) {
    const { x, y } = xy(point);
    g.save(); g.lineWidth = 3; g.strokeStyle = saving ? '#fff' : '#ffed00';
    g.fillStyle = saving ? '#fe3535cc' : '#fa270d';
    g.beginPath(); g.arc(x, y, saving ? 16 : 15, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = saving ? '#ffed00' : '#ffb700'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke();
    if (saving) { g.beginPath(); g.moveTo(x - 23, y); g.lineTo(x + 23, y); g.moveTo(x, y - 23); g.lineTo(x, y + 23); g.stroke(); }
    g.restore();
  }
  function aimArrow(point) {
    const p = xy(point), angle = Math.atan2(p.y - 389, p.x - 400);
    g.save(); g.translate(400, 389); g.rotate(angle + Math.PI / 2);
    g.beginPath(); g.moveTo(-3, 0); g.lineTo(-3, -83); g.lineTo(-10, -83);
    g.lineTo(0, -108); g.lineTo(10, -83); g.lineTo(3, -83); g.lineTo(3, 0); g.closePath();
    g.fillStyle = '#fff648'; g.strokeStyle = '#27331d'; g.lineWidth = 1.5; g.fill(); g.stroke(); g.restore();
  }
  function scoreboard() {
    const names = game.teams?.map((t, i) => t?.name || game.players[i]) || game.players;
    const window = kickWindow(game);
    for (let i = 0; i < 2; i++) {
      const y = 373 + i * 35;
      pill(560, y - 21, 224, 30, i === game.you ? '#bacd248c' : '#12281788');
      text(names[i].slice(0, 19), 570, y, 17, '#fff', 'left');
      text(String(game.score?.[i] || 0), 768, y, 23);
      const shown = window.rows[i];
      for (let j = 0; j < 5; j++) {
        const v = shown[j];
        const goal = v === true || v === 'goal' || v?.outcome === 'goal' || v?.goal === true;
        pill(571 + j * 27, y + 7, 22, 7, v == null ? window.suddenDeath && j === 4 ? '#fff3a3' : '#18361770' : goal ? '#d4ff58' : '#f56542');
      }
    }
    if (window.suddenDeath) text('SUDDEN DEATH', 782, 342, 18, '#ffdd22', 'right');
  }
  function draw(now) {
    if (dead) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const wantedWidth = Math.round(Math.max(320, canvas.clientWidth || 960) * ratio);
    if (canvas.width !== wantedWidth) { canvas.width = wantedWidth; canvas.height = Math.round(wantedWidth * H / W); }
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    const serverNow = game ? (game.paused ? game.serverTime : now + clockOffset) : 0;
    stadium(netResponse(game, serverNow));
    if (!data) text(loadError || 'Loading stadium…', 400, 225, 24);
    if (game && data) {
      const ms = Math.max(0, serverNow - game.phaseStartedAt);
      const runupMs = game.runupDurationMs ?? KEEPER_MS;
      const flightMs = game.flightDurationMs ?? FLIGHT_MS;
      drawKeeper(serverNow);
      drawShooter(shooterFrame(game.phase, ms, runupMs), game.teams?.[game.shooter]);
      const ball = ballPose(game.phase, ms, game.shot, game.outcome, game.contact, serverNow, flightMs, game.flightStartedAt, game.frameContact);
      const resting = !['flight', 'result', 'matchEnd'].includes(game.phase);
      g.save(); g.globalAlpha = ball.alpha ?? 1;
      const shadowY = ball.shadowY ?? (resting ? 411 : Math.max(ball.y + 10, 185));
      g.fillStyle = '#13240b55'; g.beginPath(); g.ellipse(ball.x, shadowY, 19 * ball.scale, 6 * ball.scale, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      sprite('ball', ball.x, ball.y, { n: ball.frame, scale: ball.scale, alpha: ball.alpha ?? 1 });
      if (myShot() && sent !== `${game.turnId}:shoot`) {
        const a = aim(now); aimArrow(a); target(a);
        if (pressedAt !== null) {
          pill(31, 258, 15, 115, '#10293a99');
          pill(33, 371 - Math.min(111, a.y * 94), 11, Math.max(3, Math.min(111, a.y * 94)), a.y > 1 ? '#ff633d' : '#ffed00');
        }
      }
      if (['keeper', 'flight'].includes(game.phase) && game.shot && !game.contact && !game.frameContact && game.you !== game.shooter &&
          serverNow >= (game.aimRevealAt ?? game.phaseStartedAt)) {
        target(game.shot, true);
        if (mySave()) { const p = xy(selectedSave); g.strokeStyle = '#b5f5ff'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 22, 0, Math.PI * 2); g.stroke(); }
      }
      scoreboard();
      if (['result', 'matchEnd'].includes(game.phase) && game.outcome) {
        const caption = { goal: 'GOAL!', saved: 'SAVED!', miss: 'MISS!' }[game.outcome] || '';
        text(caption, 400, 240, 52, game.outcome === 'goal' ? '#fbea35' : '#fff');
      }
      if (game.phase === 'setup') { pill(170, 200, 460, 64, '#062944dd'); text('Getting ready…', 400, 241, 26); }
      if (game.paused) { g.fillStyle = '#082039b8'; g.fillRect(0, 0, W, H); text('Reconnecting…', 400, 230, 30); }
    }
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
  return {
    ready,
    update(snapshot) {
      const newTurn = !game || snapshot.id !== game.id || snapshot.turnId !== game.turnId;
      const changed = newTurn || snapshot.phase !== game.phase;
      if (snapshot === game) {
        sent = ''; // the shell redraws this object after rejecting an input
        if (!snapshot.save) localDive = null;
      }
      if (newTurn) { localDive = null; selectedSave = { x: .5, y: .5 }; }
      else if (localDive && game?.paused) localDive.at += snapshot.turnStartedAt - game.turnStartedAt;
      if (changed || snapshot.paused) { pressedAt = null; sent = ''; }
      game = snapshot; receivedAt = performance.now(); clockOffset = snapshot.serverTime - receivedAt;
    },
    destroy() {
      dead = true; cancelAnimationFrame(raf); frames.clear();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('keydown', key); canvas.removeEventListener('keyup', key); window.removeEventListener('blur', cancel);
    },
  };
}
