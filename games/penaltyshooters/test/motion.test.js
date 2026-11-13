import test from 'node:test';
import assert from 'node:assert/strict';
import { ballPose, shotAim, shooterFrame, keeperPose, keeperIdleX } from '../client/motion.js';
import { goalPoint, flightBallPose, keeperPixelContact, findKeeperContact, optimalDiveDelay, netImpact } from '../shared/physics.js';
import { FLIGHT_MS, KEEPER_MS } from '../shared/rules.js';

test('holding a shot raises the target while its horizontal sweep continues', () => {
  const start = shotAim(100, 0), held = shotAim(600, 500);
  assert.ok(held.y > start.y);
  assert.notEqual(held.x, start.x);
  assert.equal(held.x, shotAim(600).x, 'charging does not stop or restart the horizontal cycle');
  assert.equal(shotAim(600, 5000).y, 1.2, 'overcharging can still miss above the bar');
});

test('aim and run-up follow the measured reference pace', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
  near(shotAim(250).x, shotAim(2250).x);
  near(shotAim(500).x, 1.15);
  near(shotAim(1500).x, -.15);
  near(goalPoint(shotAim(0)).y, 180);
  near(goalPoint(shotAim(400, 400)).y, 144);
  near(goalPoint(shotAim(1500, 1500)).y, 45);
  assert.equal(KEEPER_MS, 1400);
  assert.equal(FLIGHT_MS, 600);
  assert.equal(shooterFrame('keeper', 1000), 30);
});

test('the ball rests through the run-up, then moves and spins at boot contact', () => {
  const shot = { x: .2, y: .8 };
  const resting = { x: 400, y: 411, scale: 1, frame: 0 };
  for (const phase of ['setup', 'shoot', 'keeper']) {
    for (const time of [0, 300, KEEPER_MS - 1]) assert.deepEqual(ballPose(phase, time, shot, null), resting);
  }
  assert.equal(shooterFrame('keeper', KEEPER_MS), 42);
  assert.equal(shooterFrame('flight', 0), 42, 'no backwards jump between the run-up and contact');
  assert.deepEqual(ballPose('flight', 0, shot, null), resting);
  const airborne = ballPose('flight', 100, shot, null);
  assert.notEqual(airborne.frame, 0);
  assert.ok(airborne.y < resting.y);
  assert.ok(airborne.x < resting.x);
  assert.deepEqual(ballPose('flight', FLIGHT_MS, shot, null), ballPose('result', 0, shot, 'goal'));
  assert.deepEqual(ballPose('matchEnd', 0, shot, 'saved'), ballPose('result', 1200, shot, 'saved'), 'a parried ball does not jump back when the match ends');
});

test('a scored ball keeps moving into the net, drops, bounces and settles inside the goal', () => {
  for (const shot of [{ x: .15, y: .8 }, { x: .85, y: .8 }, { x: .5, y: .5 }, { x: .5, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]) {
    const end = ballPose('flight', FLIGHT_MS, shot, null);
    assert.deepEqual(ballPose('result', 0, shot, 'goal'), end, 'no jump at the goal line');
    const moving = ballPose('result', 100, shot, 'goal');
    assert.notDeepEqual(moving, end, 'the goal result must not freeze the ball');
    assert.notEqual(moving.frame, end.frame, 'the ball keeps spinning');
    assert.ok(moving.scale < end.scale, 'the ball travels into the net');
    const falling = ballPose('result', 500, shot, 'goal');
    if (shot.y >= .5) assert.ok(falling.y > end.y + 20, 'a high goal drops towards the turf');
    const settled = ballPose('result', 2000, shot, 'goal');
    assert.deepEqual(ballPose('result', 5000, shot, 'goal'), settled, 'motion and spin eventually stop');
    assert.ok(settled.x >= 170 && settled.x <= 630 && settled.y >= 170 && settled.y <= 192);
    for (const elapsed of [50, 150, 400, 700, 1100]) {
      const a = ballPose('result', elapsed - .01, shot, 'goal');
      const b = ballPose('result', elapsed + .01, shot, 'goal');
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .02, 'net and ground contacts keep position continuous');
    }
  }
});

