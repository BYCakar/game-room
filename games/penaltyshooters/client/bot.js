// Browser-owned opponent; every action is still judged by the server.
import { KEEPER_MS, FLIGHT_MS } from '../shared/rules.js';
import { chooseBotShot, chooseKeeperRead, planKeeperAction } from '../shared/bot-strategy.js';

export function createBot(ctx, { random = Math.random, now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let game = null, receivedAt = 0, timer = null, plan = null;
  let turn = '', sentTurn = '', observedTurn = '', matchId = '';
  const memory = [];
  const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; };
  const serverNow = () => game.serverTime + Math.max(0, now() - receivedAt);
  const flightStart = () => game.flightStartedAt ?? game.phaseStartedAt + (game.runupDurationMs ?? KEEPER_MS);

  function schedule(seat) {
    if (!plan || timer !== null) return;
    const planned = plan;
    timer = setTimer(() => {
      timer = null;
      if (!game || game.paused || game.over || game.you === null || turn !== planned.turn || sentTurn === turn) return;
      if (planned.action === 'shoot') {
        if (game.phase !== 'shoot' || game.shooter !== seat) return;
      } else {
        if (!['keeper', 'flight'].includes(game.phase) || game.shooter === seat || game.save || game.contact || game.frameContact) return;
        if (serverNow() >= flightStart() + (game.flightDurationMs ?? FLIGHT_MS)) return;
      }
      sentTurn = turn;
      ctx.send({ action: planned.action, bot: true, turnId: game.turnId, ...planned.target });
    }, Math.max(0, plan.at - serverNow()));
  }

  return {
    update(snapshot) {
      const previous = game;
      // An error redraw of the same object is not a new server-clock sample.
      if (snapshot !== game) { game = snapshot; receivedAt = now(); }
      const nextTurn = `${game.id}:${game.turnId}`;
      if (matchId !== game.id) { memory.length = 0; matchId = game.id; observedTurn = ''; }
      if (nextTurn !== turn) { cancel(); plan = null; turn = nextTurn; sentTurn = ''; }
      else if (plan && previous?.paused) plan.at += game.turnStartedAt - previous.turnStartedAt;
      const seat = game.bots?.findIndex(Boolean) ?? -1;
      if (seat < 0 || game.you === null || game.over || game.paused || sentTurn === turn) { cancel(); return; }
      const level = game.difficultyProfile ?? game.difficultyLevel ?? game.bots[seat].level;
      if (game.shooter === seat && game.phase === 'shoot') {
        if (!plan) {
          const shot = chooseBotShot(level, random);
          plan = { ...shot, action: 'shoot', at: game.serverTime + shot.delayMs, turn };
        }
        schedule(seat);
        return;
      }
      if (game.shooter === seat || !['keeper', 'flight'].includes(game.phase) || !game.shot || game.save || game.contact || game.frameContact) { cancel(); return; }
      if (!plan) {
        const repeats = memory.slice(-4).filter(shot => Math.hypot(shot.x - game.shot.x, shot.y - game.shot.y) < .23).length;
        if (observedTurn !== turn) { memory.push({ ...game.shot }); observedTurn = turn; if (memory.length > 12) memory.shift(); }
        const decision = chooseKeeperRead(game.shot, level, random, repeats);
        const attempt = planKeeperAction({ decision, level, random, now: serverNow(),
          flightStartedAt: flightStart(), flightMs: game.flightDurationMs ?? FLIGHT_MS,
          turnStartedAt: game.turnStartedAt, turnId: game.turnId, bot: true });
        if (!attempt) return;
        plan = { ...attempt, action: 'save', turn };
      }
      // Preserve the timer across keeper -> flight. Resume shifts this same
      // plan's timestamp and keeps its chosen mistake instead of rerolling.
      schedule(seat);
    },
    destroy() { cancel(); game = null; plan = null; },
  };
}
