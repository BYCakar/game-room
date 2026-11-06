// KickMyBalls in the browser: the options in the invitation dialog and the
// game screen. The match comes from the server as snapshots, many a second;
// the arena draws them and sends the controls. See games/README.md.

import { DEFAULT_LENGTH, LENGTH_CHOICES, LOW_TIME_MS, SEAT_COLOURS } from '../shared/constants.js';
import { BOT_LEVELS } from '../shared/bot.js';
import { el, load, save, loadStylesheet } from '/js/kit/dom.js';
import { choiceRow, slider } from '/js/kit/setup.js';
import { createArena } from './arena.js';
import { createBot } from './bot.js';

loadStylesheet(new URL('/js/kit/kit.css', import.meta.url));
loadStylesheet(new URL('./kickmyballs.css', import.meta.url));

const SETUP_KEY = 'kickmyballs.setup';
const CHAT_KEY = 'kickmyballs.chat';
const CHAT_PHRASES = { GG: 'Good game', WP: 'Well played', TY: 'Thank you', GTG: "I've got to go", BYE: 'Bye!' };
const CHAT_MAX_LENGTH = 140;
const LEVELS = Array.from({ length: BOT_LEVELS }, (_, i) => i + 1);

// 90 -> "1:30".
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
const describeOptions = ({ length, powerUps }) => `${clock(length)}${powerUps === false ? ' • No power-ups' : ''}`;

// What was last sent from the setup is offered again.
function rememberedSetup() {
  const setup = { length: DEFAULT_LENGTH, powerUps: true, level: 3 };
  const saved = load(SETUP_KEY) || {};
  if (LENGTH_CHOICES.includes(saved.length)) setup.length = saved.length;
  if (typeof saved.powerUps === 'boolean') setup.powerUps = saved.powerUps;
  if (LEVELS.includes(saved.level)) setup.level = saved.level;
  return setup;
}

// Power-ups on or off, then one tile per length of match, the usual one
// first; clicking one sends it off. Against the computer its level comes
// first.
function setupForm(container, submit, bot) {
  const setup = rememberedSetup();
  const order = [DEFAULT_LENGTH, ...LENGTH_CHOICES.filter((l) => l !== DEFAULT_LENGTH)];
  const tiles = el('div', { className: 'kitTimes kickmyballsTiles' }, ...order.map((length) => el('button', {
    type: 'button',
    className: 'kitTimeTile',
    onclick: () => {
      setup.length = length;
      save(SETUP_KEY, setup);
      const options = { length, powerUps: setup.powerUps };
      if (bot) submit({ options, bot: { level: setup.level }, seat: null });
      else submit(options);
    },
  }, el('strong', { textContent: clock(length) }), el('span', { textContent: `${length} seconds` }))));
  const about = el('p', {
    className: 'kitMuted kitAbout',
    textContent: 'One on one, big heads, one ball. Get it past your rival into their goal: run into it, kick it, ' +
      'head it, volley it. The clock only runs while the ball is in play; level at the end is a draw. ' +
      'Power-ups float over the pitch: knock the ball through one, or head it, to take it.',
  });
  if (bot) container.append(el('div', { className: 'kitOpponent' }, slider(setup, 'level', 'Level', LEVELS).node));
  const powerUps = choiceRow([[true, 'Power-ups'], [false, 'No power-ups']], setup.powerUps, (on) => {
    setup.powerUps = on;
  }, 'kickmyballsChoice');
  container.append(powerUps, about, tiles);
}

const inviteForm = (container, submit) => setupForm(container, submit, false);
const botForm = (container, submit) => setupForm(container, submit, true);

// { score: '4-2', how: 'bob resigned', text: 'bob resigned • alice is victorious' }
function resultOf({ players, over }) {
  const score = (over.score ?? [0, 0]).join('-');
  const winner = over.winner === null || over.winner === undefined ? null : players[over.winner];
  const loser = winner === null ? null : players[1 - over.winner];
  const how = {
    time: () => (winner ? `${winner} won` : 'Full time'),
    resign: () => `${loser} resigned`,
    abandoned: () => `${loser} left the game`,
  }[over.reason]?.() ?? '';
  return { score, how, text: winner ? `${how} • ${winner} is victorious` : `${how} • Draw` };
}

// "4-2 • alice won", for lists of finished games.
function describeResult(match) {
  const { score, how } = resultOf(match);
  return `${score} • ${how}`;
}

// The goals scored, leaving out the final whistle.
const goalsOf = (game) => game.moves.filter((m) => !m.fullTime);

// "0:42 alice", or "0:42 bob (own goal)".
function goalText(players, { by, own, ms }) {
  const who = by >= 0 ? players[by] : 'Nobody';
  return `${clock(Math.floor(ms / 1000))} ${who}${own ? ' (own goal)' : ''}`;
}