test('goal motion keeps one clock across match end, pause and reconnect', () => {
  const shot = { x: .8, y: .9 }, flightStartedAt = 2000, now = 3100;
  const pose = ballPose('result', 500, shot, 'goal', null, now, FLIGHT_MS, flightStartedAt);
  assert.deepEqual(ballPose('matchEnd', 0, shot, 'goal', null, now, FLIGHT_MS, flightStartedAt), pose);
  assert.deepEqual(ballPose('result', 0, shot, 'goal', null, now, FLIGHT_MS, flightStartedAt), pose, 'a newly mounted view resumes the same flight');
  assert.deepEqual(ballPose('result', 500, shot, 'goal', null, now + 10000, FLIGHT_MS, flightStartedAt + 10000), pose);
  assert.deepEqual(ballPose('matchEnd', 0, shot, 'goal'), ballPose('result', 1200, shot, 'goal'), 'legacy views also avoid resetting at match end');
});

test('a ground-level goal rolls into the net and gently recoils even straight down the middle', () => {
  const shot = { x: .5, y: 0 };
  const start = ballPose('result', 0, shot, 'goal');
  const impact = ballPose('result', 160, shot, 'goal');
  const recoil = ballPose('result', 450, shot, 'goal');
  assert.equal(impact.x, start.x);
  assert.ok(impact.y < start.y - 5, 'visible travel into the net');
  assert.ok(recoil.y > impact.y + 5 && recoil.y < start.y + 2, 'small return towards the pitch');
  assert.ok(recoil.scale > impact.scale && recoil.scale < start.scale, 'gentle depth recoil rather than a keeper parry');
  assert.equal(netImpact(shot, 159), null);
  assert.equal(netImpact(shot, 160).ageMs, 0);
});

test('a high goal has a visible stronger turf bounce without rebounding like a keeper save', () => {
  const shot = { x: .5, y: .8 };
  const centerY = ms => { const pose = ballPose('result', ms, shot, 'goal'); return pose.y - 20 * pose.scale; };
  const peak = Math.min(...Array.from({ length: 101 }, (_, i) => centerY(850 + i)));
  // This shot previously rebounded about 7.2 px; its new peak is about
  // 10.7 px (50% taller), still a small bounce within the goal.
  assert.ok(170 - peak > 10 && 170 - peak < 11.5);
  assert.ok(centerY(750) > peak && centerY(1100) > peak);
  assert.equal(centerY(1300), 170);
});

test('a low miss travels beyond the post, hits the advertising board and comes back along the turf', () => {
  for (const x of [-.1, 1.1]) {
    const shot = { x, y: 0 }, direction = Math.sign(x - .5);
    const end = ballPose('flight', FLIGHT_MS, shot, null);
    assert.deepEqual(ballPose('result', 0, shot, 'miss'), end);
    const approaching = ballPose('result', 150, shot, 'miss');
    const impact = ballPose('result', 280, shot, 'miss');
    const rebound = ballPose('result', 500, shot, 'miss');
    assert.ok((impact.x - end.x) * direction > 20, 'continues along the shot direction');
    assert.ok(approaching.y < end.y && impact.y < approaching.y);
    assert.ok(Math.abs(impact.y - 40 * impact.scale - 139) < 1e-8, 'leading edge meets the board');
    assert.ok(rebound.y > impact.y && rebound.scale > impact.scale, 'board contact sends the ball back');
    assert.notEqual(approaching.frame, end.frame);
    assert.deepEqual(ballPose('result', 2000, shot, 'miss'), ballPose('result', 4000, shot, 'miss'));
    assert.equal(netImpact(shot, 280), null, 'outside shots do not disturb the net');
    for (const t of [1, 100, 280, 400, 700, 1180]) {
      const a = ballPose('result', t - .001, shot, 'miss'), b = ballPose('result', t + .001, shot, 'miss');
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .01, 'no position jump at board/ground contact');
    }
  }
});

test('airborne misses keep their direction and disappear behind the stands instead of freezing or bouncing off empty air', () => {
  const high = { x: .5, y: 1.15 };
  const start = ballPose('result', 0, high, 'miss');
  assert.ok(ballPose('result', 100, high, 'miss').y < start.y);
  assert.ok(ballPose('result', 400, high, 'miss').y < ballPose('result', 280, high, 'miss').y);
  assert.equal(ballPose('matchEnd', 4000, high, 'miss').alpha, 0);
  const side = { x: 1.1, y: .8 };
  assert.ok(ballPose('result', 700, side, 'miss').x > 800);
  assert.ok(ballPose('result', 700, side, 'miss').scale < ballPose('result', 280, side, 'miss').scale);
  assert.equal(netImpact(high, 500), null);
});

