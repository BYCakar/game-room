import { LEAGUES, getLeague } from '../shared/teams.js';
import { kickWindow } from '../shared/scoreboard.js';
import { el, load, save, loadStylesheet } from '/js/kit/dom.js';
import { createTeamEditor, myTeam, shirtIcon } from './team.js';
import { createArena } from './arena.js';
import { createBot } from './bot.js';
import { createAudio } from './audio.js';

loadStylesheet(new URL('./style.css', import.meta.url));
const SETUP_KEY = 'penaltyshooters.setup';
const button = (text, onclick, extra = '') => el('button', { type: 'button', className: `ps-button ${extra}`, textContent: text, onclick });
const STAGE_LABELS = { group: 'Group stage', round32: 'Round of 32', round16: 'Round of 16', quarter: 'Quarterfinal', semi: 'Semifinal', final: 'Final', complete: 'Champion', eliminated: 'Eliminated' };

function home(container, ctx) {
  const content = el('div', { className: 'ps-home-content' });
  const showTeam = () => content.replaceChildren(createTeamEditor().node);
  const main = el('section', { className: 'ps-home' },
    el('div', { className: 'ps-home-hero' },
      el('h2', {}, 'PENALTY', el('span', { textContent: 'SHOOTERS' })),
      el('div', { className: 'ps-home-actions' },
        button('🏆  TOURNAMENT', () => ctx.playComputer?.()),
        button('⚽  1v1 DUEL', () => ctx.invitePlayer?.()),
        button('👕  MY TEAM', showTeam, 'ps-button-blue'))),
    content);
  container.replaceChildren(main);
  return { destroy() { container.replaceChildren(); } };
}

function inviteForm(container, submit) {
  const editor = createTeamEditor({ compact: true });
  container.append(el('div', { className: 'ps-setup' },
    el('h3', { className: 'ps-heading', textContent: '1v1 PENALTY DUEL' }),
    editor.node,
    button('SEND INVITE', () => { editor.save(); submit({ mode: 'duel' }); }, 'ps-submit')));
}

function botForm(container, submit) {
  const stored = load(SETUP_KEY) || {};
  let league = getLeague(stored.leagueId) || LEAGUES[0];
  let selected = stored.teamId || league.teams[0]?.id;
  let mode = selected === 'custom' ? 'custom' : 'league';
  let level = Math.max(1, Math.min(8, Number(stored.level) || 3));
  let updateSelected = () => {};
  const editor = createTeamEditor({ compact: true, onChange: () => updateSelected() });
  const body = el('div', { className: 'ps-setup ps-tournament-setup' });
  const stage = el('div');
  const controls = el('div', { className: 'ps-setup-controls' });
  const difficulty = el('select', { value: String(level) }, ...Array.from({ length: 8 }, (_, i) => el('option', {
    value: String(i + 1), textContent: String(i + 1), selected: i + 1 === level,
  })));
  difficulty.addEventListener('change', () => { level = Number(difficulty.value); });
  controls.append(el('label', {}, 'Starting difficulty', difficulty));
  function start() {
    const teamId = mode === 'custom' ? 'custom' : selected;
    if (!teamId) return;
    if (mode === 'custom') editor.save();
    save(SETUP_KEY, { leagueId: league.id, teamId, level });
    submit({ options: { mode: 'tournament', leagueId: league.id, teamId }, bot: { level }, seat: 0 });
  }
  function chooseLeague() {
    updateSelected = () => {};
    stage.replaceChildren(el('h3', { className: 'ps-heading', textContent: 'CHOOSE YOUR LEAGUE' }),
      el('div', { className: 'ps-leagues' }, ...LEAGUES.map(item => button(`${item.flag || '⚽'}  ${item.name.toLocaleUpperCase('en')}`, () => {
        league = item;
        if (!league.teams.some(t => t.id === selected)) selected = league.teams[0]?.id;
        chooseTeam();
      }, item.id.includes('global') || item.teams.length === 48 ? 'ps-global' : ''))));
  }
  function chooseTeam() {
    const selection = el('div', { className: 'ps-selected-team' });
    const teamsHost = el('div', { className: 'ps-team-selection' });
    const tabLeague = button('LEAGUE TEAMS', () => { mode = 'league'; renderTeams(); }, 'ps-button-blue');
    const tabCustom = button('MY TEAM', () => { mode = 'custom'; renderTeams(); }, 'ps-button-blue');
    function renderSelection() {
      const team = mode === 'custom' ? editor.getTeam() : league.teams.find(t => t.id === selected);
      selection.replaceChildren(...(team ? [shirtIcon(team), el('strong', { textContent: team.name })] : []));
      selection.append(button('START TOURNAMENT  ›', start));
    }
    function renderTeams() {
      tabLeague.classList.toggle('selected', mode === 'league');
      tabCustom.classList.toggle('selected', mode === 'custom');
      tabLeague.setAttribute('aria-pressed', String(mode === 'league'));
      tabCustom.setAttribute('aria-pressed', String(mode === 'custom'));
      if (mode === 'custom') teamsHost.replaceChildren(editor.node);
      else {
        const groups = [];
        for (let i = 0; i < league.teams.length; i += 4) {
          groups.push(el('section', { className: 'ps-team-group' },
            el('h4', { textContent: `Group ${String.fromCharCode(65 + i / 4)}` }),
            ...league.teams.slice(i, i + 4).map(team => {
              const card = el('button', { type: 'button', className: `ps-team-choice ${team.id === selected ? 'selected' : ''}`,
                onclick: () => { selected = team.id; renderTeams(); },
              }, el('span', { textContent: team.name }), shirtIcon(team));
              card.setAttribute('aria-pressed', String(team.id === selected));
              return card;
            })));
        }
        teamsHost.replaceChildren(el('div', { className: 'ps-team-grid' }, ...groups));
      }
      renderSelection();
    }
    updateSelected = renderSelection;
    stage.replaceChildren(el('div', { className: 'ps-stage-heading' }, button('‹ LEAGUES', chooseLeague, 'ps-button-blue'),
      el('h3', { className: 'ps-heading', textContent: `${league.flag || ''} ${league.name}` })),
      el('div', { className: 'ps-tabs' }, tabLeague, tabCustom), teamsHost, selection);
    renderTeams();
  }
  body.append(stage, controls);
  container.append(body);
  chooseLeague();
}

