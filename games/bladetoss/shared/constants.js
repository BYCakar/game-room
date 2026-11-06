// The numbers of the duel, shared by the server's simulation, the browser's
// prediction and the bot. Lengths are in arena pixels, times in seconds
// unless the name says otherwise; y grows downwards.

export const ARENA_W = 960;
export const ARENA_H = 540;
export const FLOOR = 478; // the top of the floor
export const CEIL = 16; // the underside of the ceiling

// The world moves in fixed steps of this many seconds, on the server and in
// the browser alike, so that both work out the same thing.
export const STEP = 1 / 60;
// Snapshots per second sent to the players.
export const SEND_RATE = 20;

// The fighters.
export const GRAVITY = 1900;
export const JUMP_SPEED = 790;
export const WALK_SPEED = 180;
export const BODY_W = 30;
export const BODY_H = 44;
export const CLING_SPEED = 65; // how fast a fighter holding on to a wall slides down it
export const WALL_GRACE = 0.16; // how long after touching a wall a press still kicks off it
export const JUMP_BUFFER = 0.14; // a press just before landing jumps on landing
export const AIR_JUMPS = 1; // jumps an empty-handed fighter has in the air, back on landing or kicking off a wall
export const AIR_JUMP_SPEED = 690;

// The swords.
// Thrown swords drop: a level throw dips well before the far wall, so a long
// throw has to be aimed high.
export const SWORD_SPEED = 1100;
export const SWORD_GRAVITY = 900;
export const SWORD_LEN = 50;
export const SELF_SAFE = 0.2; // a thrown sword cannot hit its thrower this soon
export const NO_PICK = 0.45; // nor be picked up again by them this soon
export const WALL_HOLD = 1.0; // a sword in a side wall falls out after this long
export const CEIL_HOLD = 0.8; // and one in the ceiling after this long
// A sword hitting a side wall glances off it, mirror-wise, keeping this much
// of its speed, this many times; the next time it sticks.
export const WALL_BOUNCES = 2;
export const BOUNCE_KEEP = 0.8;

// The held sword swings between these angles above (positive) and below the
// horizontal, a full swing up and down every AIM_PERIOD seconds.
const DEG = Math.PI / 180;
export const AIM_LO = -40 * DEG;
export const AIM_HI = 72 * DEG;
export const AIM_MID = (AIM_LO + AIM_HI) / 2;
export const AIM_AMP = (AIM_HI - AIM_LO) / 2;
export const AIM_PERIOD = 1.6;
export const AIM_SPEED = (2 * Math.PI) / AIM_PERIOD; // radians of swing phase per second
// A throw is taken at the angle the player saw, if that was no longer ago
// than this: it makes up for the time a press takes to reach the server.
export const MAX_LAG = 0.3;

// After the first hit of a round: the world slows down for a moment, and a
// second hit this soon after the first makes it a double knock-out.
export const SLOW_TIME = 0.85;
export const SLOW_SCALE = 0.3;
export const DRAW_WINDOW = 0.12;

// The pause before each round, after one, and how long a round may last
// before it counts as nobody's.
export const COUNTDOWN_MS = 1500;
export const ROUND_OVER_MS = 2600;
export const ROUND_LIMIT_MS = 60_000;
// How often a round is fought with the arena's ledges moving.
export const MOVING_CHANCE = 0.5;

// What a match can be: the best of this many rounds.
export const ROUND_CHOICES = [3, 5, 7];
export const DEFAULT_ROUNDS = 7;

// One look per seat.
export const SEAT_COLOURS = [
  { main: '#ff5a6e', dark: '#b92740', light: '#ffc2ca', name: 'Red' },
  { main: '#46b3ff', dark: '#1d69bb', light: '#c3e7ff', name: 'Blue' },
];