test('miss continuation shares the same stable clock through pause, reconnect and match end', () => {
  const shot = { x: 1.1, y: .15 }, now = 3000, start = 2000;
  const pose = ballPose('result', 400, shot, 'miss', null, now, FLIGHT_MS, start);
  assert.deepEqual(ballPose('matchEnd', 0, shot, 'miss', null, now, FLIGHT_MS, start), pose);
  assert.deepEqual(ballPose('result', 0, shot, 'miss', null, now + 5000, FLIGHT_MS, start + 5000), pose);
});

test('dives respond at the original takeoff frame and travel at bounded, decelerating speed', () => {
  const base = { turnStartedAt: 0, turnId: 2, bot: false };
  for (const y of [.35, .8]) {
    const left = { x: .08, y, at: 500 }, right = { x: .92, y, at: 500 };
    for (const save of [left, right]) {
      const pose = keeperPose({ ...base, save, now: save.at });
      assert.equal(pose.x, 400, 'no position jump before the dive');
      assert.equal(pose.y, 125);
      assert.equal(pose.frame, 6, 'response starts with the takeoff frame');
    }
    const l = keeperPose({ ...base, save: left, now: 850 });
    const r = keeperPose({ ...base, save: right, now: 850 });
    assert.equal(l.flip, false, 'the source artwork already dives left');
    assert.equal(r.flip, true);
    assert.ok(l.frame > 6 && r.frame > 6);
    assert.ok(l.x < 400 && r.x > 400);
    assert.ok(Math.abs(l.x + r.x - 800) < 1e-8, 'opposite dives have symmetric motion');
    let previous = keeperPose({ ...base, save: right, now: 500 }), previousSpeed = Infinity;
    for (let now = 510; now <= 2500; now += 10) {
      const pose = keeperPose({ ...base, save: right, now });
      const speed = (pose.x - previous.x) * 100;
      assert.ok(speed >= -1e-8 && speed <= 347.223, 'no distant-dive acceleration spike');
      assert.ok(speed <= previousSpeed + 1e-7, 'lateral velocity decays, including the ground slide');
      previous = pose; previousSpeed = speed;
    }
    assert.equal(previous.y, 125, 'the keeper lands back at ground height');
    assert.ok(Math.abs(keeperPose({ ...base, save: right, now: 500 + 1000 / (y > .7 ? 10 : 15) }).frame - 7) < 1e-8);
  }
});

test('human keepers stand still; a computer only takes small independent steps before diving', () => {
  for (let elapsed = 0; elapsed < 6000; elapsed += 57) {
    assert.equal(keeperIdleX(false, elapsed, 1), 400);
    assert.ok(Math.abs(keeperIdleX(true, elapsed, 1) - 400) <= 11);
  }
  assert.notEqual(keeperIdleX(true, 500, 1), keeperIdleX(true, 1000, 1));
  const base = { turnStartedAt: 0, turnId: 1, bot: true, now: 500 };
  const idle = keeperPose(base);
  for (const x of [.1, .9]) {
    const takeoff = keeperPose({ ...base, save: { x, y: .8, at: 500 } });
    assert.equal(takeoff.x, idle.x, 'a dive starts where the keeper was, regardless of its direction');
  }
});

test('central catches also follow the reference impulse and high dives retain the measured pace', () => {
  const base = { turnStartedAt: 0, turnId: 1, bot: false };
  const center = { x: .5, y: (182 - 100) / 157, at: 0 };
  const catchPose = keeperPose({ ...base, save: center, now: 250 });
  assert.equal(catchPose.animation, 'MidCatch');
  assert.equal(catchPose.frame, 7);
  assert.equal(catchPose.x, 400);
  assert.ok(catchPose.y > 105 && catchPose.y < 110, 'central upward reach uses the same gravity and impulse');
  const high = keeperPose({ ...base, save: { x: .9, y: .8, at: 0 }, now: 300 });
  assert.equal(high.frame, 9);
  assert.ok(high.x > 480 && high.x < 485 && high.y > 95 && high.y < 100);
});

test('a pause shifts animation timestamps together without changing the pose', () => {
  const base = { save: { x: .9, y: .7, at: 500 }, now: 800, turnStartedAt: 0, turnId: 1, bot: true };
  assert.deepEqual(keeperPose(base), keeperPose({ ...base, now: 5800, turnStartedAt: 5000, save: { ...base.save, at: 5500 } }));
});

