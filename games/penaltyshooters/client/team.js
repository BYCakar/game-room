import { PATTERNS, DEFAULT_TEAM, normalizeTeam } from '../shared/teams.js';
import { el, load, save } from '/js/kit/dom.js';

const TEAM_KEY = 'penaltyshooters.team';
let memoryTeam = null;
export function myTeam() {
  return normalizeTeam(memoryTeam || load(TEAM_KEY)) || { ...DEFAULT_TEAM };
}
export function saveTeam(team) {
  memoryTeam = normalizeTeam(team) || { ...DEFAULT_TEAM };
  save(TEAM_KEY, memoryTeam);
  return memoryTeam;
}

const SVG = 'http://www.w3.org/2000/svg';
let sequence = 0;
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

// The editable shirt is drawn locally so all colours and patterns can be
// previewed without replacing the source game's artwork.
export function shirtIcon(input, className = '') {
  const team = normalizeTeam(input) || { ...DEFAULT_TEAM };
  const svg = svgEl('svg', { viewBox: '0 0 120 136', class: `ps-shirt ${className}`, role: 'img', 'aria-label': `${team.name} kit` });
  const id = `ps-shirt-${++sequence}`;
  const shape = 'M38 9 16 19 3 46 24 57 31 43 31 92 89 92 89 43 96 57 117 46 104 19 82 9 73 16 47 16Z';
  const defs = svgEl('defs', {});
  const clip = svgEl('clipPath', { id });
  clip.append(svgEl('path', { d: shape }));
  defs.append(clip);
  svg.append(defs, svgEl('path', { d: shape, fill: team.primary, stroke: '#102039', 'stroke-width': 3 }));
  const pattern = svgEl('g', { 'clip-path': `url(#${id})`, fill: team.secondary });
  if (team.pattern === 's01') {
    for (let x = 34; x < 90; x += 18) pattern.append(svgEl('rect', { x, y: 0, width: 9, height: 94 }));
  } else if (team.pattern === 's02') {
    for (let y = 28; y < 94; y += 19) pattern.append(svgEl('rect', { x: 0, y, width: 120, height: 9 }));
  } else if (team.pattern === 's04') {
    pattern.append(svgEl('rect', { x: 60, y: 0, width: 60, height: 100 }));
  } else if (team.pattern === 's05') {
    pattern.append(svgEl('path', { d: 'M8 88 82 3 100 13 24 104Z' }));
  } else if (team.pattern === 's07') {
    pattern.append(svgEl('rect', { x: 0, y: 39, width: 120, height: 18 }));
  } else if (team.pattern === 's06') {
    pattern.append(svgEl('path', { d: 'M0 0H35V63H0ZM85 0H120V63H85Z' }));
  } else if (team.pattern === 's08') {
    pattern.append(svgEl('rect', { x: 50, y: 0, width: 20, height: 94 }));
  } else if (team.pattern === 's09') {
    pattern.append(svgEl('path', { d: 'M5 17H115V29H5Z' }));
  } else if (team.pattern === 's11') {
    pattern.append(svgEl('path', { d: 'M53 0H67V94H53ZM0 36H120V50H0Z' }));
  } else if (team.pattern === 's10') {
    for (let x = 28; x < 92; x += 16) for (let y = 10; y < 94; y += 16) {
      if (((x - 28 + y - 10) / 16) % 2 === 0) pattern.append(svgEl('rect', { x, y, width: 16, height: 16 }));
    }
  } else if (team.pattern === 's13') {
    pattern.append(svgEl('path', { d: 'M31 25H42V94H31ZM78 25H89V94H78Z' }));
  } else if (team.pattern === 's14') {
    pattern.append(svgEl('path', { d: 'M0 0H35V63H0ZM85 0H120V63H85ZM0 39H120V57H0Z' }));
  }
  svg.append(pattern, svgEl('path', { d: 'M47 12Q60 29 73 12', fill: 'none', stroke: '#f4f7fa', 'stroke-width': 4 }));
  svg.append(svgEl('path', { d: 'M31 94H89L93 127H65L60 108 55 127H27Z', fill: team.shorts, stroke: '#102039', 'stroke-width': 3 }));
  svg.append(svgEl('path', { d: 'M34 26 32 89M86 26 88 89', fill: 'none', stroke: '#fff', opacity: '.15', 'stroke-width': 3 }));
  return svg;
}

export function createTeamEditor({ compact = false, onChange } = {}) {
  let team = myTeam();
  const preview = el('div', { className: 'ps-team-preview' });
  const name = el('input', { value: team.name, maxLength: 28, placeholder: 'Your team name', required: true });
  const primary = el('input', { type: 'color', value: team.primary });
  const secondary = el('input', { type: 'color', value: team.secondary });
  const shorts = el('input', { type: 'color', value: team.shorts });
  const patterns = el('div', { className: 'ps-patterns', role: 'group' });
  patterns.setAttribute('aria-label', 'Kit pattern');
  const message = el('span', { className: 'ps-save-message', role: 'status' });
  function read() {
    return normalizeTeam({ ...team, name: name.value.trim() || DEFAULT_TEAM.name, primary: primary.value, secondary: secondary.value, shorts: shorts.value }) || { ...DEFAULT_TEAM };
  }
  function render() {
    team = read();
    preview.replaceChildren(shirtIcon(team), el('strong', { textContent: team.name }));
    patterns.replaceChildren(...PATTERNS.map(pattern => {
      const button = el('button', { type: 'button', className: `ps-pattern ${team.pattern === pattern.id ? 'selected' : ''}`, title: pattern.name,
        onclick: () => { team.pattern = pattern.id; message.textContent = ''; render(); onChange?.(read()); },
      }, shirtIcon({ ...team, pattern: pattern.id }), el('span', { textContent: pattern.name }));
      button.setAttribute('aria-pressed', String(team.pattern === pattern.id));
      return button;
    }));
  }
  function persist() { team = saveTeam(read()); message.textContent = 'Team saved'; onChange?.(team); return team; }
  for (const input of [name, primary, secondary, shorts]) input.addEventListener('input', () => { message.textContent = ''; render(); onChange?.(read()); });
  const node = el('section', { className: `ps-team-editor ${compact ? 'ps-compact' : ''}` },
    el('div', { className: 'ps-section-title' }, el('h3', { textContent: 'MY TEAM' })),
    el('div', { className: 'ps-team-top' }, preview,
      el('div', { className: 'ps-team-fields' }, el('label', {}, 'Team name', name),
        el('div', { className: 'ps-colors' }, el('label', {}, 'Primary', primary), el('label', {}, 'Secondary', secondary), el('label', {}, 'Shorts', shorts)))),
    el('p', { className: 'ps-field-label', textContent: 'KIT PATTERN' }), patterns,
    el('div', { className: 'ps-editor-footer' }, el('button', { type: 'button', className: 'ps-button', textContent: 'Save team', onclick: persist }), message));
  render();
  return { node, getTeam: read, save: persist };
}
