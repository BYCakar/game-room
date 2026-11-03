// Word Race in the browser: the options in the invitation dialog and the
// game screen. Both players hunt for the same word; each sees their own
// guesses in full and the other's as colours only, until the round is over.
// See games/README.md.

import { LANGUAGES, LENGTHS, ROUND_CHOICES, maxGuesses } from '../shared/constants.js';
import { ALPHABETS, display, normalise } from '../shared/alphabet.js';
import { hardModeError, solved } from '../shared/feedback.js';
import { BOT_LEVELS } from '../shared/bot.js';
import { loadWords } from '../shared/words.js';
import { el, formatClock, load, save, loadStylesheet, LOW_TIME_MS } from '/js/kit/dom.js';
import { choiceRow, slider } from '/js/kit/setup.js';
import { TILE_CLASS, createKeyboard, drawBoard } from './board.js';
import { createBot } from './bot.js';

loadStylesheet(new URL('/js/kit/kit.css', import.meta.url));
loadStylesheet(new URL('./wordrace.css', import.meta.url));

const SETUP_KEY = 'wordrace.setup';
const CHAT_KEY = 'wordrace.chat';
const CHAT_PHRASES = { GG: 'Good game', WP: 'Well played', TY: 'Thank you', GTG: "I've got to go", BYE: 'Bye!' };
const CHAT_MAX_LENGTH = 140;
const LEVELS = Array.from({ length: BOT_LEVELS }, (_, i) => i + 1);

const needed = (rounds) => (rounds + 1) / 2;
const describeRounds = (rounds) => (rounds === 1 ? 'One round' : `Best of ${rounds}`);
const describeOptions = ({ lang, length, rounds, hard }) =>
  `${LANGUAGES[lang]} • ${length} letters • ${describeRounds(rounds)}${hard ? ' • Hard' : ''}`;
const lookUp = (word, lang) => `https://${lang}.wiktionary.org/wiki/${encodeURIComponent(word)}`;

// What was last sent from the setup is offered again.
function rememberedSetup() {
  const setup = { lang: 'en', length: 5, hard: false, rounds: 3, level: 3 };
  const saved = load(SETUP_KEY) || {};
  if (Object.hasOwn(LANGUAGES, saved.lang)) setup.lang = saved.lang;
  if (LENGTHS.includes(saved.length)) setup.length = saved.length;
  if (typeof saved.hard === 'boolean') setup.hard = saved.hard;
  if (ROUND_CHOICES.includes(saved.rounds)) setup.rounds = saved.rounds;
  if (LEVELS.includes(saved.level)) setup.level = saved.level;
  return setup;
}

// The language, the length of the words and hard mode, then one tile per
// length of match; clicking one sends it off. Against the computer its
// level comes first.
function wordSetup(container, submit, bot) {
  const setup = rememberedSetup();
  const pick = (key) => (value) => {
    setup[key] = value;
  };
  const tiles = el('div', { className: 'kitTimes wordraceTiles' }, ...ROUND_CHOICES.map((rounds) => el('button', {
    type: 'button',
    className: 'kitTimeTile',
    onclick: () => {
      setup.rounds = rounds;
      save(SETUP_KEY, setup);
      const options = { lang: setup.lang, length: setup.length, rounds, hard: setup.hard };
      if (bot) submit({ options, bot: { level: setup.level }, seat: null });
      else submit(options);
    },
  }, el('strong', { textContent: describeRounds(rounds) }),
  el('span', { textContent: rounds === 1 ? 'Sudden death' : `First to ${needed(rounds)}` }))));
  const about = el('p', {
    className: 'kitMuted kitAbout',
    textContent: 'The same secret word for both. Green: right letter, right place; yellow: in the word elsewhere. '
      + 'You see the colours of your opponent\'s guesses, not the letters. Hard mode: every hint must be used.',
  });
  if (bot) container.append(el('div', { className: 'kitOpponent' }, slider(setup, 'level', 'Level', LEVELS).node));
  container.append(
    choiceRow(Object.entries(LANGUAGES), setup.lang, pick('lang'), 'wordraceChoice'),
    choiceRow(LENGTHS.map((n) => [n, `${n} letters`]), setup.length, pick('length'), 'wordraceChoice'),
    choiceRow([[false, 'Normal'], [true, 'Hard mode']], setup.hard, pick('hard'), 'wordraceChoice'),
    about, tiles);
}

const inviteForm = (container, submit) => wordSetup(container, submit, false);
const botForm = (container, submit) => wordSetup(container, submit, true);