test('contact follows opaque body pixels, their mirrored pose, and empty gaps between limbs', () => {
  const pose = { x: 400, y: 125, animation: 'HighParade', frame: 9, flip: false };
  assert.ok(keeperPixelContact(pose, { centerX: 350, centerY: 50, radius: 1 }), 'left glove');
  assert.equal(keeperPixelContact(pose, { centerX: 450, centerY: 50, radius: 1 }), null);
  assert.ok(keeperPixelContact({ ...pose, flip: true }, { centerX: 450, centerY: 50, radius: 1 }), 'mirrored right glove');
  assert.equal(keeperPixelContact(pose, { centerX: 400, centerY: 55, radius: 1 }), null, 'transparent space inside the frame bounds cannot save');
  assert.equal(keeperPixelContact({ ...pose, frame: 26 }, { centerX: 350, centerY: 50, radius: 1 }), null, 'a former glove position cannot save after landing');
});

const interception = { shot: { x: .1, y: .8 }, turnStartedAt: 0, turnId: 1, bot: false,
  flightStartedAt: 2400, fromAt: 2400, toAt: 3000 };

test('identical targets only save when the animated keeper actually meets the ball', () => {
  const timely = findKeeperContact({ ...interception, save: { ...interception.shot, at: 2400 } });
  assert.equal(timely.kind, 'keeper');
  for (const at of [0, 1000, 2600, 2950]) {
    assert.equal(findKeeperContact({ ...interception, save: { ...interception.shot, at } }), null, `dive at ${at}`);
  }
  assert.equal(findKeeperContact({ ...interception, save: { x: .9, y: .8, at: 2400 } }), null, 'opposite corner');
  assert.ok(findKeeperContact({ ...interception, shot: { x: .5, y: .4 }, save: null }), 'standing torso can intercept');
  assert.equal(findKeeperContact({ ...interception, shot: { x: .5, y: .4 }, save: null, toAt: 2800 }), null, 'foreground overlap has not reached the keeper yet');
});

test('contact time is stable across rendering and server tick sizes', () => {
  const input = { ...interception, save: { ...interception.shot, at: 2400 } };
  const contact = findKeeperContact(input);
  for (const tickMs of [7, 30, 120, 600]) {
    let found = null;
    for (let at = input.fromAt; at < input.toAt && !found; at += tickMs) {
      found = findKeeperContact({ ...input, fromAt: at, toAt: Math.min(at + tickMs, input.toAt) });
    }
    assert.deepEqual(found, contact);
  }
  assert.equal(findKeeperContact({ ...input, fromAt: 3001, toAt: 4000 }), null);
});

test('parries start at contact without teleporting, travel out and up, and bounce off the ground', () => {
  const contact = findKeeperContact({ ...interception, save: { ...interception.shot, at: 2400 } });
  const before = flightBallPose(interception.shot, contact.at - interception.flightStartedAt);
  const at = ballPose('flight', 0, interception.shot, 'saved', contact, contact.at);
  assert.deepEqual(at, { x: before.x, y: before.y, scale: before.scale, frame: before.frame });
  const after = ballPose('result', 0, interception.shot, 'saved', contact, contact.at + 120);
  assert.ok(after.x < at.x - 8 && after.y < at.y - 10, 'clear sideways/upward deflection');
  const landingMs = (-contact.vy + Math.sqrt(contact.vy ** 2 + 1240 * (414 - contact.y))) / 620 * 1000;
  const landing = ballPose('result', 0, interception.shot, 'saved', contact, contact.at + landingMs);
  const bounce = ballPose('result', 0, interception.shot, 'saved', contact, contact.at + landingMs + 100);
  assert.ok(bounce.y - 20 * bounce.scale < landing.y - 20 * landing.scale - 5);
  assert.deepEqual(ballPose('matchEnd', 0, interception.shot, 'saved', contact, contact.at + 700),
    ballPose('result', 0, interception.shot, 'saved', contact, contact.at + 700));
});

test('bot timing chooses a real interception and cannot save an unreachable last-moment shot', () => {
  const plan = optimalDiveDelay({ ...interception, now: 1000 });
  assert.ok(plan && plan.delayMs > 0);
  assert.ok(findKeeperContact({ ...interception, save: { ...plan.target, at: 1000 + plan.delayMs } }));
  assert.equal(optimalDiveDelay({ ...interception, now: 2999 }), null);
});
