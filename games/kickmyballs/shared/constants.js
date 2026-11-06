// The numbers of the match, shared by the server's simulation, the browser's
// prediction and the bot. Lengths are in pitch pixels, times in seconds
// unless the name says otherwise; y grows downwards.

export const PITCH_W = 960;
export const PITCH_H = 540;
export const FLOOR = 474; // the top of the grass
export const CEIL = 0; // the ball bounces off the top of the picture

// The world moves in fixed steps of this many seconds, on the server and in
// the browser alike, so that both work out the same thing.
export const STEP = 1 / 60;
// Snapshots per second sent to the players.
export const SEND_RATE = 20;

// The goals, one in each bottom corner. The goal line is GOAL_W in from the
// side of the picture; the crossbar runs from the side to the goal line at
// GOAL_H above the grass and can be stood on and bounced off.
export const GOAL_W = 66;
export const GOAL_H = 160;
export const CROSSBAR_Y = FLOOR - GOAL_H;
export const BAR_R = 5; // half the crossbar's thickness
// A ball resting on a crossbar rolls off it, towards the pitch, this fast (px/s²).
export const BAR_ROLL = 500;

// The players: a big head on a little body, with one boot.
export const HEAD_R = 32; // the head's radius, before power-ups
export const NECK = 28; // from the feet to the bottom of the head
export const BODY_HALF_W = 22; // how close a player comes to the side of the picture
export const RUN_SPEED = 290;
export const RUN_ACCEL = 2600; // how quickly a player gets up to speed, and stops
export const GRAVITY = 2100;
export const JUMP_SPEED = 760;
export const JUMP_BUFFER = 0.12; // a jump pressed just before landing happens on landing

// The boot swings from a hip point on an arc in front of the player.
export const HIP_FORWARD = 6;
export const HIP_UP = 30;
export const LEG = 30;
export const BOOT_R = 12;
export const BOOT_REST = -1.0; // the boot's angle at rest, above the horizontal (radians)
export const BOOT_UP = 0.55; // and at the top of a kick
export const KICK_TIME = 0.26; // a whole kick, up and back down
export const KICK_UP = 0.45; // the share of a kick spent swinging up, when it can strike the ball
export const KICK_SPEED = 880; // how hard a kick sends the ball
export const KICK_LIFT = 0.42; // radians added above the line from hip to ball
export const KICK_MIN_ANGLE = 0.32; // the flattest and steepest a kick sends the ball
export const KICK_MAX_ANGLE = 1.25;

// The ball.
export const BALL_R = 17;
export const BALL_GRAVITY = 1300;
export const BALL_MAX_SPEED = 1500;
export const FLOOR_BOUNCE = 0.68; // speed kept bouncing off the grass
export const WALL_BOUNCE = 0.78; // and off the sides, the top and the crossbars
export const HEAD_BOUNCE = 0.55; // and off a head or a boot, against the player's own motion
// A ball bumped by a head or a boot (not kicked) leaves no faster than this.
export const BUMP_MAX_SPEED = 640;
export const ROLL_FRICTION = 0.3; // share of its speed a rolling ball keeps each second
export const AIR_DRAG = 0.78; // and a flying one
// The ball moves in this many steps per world step, so that a hard kick
// does not slip through a head or a crossbar.
export const BALL_SUBSTEPS = 4;
// Where the ball is dropped at kick-off: over the halfway line.
export const DROP_Y = 150;
// After a goal it is dropped this far towards the side that let it in.
export const DROP_LEAN = 70;
// Where the players line up at kick-off.
export const KICKOFF_X = [250, PITCH_W - 250];

// The match: how long it lasts (seconds of play, which stop for goals and
// pauses), and the pauses around goals.
export const LENGTH_CHOICES = [60, 90, 120];
export const DEFAULT_LENGTH = 90;
export const COUNTDOWN_MS = 1500;
export const GOAL_MS = 2400; // the celebration after a goal, before the next kick-off
export const LOW_TIME_MS = 10_000; // the clock turns red and ticks

// One look per seat.
export const SEAT_COLOURS = [
  { main: '#ef4a5d', dark: '#a8243a', light: '#ffc3cb', name: 'Red' },
  { main: '#3fa4f5', dark: '#1d62ad', light: '#c3e4ff', name: 'Blue' },
];

// Power-ups. Now and then one floats over the pitch; the ball takes it when
// it goes through, for whoever touched the ball last, or a player heads it.
export const POWER_UPS = ['bigHead', 'shrink', 'speed', 'freeze', 'fire', 'bigBall', 'wall', 'moonJump'];
export const POWER_NAMES = {
  bigHead: 'Big head', // your head grows for a while
  shrink: 'Shrink', // your rival's head shrinks for a while
  speed: 'Speed boots', // you run faster for a while
  freeze: 'Freeze', // your rival is frozen in a block of ice
  fire: 'Fire shot', // your next kick flies straight and hard, and flattens anyone in its way
  bigBall: 'Beach ball', // the ball grows for a while
  wall: 'Goal wall', // a wall closes your own goal for a while
  moonJump: 'Moon jump', // you jump far higher for a while
};
export const ITEM_R = 22;
export const ITEM_LIFE = 12; // seconds a power-up floats before it fades
export const ITEM_FIRST_MS = [4000, 7000]; // into a match, the first one comes between these
export const ITEM_EVERY_MS = [6000, 10000]; // and the next ones this long after the last was taken or faded
// Where power-ups appear: away from the goals, and between head height and
// the top of a jump.
export const ITEM_X = [200, PITCH_W - 200];
export const ITEM_Y = [190, 340];
export const BIG_HEAD_TIME = 8;
export const BIG_HEAD_SCALE = 1.45;
export const SHRINK_TIME = 8;
export const SHRINK_SCALE = 0.6;
export const SPEED_TIME = 8;
export const SPEED_SCALE = 1.55;
export const FREEZE_TIME = 2.5;
export const FIRE_SPEED = 1350; // a fire shot flies this fast, without dropping,
export const FIRE_ANGLES = [0.05, 0.3]; // rising at least a little, so as not to go straight into the grass,
export const FIRE_TIME = 1.1; // for this long at most, or until it hits something other than a player
export const FLATTEN_TIME = 1.2; // a player hit by a fire shot lies stunned this long
export const BIG_BALL_TIME = 8;
export const BIG_BALL_SCALE = 1.7;
export const WALL_TIME = 6;
export const MOON_JUMP_TIME = 8;
export const MOON_JUMP_SCALE = 1.35;
