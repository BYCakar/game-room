// The bot's seat as the player's browser plays it (client/bot.js): every
// press is let go of, and a throw is not followed by a second press while
// the page still shows the sword in hand.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../shared/sim.js';
import { createBot } from '../client/bot.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('the bot lets go of the button, and throws once', async (t) => {
  // Certain to throw: it has held its sword long, and every roll succeeds.
  const random = Math.random;
  Math.random = () => 0;
  t.after(() => { Math.random = random; });
  const world = createWorld(0, { rand: () => 0.25 });
  world.phase = 'playing';
  world.fighters[1].holdT = 6;

  const sent = [];
  const bot = createBot({ send: (action) => sent.push(action) }, () => world);
  t.after(() => bot.destroy());
  bot.update({ id: 'm', over: null, you: 0, bots: [null, { level: 8 }], phase: 'playing', paused: false });
  // The world shown never catches up with the throw, as over a slow link.
  await wait(250);

  assert.ok(sent.length >= 2, JSON.stringify(sent));
  assert.equal(sent[0].action, 'press');
  assert.ok(Number.isFinite(sent[0].ph));
  assert.deepEqual(sent.slice(1), [{ action: 'release', bot: true }]);
  assert.ok(sent.every((a) => a.bot === true));
});
