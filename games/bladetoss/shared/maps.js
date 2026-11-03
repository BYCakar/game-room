// The arenas. Each match is fought in one of them, picked by the server.
// `wl` and `wr` are the inner faces of the side walls, `plats` the ledges as
// [left, right, top]; ledges can be jumped up through and stood on. The rest
// is how the arena looks.

export const MAPS = [
  {
    name: 'Sunset Ruins', wl: 26, wr: 934, deco: 'mountains', stars: true, stripes: true,
    plats: [[140, 330, 350], [630, 820, 350], [385, 575, 232]],
    sky: ['#1a1236', '#4a2a6b', '#b8507a', '#f28c62'], sun: '#ffd98a', sunR: 62, glow: '255,190,110',
    ridges: ['#3b2763', '#2c1d4e', '#21163d'], floor: ['#5a4690', '#2a1f4a', '#8f7ad0'],
    wall: ['#2d2150', '#3d2e6a'], plat: ['#7e69c4', '#3f2f72', '#a996ea'],
  },
  {
    name: 'Frost Peak', wl: 26, wr: 934, deco: 'snow', stars: true, stripes: false,
    plats: [[26, 200, 362], [760, 934, 362], [390, 570, 296], [26, 130, 228], [830, 934, 228]],
    sky: ['#081428', '#1b3a66', '#4f86bd', '#b9e2f3'], sun: '#f4fbff', sunR: 40, glow: '200,235,255',
    ridges: ['#5a86b3', '#3e6592', '#2a4a72'], floor: ['#9cc4e2', '#4a6f96', '#eef9ff'],
    wall: ['#2a4466', '#3a5a80'], plat: ['#c4e3f7', '#5b86b0', '#ffffff'],
  },
  {
    name: 'Dune Temple', wl: 26, wr: 934, deco: 'dunes', stars: false, stripes: true,
    plats: [[300, 660, 356], [110, 230, 250], [730, 850, 250]],
    sky: ['#3a1c3e', '#8a3b4b', '#e07a3f', '#f9c46b'], sun: '#fff1b0', sunR: 70, glow: '255,220,140',
    ridges: ['#c4733a', '#a85a2b', '#8a4620'], floor: ['#d99c58', '#8a5426', '#f5c886'],
    wall: ['#7a4420', '#94562b'], plat: ['#e8b072', '#9a6230', '#ffdca6'],
  },
  {
    name: 'Night Grove', wl: 26, wr: 934, deco: 'trees', stars: true, stripes: false,
    plats: [[130, 280, 385], [680, 830, 385], [380, 580, 308], [200, 340, 214], [620, 760, 214]],
    sky: ['#040a14', '#0d2430', '#1c4540', '#3a6a4c'], sun: '#eaffd8', sunR: 34, glow: '200,255,190',
    ridges: ['#1d4434', '#143326', '#0c2219'], floor: ['#3f6b3a', '#1b3320', '#86c766'],
    wall: ['#1f3326', '#2d4a35'], plat: ['#6aa85a', '#2f5a2c', '#aee893'],
  },
  {
    name: 'Lava Keep', wl: 130, wr: 830, deco: 'mountains', stars: false, stripes: false, lava: true,
    plats: [[200, 350, 345], [610, 760, 345], [405, 555, 238]],
    sky: ['#12050a', '#3a0c14', '#8a1e16', '#e8561e'], sun: '#ffb347', sunR: 54, glow: '255,140,60',
    ridges: ['#3a1210', '#2a0d0c', '#1d0908'], floor: ['#4d2c2a', '#1f1010', '#ff8a45'],
    wall: ['#3a1d1d', '#553232'], plat: ['#8f4d3c', '#4a2420', '#ffb070'],
  },
];