// { score: '2-1', how: 'bob resigned', text: 'bob resigned • alice is victorious' }
function resultOf({ players, over }) {
  const score = (over.score ?? [0, 0]).join('-');
  const winner = over.winner === null ? null : players[over.winner];
  const loser = over.winner === null ? null : players[1 - over.winner];
  const how = {
    rounds: () => `${winner} won`,
    limit: () => (winner ? `${winner} won on rounds` : 'Round limit reached'),
    resign: () => `${loser} resigned`,
    abandoned: () => `${loser} left the game`,
  }[over.reason]();
  return { score, how, text: winner ? `${how} • ${winner} is victorious` : `${how} • Draw` };
}

// "2-1 • alice won", for lists of finished games.
function describeResult(match) {
  const { score, how } = resultOf(match);
  return `${score} • ${how}`;
}

// How one round went, in a few words.
function roundText(players, { winner, reason, boards }) {
  if (winner !== null) {
    const n = boards[winner].length;
    return `${players[winner]}, in ${n} guess${n === 1 ? '' : 'es'}`;
  }
  return reason === 'time' ? 'Time up, nobody found it' : 'Nobody found it';
}

function mount(container, ctx) {
  let game = null;
  let typing = '';
  let pending = false; // a guess sent and not yet answered
  let shake = false;
  let words = null; // the guesses accepted, once loaded, for a check before sending
  let receivedAt = 0;
  let warned = false; // the low-time sound, once per round
  let keyboard = null;
  const bot = createBot(ctx);

  // ---- the frame: the boards and the keyboard, and beside them (under them
  // on a phone) the score, the rounds, the status and the chat ----

  const players = el('div', { className: 'wordracePlayers' });
  const clock = el('div', { className: 'wordraceClock' });
  const boards = el('div', { className: 'wordraceBoards' });
  const below = el('div', { className: 'wordraceBelow' });
  const info = el('div', { className: 'wordraceInfo kitMuted' });
  const rounds = el('ol', { className: 'wordraceRounds' });
  const status = el('div', { className: 'kitStatus' });
  const actions = el('div', { className: 'kitActions' });

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
    // Back to the game: the keys type guesses again.
    chatInput.blur();
  });

  container.replaceChildren(el('div', { className: 'wordrace' },
    el('div', { className: 'wordraceMain' }, players, clock, boards, below),
    el('div', { className: 'wordraceSide' },
      el('div', { className: 'kitCard wordracePanel' }, info, rounds, status, actions),
      chatCard)));

  // ---- typing ----

  const me = () => game.you;
  const myRows = () => game.boards[me()];
  const live = () => !game.over && game.phase !== 'recap';
  // Letters can be typed in the countdown too, and sent once it is over.
  function canType() {
    if (!game || me() === null || game.over || game.paused || pending) return false;
    if (game.phase !== 'playing' && game.phase !== 'countdown') return false;
    const rows = myRows();
    return rows.length < maxGuesses(game.options.length) && !rows.some((r) => solved(r.pattern));
  }

  function refuse(message) {
    ctx.toast(message);
    shake = true;
    drawBoards();
    setTimeout(() => {
      shake = false;
      drawBoards();
    }, 500);
  }

  function submit() {
    const { lang, length, hard } = game.options;
    if (game.phase !== 'playing') return;
    if ([...typing].length < length) return refuse('Not enough letters');
    if (words && !words.has(typing)) return refuse('Not in the word list');
    const error = hard && hardModeError(typing, myRows(), (s) => display(s, lang));
    if (error) return refuse(error);
    pending = true;
    ctx.send({ action: 'guess', word: typing });
  }

  function press(key) {
    if (!canType()) return;
    if (key === 'enter') submit();
    else if (key === 'back') typing = [...typing].slice(0, -1).join('');
    else if ([...typing].length < game.options.length) typing += key;
    drawBoards();
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !game) return;
    const target = e.target;
    if (target.closest?.('input, textarea, select, [contenteditable], dialog')) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Enter') press('enter');
    else if (e.key === 'Backspace') press('back');
    else {
      const ch = normalise(e.key, game.options.lang);
      if (ch.length !== 1 || !ALPHABETS[game.options.lang].includes(ch)) return;
      press(ch);
    }
    e.preventDefault();
  }
  document.addEventListener('keydown', onKeyDown);

  // ---- drawing ----

  // A board with its player's name over it.
  function boardBlock(seat, { small, typed }) {
    const node = el('div');
    const { length, lang } = game.options;
    drawBoard(node, {
      rows: game.boards[seat],
      typing: typed ? typing : null,
      length,
      guesses: maxGuesses(length),
      lang,
      small,
      shake: typed && shake,
    });
    return el('div', { className: 'wordraceBlock' },
      el('div', { className: 'wordraceLabel', textContent: seat === me() ? 'You' : game.players[seat] }), node);
  }

  function drawBoards() {
    if (!game) return;
    if (me() === null) {
      boards.replaceChildren(boardBlock(0, { small: false }), boardBlock(1, { small: false }));
      boards.classList.add('pair');
    } else {
      boards.replaceChildren(boardBlock(me(), { small: false, typed: canType() || pending }), boardBlock(1 - me(), { small: true }));
      boards.classList.remove('pair');
    }
    keyboard?.colour(me() === null ? [] : myRows());
    keyboard?.disable(!canType());
  }

  // The names, the rounds won and how far each is in this one.
  function drawPlayers() {
    const max = maxGuesses(game.options.length);
    const target = needed(game.options.rounds);
    // Your own card first.
    const seats = me() === 1 ? [1, 0] : [0, 1];
    players.replaceChildren(...seats.map((seat) => {
      const name = game.players[seat];
      const rows = game.boards[seat];
      const found = rows.some((r) => solved(r.pattern));
      const progress = found ? '✓' : rows.length >= max ? '✗' : `${rows.length}/${max}`;
      return el('div', { className: 'wordracePlayer kitCard' },
        el('span', { className: `dot ${game.connected[seat] ? 'online' : 'offline'}`, hidden: game.over || Boolean(game.bots?.[seat]) }),
        el('span', { className: 'wordraceName', textContent: name + (seat === me() ? ' (you)' : '') }),
        el('span', { className: 'wordraceWins', title: `${game.score[seat]} of ${target} rounds won` },
          ...Array.from({ length: target }, (_, k) => el('i', { className: k < game.score[seat] ? 'won' : '' }))),
        el('span', { className: `wordraceProgress${found ? ' found' : ''}`, textContent: progress }));
    }));
  }

  // Under the boards: the keyboard while a round is on, and after it the
  // word, a link to its meaning and the button for the next round.
  function drawBelow() {
    if (!live() && game.word) {
      const { lang } = game.options;
      // The round may have been cut short by the end of the match.
      const last = game.phase === 'recap' ? game.moves.at(-1) : null;
      const card = el('div', { className: 'kitCard wordraceRecap' },
        el('span', { className: 'kitMuted', textContent: 'The word was' }),
        el('strong', { className: 'wordraceWord', textContent: display(game.word, lang) }),
        el('a', { href: lookUp(game.word, lang), target: '_blank', rel: 'noopener', textContent: 'What does it mean? ↗' }),
        ...(last ? [el('span', { textContent: roundText(game.players, last) })] : []));
      if (!game.over && me() !== null) {
        card.append(game.ready[me()]
          ? el('span', { className: 'kitMuted', textContent: `Waiting for ${game.players[1 - me()]}…` })
          : el('button', { className: 'primary', textContent: 'Next round', onclick: () => ctx.send({ action: 'continue' }) }));
      }
      below.replaceChildren(card);
      keyboard = null;
      return;
    }
    if (me() === null || game.over) {
      below.replaceChildren();
      keyboard = null;
      return;
    }
    keyboard = createKeyboard(game.options.lang, press);
    below.replaceChildren(keyboard.node);
  }

  function drawPanel() {
    const round = Math.min(game.moves.length + (live() ? 1 : 0), 2 * game.options.rounds);
    info.replaceChildren(
      `${describeOptions(game.options)}${round ? ` • Round ${round}` : ''}`,
      ...(game.spectators && !game.over ? [el('span', { textContent: ` • ${game.spectators} watching` })] : []));
    const { lang } = game.options;
    rounds.replaceChildren(...game.moves.map((r) => el('li', {},
      el('a', { href: lookUp(r.word, lang), target: '_blank', rel: 'noopener', textContent: display(r.word, lang) }),
      ` – ${roundText(game.players, r)}`)));
    rounds.hidden = !game.moves.length;

    const result = game.over && resultOf(game);
    if (result) status.replaceChildren(el('strong', { textContent: result.score }), el('em', { textContent: result.text }));
    else if (game.paused) status.replaceChildren(`Paused: waiting for ${game.players.find((_, s) => !game.connected[s])} to come back…`);
    else if (me() === null) status.replaceChildren('Watching');
    else if (game.phase === 'playing') {
      const rows = myRows();
      status.replaceChildren(rows.some((r) => solved(r.pattern)) ? 'Found it!'
        : rows.length >= maxGuesses(game.options.length) ? `Out of guesses: can ${game.players[1 - me()]} find it?` : 'Find the word!');
    } else status.replaceChildren(game.phase === 'countdown' ? 'Get ready…' : 'Round over');
    status.classList.toggle('over', Boolean(game.over));

    actions.replaceChildren();
    if (!game.over && me() !== null) {
      actions.append(el('button', {
        textContent: 'Resign',
        className: 'danger',
        onclick: () => {
          if (confirm('Resign this match?')) ctx.send({ action: 'resign' });
        },
      }));
    }
    // A bot has nothing to say, and a spectator cannot talk.
    chatCard.hidden = me() === null || Boolean(game.bots?.some(Boolean));
  }

  // The time left, counted down here between snapshots.
  function drawClock() {
    if (!game) return;
    const gone = game.paused ? 0 : performance.now() - receivedAt;
    clock.classList.remove('low', 'big');
    if (game.over) clock.textContent = '';
    else if (game.paused) clock.textContent = 'Paused';
    else if (game.phase === 'countdown') {
      clock.classList.add('big');
      const n = Math.max(1, Math.ceil((game.phaseMsLeft - gone) / 1000));
      clock.textContent = `${game.moves.length ? `Round ${game.moves.length + 1}` : 'Get ready'} • ${n}`;
    } else if (game.phase === 'playing') {
      const left = Math.max(0, game.roundMsLeft - gone);
      clock.textContent = formatClock(left);
      if (left < LOW_TIME_MS) {
        clock.classList.add('low');
        if (!warned && me() !== null) ctx.play('lowTime');
        warned = true;
      }
    } else {
      clock.textContent = `Next round in ${Math.max(0, Math.ceil((game.phaseMsLeft - gone) / 1000))} s`;
    }
  }
  const clockTimer = setInterval(drawClock, 200);

  function render() {
    drawPlayers();
    drawBelow();
    drawBoards();
    drawPanel();
    drawClock();
  }

  // Sounds for whatever changed between two snapshots of one match.
  function announce(prev, next) {
    if (!prev || prev.id !== next.id) return;
    if (next.moves.length > prev.moves.length) ctx.play(next.over ? 'end' : 'capture', next.over ? 0.4 : 0);
    else if (next.phase === 'playing' && prev.phase !== 'playing') ctx.play('check');
    else {
      const other = next.you === null ? null : 1 - next.you;
      if (other !== null && next.boards[other].length > prev.boards[other].length) ctx.play('move');
    }
  }

  return {
    update(snapshot) {
      if (snapshot === game) {
        // The same snapshot again: the server refused the guess.
        pending = false;
      } else {
        announce(game, snapshot);
        const fresh = !game || game.id !== snapshot.id;
        const newRound = fresh || game.moves.length !== snapshot.moves.length || game.phase === 'recap';
        const answered = !fresh && snapshot.you !== null && snapshot.boards[snapshot.you].length !== game.boards[snapshot.you].length;
        if (newRound || answered) {
          typing = '';
          pending = false;
        }
        if (newRound) warned = false;
        if (fresh) {
          words = null;
          const id = snapshot.id;
          loadWords(snapshot.options.lang, snapshot.options.length).then((list) => {
            if (game?.id === id) words = list.guesses;
          });
        }
        game = snapshot;
        receivedAt = performance.now();
      }
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
      clearInterval(clockTimer);
      document.removeEventListener('keydown', onKeyDown);
      container.replaceChildren();
    },
  };
}

// The score and the colours of this round's guesses, for lists of games:
// the second seat's board above, the first seat's below, as the names are.
function preview(container, { score, length, boards }) {
  const grid = (rows) => el('div', { className: 'wordraceThumbBoard', style: `--length:${length}` },
    ...Array.from({ length: maxGuesses(length) }, (_, r) => el('div', { className: 'wordraceRow' },
      ...Array.from({ length }, (_, i) => el('span', {
        className: `wordraceTile ${rows[r] ? TILE_CLASS[rows[r][i]] : ''}`,
      })))));
  container.replaceChildren(el('div', { className: 'wordraceThumb' },
    grid(boards[1]), el('strong', { textContent: `${score[1]} – ${score[0]}` }), grid(boards[0])));
}

export default { inviteForm, botForm, describeOptions, describeResult, preview, mount };