function mount(container, ctx) {
  let game = null;
  let shownKey = null; // what the panel was last drawn from

  // ---- the frame: the pitch, and beside it (under it on a phone) the
  // score, the status and the chat ----

  const arenaHost = el('div', { className: 'kickmyballsArena' });
  const padHost = el('div', { className: 'kickmyballsPadHost' });
  const help = el('p', {
    className: 'kitMuted kickmyballsHelp',
    textContent: matchMedia('(pointer: coarse)').matches
      ? '◀ ▶ to run, ▲ to jump, KICK to kick.'
      : 'A / D or ← / → to run • W or ↑ to jump • Space, S or ↓ to kick',
  });
  const board = el('div', { className: 'kitCard kickmyballsBoard' });
  const status = el('div', { className: 'kitStatus' });
  const actions = el('div', { className: 'kitActions' });
  const goals = el('ol', { className: 'kickmyballsGoals' });
  const info = el('div', { className: 'kickmyballsInfo kitMuted' });

  const chatToggle = el('input', { type: 'checkbox', checked: load(CHAT_KEY) !== false, title: 'Show the chat' });
  const chatList = el('ul', { className: 'kitChatLog' });
  const chatInput = el('input', { maxLength: CHAT_MAX_LENGTH, autocomplete: 'off', placeholder: 'Please be nice in the chat!' });
  const chatForm = el('form', {}, chatInput);
  const chatBody = el('div', { className: 'kitChatBody' }, chatList, chatForm, el('div', { className: 'kitChatQuick' },
    ...Object.entries(CHAT_PHRASES).map(([short, phrase]) => el('button', {
      type: 'button', textContent: short, title: phrase, onclick: () => ctx.sendChat(phrase),
    }))));
  const chatCard = el('div', { className: 'kitCard kitChat' },
    el('div', { className: 'kitChatHead' }, el('label', {}, 'Chat room', chatToggle)), chatBody);
  let chatMessages = [];
  const renderChat = () => {
    chatBody.hidden = !chatToggle.checked;
    chatList.replaceChildren(...chatMessages.map((m) => el('li', {}, el('strong', { textContent: m.from }), ` ${m.text}`)));
    chatList.scrollTop = chatList.scrollHeight;
  };
  chatToggle.addEventListener('change', () => {
    save(CHAT_KEY, chatToggle.checked);
    renderChat();
  });
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) ctx.sendChat(text);
    chatInput.value = '';
    // Back to the match: Space kicks again.
    chatInput.blur();
  });

  container.replaceChildren(el('div', { className: 'kickmyballs' },
    el('div', { className: 'kickmyballsMain' }, arenaHost, padHost, help),
    el('div', { className: 'kickmyballsSide' },
      el('div', { className: 'kitCard kickmyballsPanel' }, board, info, goals, status, actions),
      chatCard)));

  const arena = createArena(arenaHost, { send: (action) => ctx.send(action), banner, padRoot: padHost });
  const bot = createBot(ctx, () => arena.world());

  // The words across the pitch between the play.
  function banner(g, since) {
    if (g.over) {
      const result = resultOf(g);
      return { big: g.over.winner === null ? 'Draw' : `${g.players[g.over.winner]} wins!`, small: `${g.score.join(' – ')} • ${result.how}`, colour: '#ffd23f' };
    }
    if (g.paused) {
      const away = g.players.find((_, seat) => !g.connected[seat]);
      return { big: 'Paused', small: `Waiting for ${away} to come back…` };
    }
    if (g.phase === 'goal') {
      const last = goalsOf(g).at(-1);
      if (!last) return null;
      const who = last.by >= 0 ? g.players[last.by] : '';
      return { big: last.own ? 'OWN GOAL!' : 'GOAL!', small: `${who} • ${g.score.join(' – ')}`, colour: SEAT_COLOURS[last.seat].main };
    }
    if (g.phase === 'countdown') {
      const left = Math.max(1, Math.ceil((g.phaseMsLeft - since) / 500));
      const first = !g.moves.length && g.clockMs === g.options.length * 1000;
      return { big: String(Math.min(3, left)), small: first ? `${describeOptions(g.options)} match • First to the ball!` : 'Get ready…', colour: '#ffd23f' };
    }
    return null;
  }

  // Sounds for whatever the server says happened since the last snapshot.
  let heard = 0;
  function announce(prev, next) {
    if (!prev || prev.id !== next.id) {
      heard = next.world.eventId;
      return;
    }
    for (const e of next.world.events) {
      if (e.id <= heard) continue;
      heard = e.id;
      if (e.type === 'kick' || e.type === 'header') ctx.play('move');
      else if (e.type === 'post' || e.type === 'block' || e.type === 'flatten') ctx.play('capture');
      else if (e.type === 'fire' || e.type === 'goal') ctx.play('explosion');
      else if (e.type === 'power') ctx.play('start');
    }
    if (next.phase === 'playing' && prev.phase === 'countdown') ctx.play('check');
    if (next.clockMs <= LOW_TIME_MS && prev.clockMs > LOW_TIME_MS && !next.over) ctx.play('lowTime');
    if (next.over && !prev.over) ctx.play('end', 0.4);
  }

  // The panel only changes now and then, so it is drawn again only then.
  function render() {
    const key = JSON.stringify([game.id, game.phase, game.paused, game.score, game.connected, game.spectators,
      game.over, game.moves.length]);
    if (key === shownKey) return;
    shownKey = key;
    const live = !game.over;

    board.replaceChildren(...game.players.map((name, seat) => el('div', { className: 'kickmyballsRow' },
      el('span', { className: 'kickmyballsSwatch', style: `background:${SEAT_COLOURS[seat].main}` }),
      el('span', { className: `dot ${game.connected[seat] ? 'online' : 'offline'}`, hidden: !live || Boolean(game.bots?.[seat]) }),
      el('span', { className: 'kickmyballsName', textContent: name + (seat === game.you ? ' (you)' : '') }),
      el('span', { className: 'kickmyballsScore', textContent: String(game.score[seat]) }))));

    info.replaceChildren(
      `${describeOptions(game.options)} match${seatSide(game)}`,
      ...(game.spectators && live ? [el('span', { textContent: ` • ${game.spectators} watching` })] : []));
    const scored = goalsOf(game);
    goals.replaceChildren(...scored.map((goal) => el('li', {},
      el('span', { className: 'kickmyballsSwatch', style: `background:${SEAT_COLOURS[goal.seat].main}` }),
      goalText(game.players, goal))));
    goals.hidden = !scored.length;

    const result = game.over && resultOf(game);
    if (result) status.replaceChildren(el('strong', { textContent: result.score }), el('em', { textContent: result.text }));
    else status.replaceChildren(banner(game, 0)?.small || (game.you === null ? 'Watching' : 'Play on!'));
    status.classList.toggle('over', !live);

    actions.replaceChildren();
    if (live && game.you !== null) {
      actions.append(el('button', {
        textContent: 'Resign',
        className: 'danger',
        onclick: () => {
          if (confirm('Resign this match?')) ctx.send({ action: 'resign' });
        },
      }));
    }
    help.hidden = game.you === null || !live;
    // A bot has nothing to say, and a spectator cannot talk.
    chatCard.hidden = game.you === null || Boolean(game.bots?.some(Boolean));
  }

  return {
    update(snapshot) {
      // The same snapshot again means "redraw", e.g. after a refused action.
      if (snapshot !== game) announce(game, snapshot);
      game = snapshot;
      arena.update(game);
      render();
      bot.update(game);
    },
    chat(messages) {
      // One more message than before is a new one; anything else is the log.
      const added = messages.length === chatMessages.length + 1 ? messages[messages.length - 1] : null;
      chatMessages = messages.slice();
      if (added && chatToggle.checked && game && added.from !== game.players[game.you]) ctx.play('notify');
      renderChat();
    },
    destroy() {
      bot.destroy();
      arena.destroy();
      container.replaceChildren();
    },
  };
}

