// Eight user-facing levels. The first six retain the old levels 3 through 8
// exactly, including their learning rate and shot preparation time.
export const BOT_LEVELS = 8;
const WRONG = [.34, .28, .22, .17, .12, .08, .045, .025];
const SHORT = [.32, .29, .25, .21, .17, .12, .075, .045];
const JITTER = [.30, .27, .24, .20, .16, .12, .08, .05];
const JITTER_MS = [95, 85, 75, 60, 45, 30, 20, 12];
const OUT = [.18, .15, .12, .10, .075, .055, .035, .02];
const CORNER = [.36, .44, .52, .60, .68, .76, .84, .90];
const READ_ERROR = [.026, .022, .018, .014, .010, .006, .004, .0025];
const AIM_LEAD = [800, 750, 700, 650, 600, 550, 500];
// Both tournament formats have two full pairs of knockout rounds. Starting
// at level 8 therefore reaches a 400 ms cue lead in the final.
const LEVEL_8_AIM_LEAD = 400 / .9 ** 2;
// Calibrated with 20,000 physical attempts per case: varied shots, then
// repeated high/low corners. Perfect reads remain limited by body geometry.
const BASE_SAVE_RATE = .8665;
const LEARNED_SAVE_RATE = .8983;
const COMPETENT_SAVE_RATE = .9975;
const MAX_COMPETENT_MIX = .95;

export function saveGrowthForRate(rate) { return rate <= .8 ? .05 : .03; }

export function difficulty(input) {
  const requested = input && typeof input === 'object' ? input.level : input;
  const index = Math.max(1, Math.min(BOT_LEVELS, Math.round(Number(requested) || 3))) - 1;
  const extra = Number(input?.overtimeSteps);
  const overtimeSteps = index === BOT_LEVELS - 1 && Number.isFinite(extra) ? Math.max(0, Math.floor(extra)) : 0;
  const saveGrowth = saveGrowthForRate(BASE_SAVE_RATE);
  const aimLeadMs = index < 7 ? AIM_LEAD[index] : LEVEL_8_AIM_LEAD * .9 ** overtimeSteps;
  return { level: index + 1, strength: index + 3, wrongCorner: WRONG[index], shortReach: SHORT[index],
    readError: READ_ERROR[index], timingError: JITTER[index], timingErrorMs: JITTER_MS[index],
    shotOutside: OUT[index], shotCorner: CORNER[index], overtimeSteps, saveGrowth,
    saveMultiplier: (1 + saveGrowth) ** overtimeSteps, aimLeadMs, aimRevealOffsetMs: -aimLeadMs };
}

export function tournamentProfile(baseLevel, stage, globalCup = false) {
  const rounds = globalCup ? ['round32', 'round16', 'quarter', 'semi', 'final'] : ['round16', 'quarter', 'semi', 'final'];
  const knockoutAdvances = rounds.indexOf(stage) + 1;
  const increase = Math.floor(knockoutAdvances / 2);
  const base = difficulty(baseLevel).level;
  const effective = base + increase;
  return { ...difficulty({ level: Math.min(BOT_LEVELS, effective), overtimeSteps: Math.max(0, effective - BOT_LEVELS) }),
    baseLevel: base, knockoutAdvances, increase };
}

export function tournamentDifficulty(baseLevel, stage, globalCup = false) {
  return tournamentProfile(baseLevel, stage, globalCup).level;
}

// A calibrated mixture increases actual physical saves, rather than scaling
// the much smaller error percentage by 3%. The competent branch still needs
// a real body/ball intersection. Keep a baseline branch even at saturation,
// so explicit wrong-corner and short-reach mistakes never disappear.
export function keeperCompetenceMix(profile, repeats = 0) {
  const settings = difficulty(profile);
  if (!settings.overtimeSteps) return 0;
  const learning = Math.min(3, Math.max(0, repeats)) / 3;
  const baseline = BASE_SAVE_RATE + (LEARNED_SAVE_RATE - BASE_SAVE_RATE) * learning;
  const requestedGain = baseline * (settings.saveMultiplier - 1);
  return Math.min(MAX_COMPETENT_MIX, requestedGain / (COMPETENT_SAVE_RATE - baseline));
}
