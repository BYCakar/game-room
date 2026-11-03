// Blade Toss in the browser: the options in the invitation dialog and the
// game screen. The duel comes from the server as snapshots, many a second;
// the arena draws them and sends the one button. See games/README.md.

import { DEFAULT_ROUNDS, ROUND_CHOICES, SEAT_COLOURS } from '../shared/constants.js';
import { MAPS } from '../shared/maps.js';
import { BOT_LEVELS } from '../shared/bot.js';
import { el, load, save, loadStylesheet } from '/js/kit/dom.js';
import { slider } from '/js/kit/setup.js';
import { createArena } from './arena.js';
import { createBot } from './bot.js';

loadStylesheet(new URL('/js/kit/kit.css', import.meta.url));
loadStylesheet(new URL('./bladetoss.css', import.meta.url));

const SETUP_KEY = 'bladetoss.setup';
const CHAT_KEY = 'bladetoss.chat';
const CHAT_PHRASES = { GG: 'Good game', WP: 'Well played', TY: 'Thank you', GTG: "I've got to go", BYE: 'Bye!' };
const CHAT_MAX_LENGTH = 140;
const LEVELS = Array.from({ length: BOT_LEVELS }, (_, i) => i + 1);

const needed = (rounds) => (rounds + 1) / 2;
const describeOptions = ({ rounds }) => `Best of ${rounds}`;

// What was last sent from the setup is offered again.
function rememberedSetup() {
  const setup = { rounds: DEFAULT_ROUNDS, level: 3 };
  const saved = load(SETUP_KEY) || {};
  if (ROUND_CHOICES.includes(saved.rounds)) setup.rounds = saved.rounds;
  if (LEVELS.includes(saved.level)) setup.level = saved.level;
  return setup;
}

// One tile per length of match, the usual one first; clicking one sends it
// off. Against the computer its level comes first.
function setupForm(container, submit, bot) {
  const setup = rememberedSetup();
  const order = [DEFAULT_ROUNDS, ...ROUND_CHOICES.filter((r) => r !== DEFAULT_ROUNDS)];
  const tiles = el('div', { className: 'kitTimes bladetossTiles' }, ...order.map((rounds) => el('button', {
    type: 'button',
    className: 'kitTimeTile',
    onclick: () => {
      setup.rounds = rounds;
      save(SETUP_KEY, setup);
      if (bot) submit({ options: { rounds }, bot: { level: setup.level }, seat: null });
      else submit({ rounds });
    },
  }, el('strong', { textContent: describeOptions({ rounds }) }),
  el('span', { textContent: `First to ${needed(rounds)}` }))));
  const about = el('p', {
    className: 'kitMuted kitAbout',
    textContent: 'One button. Armed, it throws your swinging sword; empty-handed, it jumps, kicks off walls, ' +
      'and held, clings to them. Run over any sword to take it up. The arena changes every match.',
  });
  if (bot) container.append(el('div', { className: 'kitOpponent' }, slider(setup, 'level', 'Level', LEVELS).node));
  container.append(about, tiles);
}

const inviteForm = (container, submit) => setupForm(container, submit, false);
const botForm = (container, submit) => setupForm(container, submit, true);