function describeOptions(options) {
  return options.mode === 'tournament' ? `${getLeague(options.leagueId)?.name || 'League'} · Tournament` : '1v1 · Custom teams · 5 penalties';
}
function describeResult({ players, over }) {
  if (!over) return '';
  const winner = Number.isInteger(over.winner) ? players[over.winner] : null;
  return `${(over.score || [0, 0]).join(' – ')} · ${winner ? `${winner} won` : 'Finished'}`;
}
function isGoal(kick) { return kick === true || kick === 'goal' || kick?.outcome === 'goal' || kick?.result === 'goal'; }

function mount(container, ctx) {
  let game = null;
  let renderKey = '';
  let readyFor = '';
  let heardContact = null;
  let heardFrameContact = null;
  let artReady = false;
  let disposed = false;
  const canvas = el('canvas', { width: 960, height: 540, className: 'ps-canvas', tabIndex: 0 });
  canvas.setAttribute('aria-label', 'Penalty pitch. Hold and release to shoot. Click a target to dive, or use the arrow keys and Space. One dive per penalty.');
  const scores = el('div', { className: 'ps-scoreboard' });
  const progress = el('div', { className: 'ps-progress' });
  const actions = el('div', { className: 'ps-match-actions' });
  const tournament = el('div', { className: 'ps-tournament' });
  const history = el('details', { className: 'ps-history' }, el('summary', { textContent: 'Penalty history' }));
  const historyList = el('ol');
  history.append(historyList);
  const chatList = el('ol', { className: 'ps-chat-log' });
  const chatInput = el('input', { maxLength: 140, placeholder: 'Message your opponent…', autocomplete: 'off' });
  const chatForm = el('form', { className: 'ps-chat-form' }, chatInput, el('button', { type: 'submit', textContent: 'Send' }));
  chatForm.addEventListener('submit', event => { event.preventDefault(); const text = chatInput.value.trim(); if (text) ctx.sendChat(text); chatInput.value = ''; chatInput.blur(); });
  const chat = el('section', { className: 'ps-chat' }, el('h3', { textContent: 'CHAT' }), chatList, chatForm,
    el('div', { className: 'ps-chat-quick' }, ...['Good luck!', 'Great save!', 'Well played!'].map(text => button(text, () => ctx.sendChat(text), 'ps-button-blue'))));
  container.replaceChildren(el('div', { className: 'ps-game' },
    el('div', { className: 'ps-main' }, scores, el('div', { className: 'ps-arena' }, canvas), actions, tournament),
    el('aside', { className: 'ps-sidebar' }, progress, history, chat)));
  const arena = createArena(canvas, {
    onShoot: ({ x, y }) => { if (game && game.you === game.shooter && !game.over && !game.paused) ctx.send({ action: 'shoot', turnId: game.turnId, x, y }); },
    onSave: ({ x, y }) => { if (game && game.you !== null && game.you !== game.shooter && !game.save && !game.contact && !game.frameContact && ['shoot', 'keeper', 'flight'].includes(game.phase) && !game.over && !game.paused) ctx.send({ action: 'save', turnId: game.turnId, x, y }); },
  });
  const bot = createBot(ctx);
  const audio = createAudio();
  function enterPitch() {
    if (!artReady || disposed || !game || game.you === null || game.over || game.phase !== 'setup' || game.ready?.[game.you] || readyFor === game.id) return;
    readyFor = game.id;
    ctx.send({ action: 'ready', team: myTeam() });
  }
  Promise.resolve(arena.ready).then(loaded => {
    if (disposed) return;
    artReady = loaded === true;
    if (artReady) enterPitch();
    else ctx.toast('Could not load the stadium. Refresh to try again.');
  }).catch(() => { if (!disposed) ctx.toast('Could not load the stadium. Refresh to try again.'); });
  function teamName(seat) { return game.teams?.[seat]?.name || game.players[seat]; }
  function renderTournament() {
    tournament.replaceChildren();
    const t = game.tournament;
    if (!t) return;
    const lookup = id => t.teams?.find(team => team.id === id)?.name || String(id || '—');
    const group = t.groups?.find(group => group.id === t.playerGroup);
    const groupBlock = el('details', { className: 'ps-standings', open: game.phase === 'matchEnd' || Boolean(game.over) },
      el('summary', { textContent: `Group ${t.playerGroup || 'A'} · Standings` }));
    if (group) {
      const tbody = el('tbody', {}, ...group.table.map((row, i) => el('tr', { className: row.teamId === t.playerTeamId ? 'ps-own-team' : '' },
        el('td', { textContent: String(i + 1) }), el('td', { textContent: lookup(row.teamId) }),
        ...[row.played, row.won, row.lost, `${row.goalsFor}:${row.goalsAgainst}`, row.points].map(value => el('td', { textContent: String(value) })))));
      groupBlock.append(el('div', { className: 'ps-table-scroll' }, el('table', {},
        el('thead', {}, el('tr', {}, ...['#', 'Team', 'P', 'W', 'L', 'Goals', 'Pts'].map(label => el('th', { textContent: label })))), tbody)));
      tournament.append(groupBlock);
    }
    if (t.bracket?.length) {
      const bracket = el('details', { className: 'ps-bracket', open: game.phase === 'matchEnd' || Boolean(game.over) }, el('summary', { textContent: 'Knockout rounds' }));
      bracket.append(el('div', { className: 'ps-bracket-rounds' }, ...t.bracket.map(round => el('section', {},
        el('h4', { textContent: STAGE_LABELS[round.stage] || round.stage }),
        ...round.matches.map(match => el('div', { className: 'ps-fixture' },
          el('span', { textContent: lookup(match.home), className: match.winner === match.home ? 'ps-winner' : '' }),
          el('strong', { textContent: match.score ? match.score.join(' – ') : 'vs' }),
          el('span', { textContent: lookup(match.away), className: match.winner === match.away ? 'ps-winner' : '' })))))));
      tournament.append(bracket);
    }
    if (t.history?.length && !t.bracket?.length) tournament.append(el('div', { className: 'ps-fixture-history' }, ...t.history.filter(m => m.home === t.playerTeamId || m.away === t.playerTeamId).map(m => el('p', {
      textContent: `${lookup(m.home)}  ${m.score?.join(' – ') || '—'}  ${lookup(m.away)}`,
    }))));
  }
  function render() {
    const key = JSON.stringify([game.id, game.phase, game.turnId, game.ready, game.score, game.kicks, game.save, game.contact, game.frameContact, game.over, game.paused, game.connected, game.matchResult, game.tournament, game.teams, game.moves, game.difficultyLevel, game.difficultyBoost]);
    if (key === renderKey) return;
    renderKey = key;
    const difficulty = game.difficultyLevel ?? game.bots?.find(Boolean)?.level;
    const difficultyLabel = `${difficulty}${game.difficultyBoost > 0 ? `+${game.difficultyBoost}` : ''}`;
    scores.replaceChildren(...[0, 1].map(seat => el('div', { className: `ps-score-team ${seat === game.you ? 'ps-you' : ''}` },
      ...(game.teams?.[seat] ? [shirtIcon(game.teams[seat])] : []),
      el('div', {}, el('strong', { textContent: teamName(seat) }), el('small', {
        textContent: game.bots?.[seat] ? `Computer · Level ${difficultyLabel}` : `${game.players[seat]}${seat === game.you ? ' · You' : ''}`,
      })),
      el('b', { textContent: String(game.score?.[seat] || 0) }))));
    const kicks = kickWindow(game);
    const details = [];
    if (game.tournament?.stage === 'group') details.push(`Group ${game.tournament.playerGroup} · Match ${game.tournament.round} / 3`);
    if (difficulty != null) details.push(`Difficulty ${difficultyLabel}`);
    let heading = STAGE_LABELS[game.tournament?.stage] || 'PENALTY DUEL';
    if (game.over && game.tournament?.champion === game.tournament?.playerTeamId && game.tournament) heading = 'CHAMPIONS 🏆';
    const result = game.phase === 'matchEnd' || game.over ? game.matchResult || game.over : null;
    const resultLabel = result ? `${Number.isInteger(result.winner) ? `${teamName(result.winner)} wins` : 'Match finished'} · ${(result.score || game.score).join(' – ')}` : '';
    progress.replaceChildren(el('h3', { textContent: heading }),
      ...(resultLabel ? [el('p', { className: 'ps-result', textContent: resultLabel })] : []),
      ...(details.length ? [el('p', { className: 'ps-subtle', textContent: details.join(' · ') })] : []),
      ...(kicks.suddenDeath ? [el('p', { className: 'ps-sudden-death', textContent: `Sudden death · Round ${kicks.round}` })] : []),
      ...[0, 1].map(seat => el('div', { className: 'ps-kick-row' }, el('strong', { textContent: teamName(seat) }),
        el('div', { className: 'ps-kick-dots' }, ...kicks.rows[seat].map((kick, i) => {
          const round = kicks.start + i + 1;
          const taken = kick != null;
          const goal = isGoal(kick);
          const label = `Penalty ${round}: ${taken ? goal ? 'Goal' : 'Miss' : 'Pending'}`;
          const dot = el('span', { className: `ps-kick-dot ${taken ? goal ? 'goal' : 'miss' : ''}${round === kicks.round ? ' current' : ''}`,
            textContent: taken ? goal ? '●' : '×' : String(round), title: label, role: 'img' });
          dot.setAttribute('aria-label', label);
          return dot;
        })))));
    actions.replaceChildren();
    if (!game.over && game.phase === 'matchEnd' && game.you !== null) {
      actions.append(button('NEXT MATCH  ›', () => ctx.send({ action: 'next-match' })));
    }
    if (game.you !== null && !game.over) actions.append(button('Resign', () => { if (confirm('Resign from this match?')) ctx.send({ action: 'resign' }); }, 'ps-button-quiet'));
    chat.hidden = game.you === null || Boolean(game.bots?.some(Boolean));
    historyList.replaceChildren(...(game.moves || []).filter(m => m.outcome || m.result).slice(-30).map(m => el('li', {
      textContent: `${game.teams?.[m.shooter ?? m.seat]?.name || game.players[m.shooter ?? m.seat] || 'Penalty'} · ${(m.outcome || m.result) === 'goal' ? 'Goal' : (m.outcome || m.result) === 'saved' ? 'Saved' : 'Miss'}`,
    })));
    history.hidden = !historyList.children.length;
    renderTournament();
  }
  return {
    update(snapshot) {
      const previous = game;
      game = snapshot;
      enterPitch();
      if (game.contact) {
        const contactKey = `${game.id}:${game.turnId}`;
        if (contactKey !== heardContact) {
          heardContact = contactKey;
          // The initial snapshot may already contain an old impact after
          // reconnecting. Only a newly observed live contact makes a sound.
          if (previous?.id === game.id && previous.turnId === game.turnId && game.phase === 'flight' && !game.paused) audio.play('impact');
        }
      }
      if (game.frameContact?.kind === 'post') {
        const contactKey = `${game.id}:${game.turnId}`;
        if (contactKey !== heardFrameContact) {
          heardFrameContact = contactKey;
          if (previous?.id === game.id && previous.turnId === game.turnId && game.phase === 'flight' && !game.paused) audio.play('post');
        }
      }
      if (previous?.id === game.id) {
        if (game.phase === 'flight' && previous.phase !== 'flight') audio.play('kick');
        if (game.phase === 'result' && previous.phase !== 'result' && game.outcome !== 'saved') audio.play(game.outcome === 'goal' ? 'goal' : 'miss');
        if (game.over && !previous.over) ctx.play('end');
      }
      arena.update(game);
      audio.update(game);
      bot.update(game);
      render();
    },
    chat(messages) {
      chatList.replaceChildren(...messages.map(message => el('li', {}, el('strong', { textContent: message.from }), ` ${message.text}`)));
      chatList.scrollTop = chatList.scrollHeight;
    },
    destroy() { disposed = true; bot.destroy(); audio.destroy(); arena.destroy(); container.replaceChildren(); },
  };
}

function preview(container, data) {
  container.replaceChildren(el('div', { className: 'ps-preview' }, el('span', { textContent: '🥅' }), el('strong', { textContent: (data.score || [0, 0]).join(' – ') }), el('small', { textContent: STAGE_LABELS[data.stage] || 'PENALTIES' })));
}

export default { home, inviteForm, botForm, botLabel: 'Tournament', describeOptions, describeResult, mount, preview };