// " • You attack the right goal", for the player; nothing for a spectator.
function seatSide(game) {
  if (game.you === null) return '';
  return ` • You shoot ${game.you ? 'left' : 'right'}`;
}

// The pitch with its two goals and the score across it, for lists of games.
// Where the players are is not sent, so they are not drawn.
function preview(container, { score }) {
  const SVG = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const svg = make('svg', { viewBox: '0 0 960 540', class: 'kickmyballsThumb' });
  svg.append(make('rect', { x: 0, y: 0, width: 960, height: 434, fill: '#26457a' }));
  svg.append(make('rect', { x: 0, y: 150, width: 960, height: 254, fill: '#1a2440' }));
  for (let k = 0; k < 12; k++) svg.append(make('rect', { x: k * 80, y: 434, width: 80, height: 106, fill: k % 2 ? '#3f9a3a' : '#4aa944' }));
  svg.append(make('line', { x1: 480, y1: 438, x2: 480, y2: 540, stroke: '#fff', 'stroke-width': 4, opacity: 0.75 }));
  for (const side of [0, 1]) {
    const x = side ? 894 : 0;
    svg.append(make('rect', { x, y: 314, width: 66, height: 160, fill: 'rgba(255,255,255,0.18)', stroke: '#fff', 'stroke-width': 6 }));
  }
  (score ?? [0, 0]).forEach((s, seat) => {
    const text = make('text', {
      x: 480 + (seat ? 170 : -170), y: 330, 'text-anchor': 'middle', fill: SEAT_COLOURS[seat].main, class: 'kickmyballsThumbScore',
    });
    text.textContent = s;
    svg.append(text);
  });
  container.replaceChildren(svg);
}

export default { inviteForm, botForm, describeOptions, describeResult, preview, mount };