// { score: '4-2', how: 'bob resigned', text: 'bob resigned • alice is victorious' }
function resultOf({ players, over }) {
  const score = (over.score ?? [0, 0]).join('-');
  const winner = over.winner === null ? null : players[over.winner];
  const loser = over.winner === null ? null : players[1 - over.winner];
  const how = {
    rounds: () => `${winner} won`,
    limit: () => (winner ? `${winner} won on rounds` : 'Round limit reached'),
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

// How one round went, in a few words.
function roundText(players, { winner, reason }) {
  if (winner !== null) return players[winner];
  return reason === 'double' ? 'Double knock-out' : 'Time up';
}

function mount(container, ctx) {
  let game = null;
  let shownKey = null; // what the panel was last drawn from

  // ---- the frame: the arena, and beside it (under it on a phone) the score,
  // the status and the chat ----

  const arenaHost = el('div', { className: 'bladetossArena' });
  const help = el('p', {
    className: 'kitMuted bladetossHelp',
    textContent: matchMedia('(pointer: coarse)').matches
      ? 'Tap the arena: throw when armed, jump when not. Hold against a wall to cling, let go to leap.'
      : 'Space, W, ↑ or click: throw when armed, jump when not • hold against a wall to cling, let go to leap',
  });
  const board = el('div', { className: 'kitCard bladetossBoard' });
  const status = el('div', { className: 'kitStatus' });
  const actions = el('div', { className: 'kitActions' });
  const rounds = el('ol', { className: 'bladetossRounds' });
  const info = el('div', { className: 'bladetossInfo kitMuted' });

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
    // Back to the duel: Space is the button again.
    chatInput.blur();
  });

  container.replaceChildren(el('div', { className: 'bladetoss' },
    el('div', { className: 'bladetossMain' }, arenaHost, help),
    el('div', { className: 'bladetossSide' },
      el('div', { className: 'kitCard bladetossPanel' }, board, info, rounds, status, actions),
      chatCard)));

  const arena = createArena(arenaHost, {
    send: (action) => ctx.send(action),
    banner,
    // The player's own throws and jumps sound at once, not a round trip later.
    feedback: (kind) => { if (kind === 'throw') ctx.play('move'); },
  });
  const bot = createBot(ctx, () => arena.world());

  // The words across the arena between the fighting.
  function banner(g, since) {
    if (g.over) {
      const result = resultOf(g);
      return { big: g.over.winner === null ? 'Draw' : `${g.players[g.over.winner]} wins!`, small: result.how, colour: '#ffd23f' };
    }
    if (g.paused) {
      const away = g.players.find((_, seat) => !g.connected[seat]);
      return { big: 'Paused', small: `Waiting for ${away} to come back…` };
    }
    if (g.phase === 'roundOver') {
      const last = g.moves[g.moves.length - 1];
      if (!last) return null; // the moment in which a double knock-out could still happen
      if (last.winner === null) return { big: last.reason === 'double' ? 'Double K.O.' : 'Time up', small: 'No point', colour: '#ffd23f' };
      return { big: `${g.players[last.winner]} scores`, small: g.score.join(' – '), colour: SEAT_COLOURS[last.winner].main };
    }
    if (g.phase === 'countdown') {
      const round = g.moves.length + 1;
      const last = g.score.every((s) => s === needed(g.options.rounds) - 1);
      return { big: `Round ${round}`, small: round === 1 ? MAPS[g.map].name : last ? 'Final round' : describeOptions(g.options), colour: '#ffd23f' };
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
      if (e.type === 'throw' && e.seat !== next.you) ctx.play('move');
      else if (e.type === 'clash') ctx.play('capture');
      else if (e.type === 'hit') ctx.play('explosion');
    }
    if (next.phase === 'playing' && prev.phase !== 'playing') ctx.play('check');
    if (next.over && !prev.over) ctx.play('end', 0.4);
  }

  // The panel only changes now and then, so it is drawn again only then.
  function render() {
    const key = JSON.stringify([game.id, game.phase, game.paused, game.score, game.connected, game.spectators,
      game.over, game.moves.length]);
    if (key === shownKey) return;
    shownKey = key;
    const live = !game.over;
    const target = needed(game.options.rounds);

    board.replaceChildren(...game.players.map((name, seat) => el('div', { className: 'bladetossRow' },
      el('span', { className: 'bladetossSwatch', style: `background:${SEAT_COLOURS[seat].main}` }),
      el('span', { className: `dot ${game.connected[seat] ? 'online' : 'offline'}`, hidden: !live || Boolean(game.bots?.[seat]) }),
      el('span', { className: 'bladetossName', textContent: name + (seat === game.you ? ' (you)' : '') }),
      el('span', { className: 'bladetossWins', title: `${game.score[seat]} of ${target} rounds won` },
        ...Array.from({ length: target }, (_, k) => el('i', { className: k < game.score[seat] ? 'won' : '' }))))));

    const round = game.moves.length + (game.phase === 'roundOver' || game.over ? 0 : 1);
    info.replaceChildren(
      `${describeOptions(game.options)} • ${MAPS[game.map].name}${round ? ` • Round ${round}` : ''}`,
      ...(game.spectators && live ? [el('span', { textContent: ` • ${game.spectators} watching` })] : []));
    rounds.replaceChildren(...game.moves.map((r) => el('li', { textContent: roundText(game.players, r) })));
    rounds.hidden = !game.moves.length;

    const result = game.over && resultOf(game);
    if (result) status.replaceChildren(el('strong', { textContent: result.score }), el('em', { textContent: result.text }));
    else status.replaceChildren(banner(game, 0)?.small || (game.you === null ? 'Watching' : 'Fight!'));
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

// The arena in its own colours with the score across it, for lists of games.
// Where the fighters are is not sent, so they are not drawn.
function preview(container, { map, score }) {
  const M = MAPS[map] ?? MAPS[0];
  const SVG = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const svg = make('svg', { viewBox: '0 0 960 540', class: 'bladetossThumb' });
  const id = `bladetossSky${map}`;
  const defs = make('defs', {});
  const grad = make('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 });
  M.sky.forEach((c, i) => grad.append(make('stop', { offset: [0, 0.45, 0.8, 1][i], 'stop-color': c })));
  defs.append(grad);
  svg.append(defs, make('rect', { x: 0, y: 0, width: 960, height: 478, fill: `url(#${id})` }));
  svg.append(make('rect', { x: 0, y: 478, width: 960, height: 62, fill: M.floor[0] }));
  svg.append(make('rect', { x: 0, y: 0, width: M.wl, height: 540, fill: M.wall[1] }));
  svg.append(make('rect', { x: M.wr, y: 0, width: 960 - M.wr, height: 540, fill: M.wall[1] }));
  for (const [x1, x2, y] of M.plats) svg.append(make('rect', { x: x1, y, width: x2 - x1, height: 18, rx: 7, fill: M.plat[0] }));
  (score ?? [0, 0]).forEach((s, seat) => {
    const text = make('text', {
      x: 480 + (seat ? 180 : -180), y: 330, 'text-anchor': 'middle', fill: SEAT_COLOURS[seat].main, class: 'bladetossThumbScore',
    });
    text.textContent = s;
    svg.append(text);
  });
  container.replaceChildren(svg);
}

export default { inviteForm, botForm, describeOptions, describeResult, preview, mount };
