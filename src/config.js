/**
 * Pixel Invaders — config: all tunables, defaults, persistence
 * Created by Stephane Plaisance
 * Co-authored by Claude (Anthropic)
 * Version 1.1.0 — 2026-07-05
 */

export const APP_NAME = 'PIXEL INVADERS';
export const APP_TAGLINE = 'INSPIRED BY THE 1978 ARCADE CLASSIC';
export const APP_VERSION = '1.1.0';
export const APP_DATE = '2026-07-05';
export const APP_AUTHOR = 'STEPHANE PLAISANCE';
export const APP_COAUTHOR = 'WITH CLAUDE (ANTHROPIC)';

const STORAGE_KEY = 'pixelInvadersConfigV1';

/* Structural constants — not user-tunable (geometry of the arcade playfield). */
export const GAME = {
  width: 224,
  height: 256,
  playfieldLeft: 4,
  playfieldRight: 220,
  hudTop: 16,          // playfield content starts below this
  bulletTopLimit: 16,  // player bullet dies above this line
  ufoY: 19,
  rows: 5,
  cols: 11,
  cellW: 16,
  cellH: 16,
  formationStartX: 24,
  formationStartY: 48,
  formationMaxStartY: 112, // waves start lower, capped here
  waveStartYStep: 8,       // extra start depth per wave
  bunkerCount: 4,
  bunkerY: 192,
  bunkerW: 22,
  bunkerH: 16,
  playerY: 216,
  playerStartX: 16,
  invasionY: 216,      // aliens reaching this row = game over
  groundY: 239,
  scores: { squid: 30, crab: 20, octopus: 10 },
  ufoScores: [50, 100, 150, 300],
};

/* User-tunable defaults — everything here is editable in the control panel. */
export const DEFAULTS = {
  // global
  gameSpeed: 1.0,        // master time multiplier
  // player
  playerSpeed: 75,       // px/s
  bulletSpeed: 300,      // px/s
  lives: 3,
  extraLifeAt: 1500,     // score threshold, 0 = disabled
  // invader march (step interval scales with alive count — the emergent speed-up)
  slowStepMs: 700,       // interval with 55 alive
  fastStepMs: 60,        // interval with 1 alive
  wavePace: 0.93,        // per-wave multiplier on the step interval
  stepDx: 2,             // horizontal px per formation step
  dropDy: 8,             // px dropped at the walls
  // bombs
  bombCap: 3,
  bombSpeed: 85,         // px/s
  bombMinDelayMs: 500,
  bombMaxDelayMs: 1800,
  bombWaveTighten: 0.92, // per-wave multiplier on bomb delays
  // UFO
  ufoIntervalMs: 22000,
  ufoSpeed: 30,          // px/s
  ufoScoringMode: 'random', // 'random' | 'shots' (authentic shot-count rule)
  // display
  colorMode: 'mono',     // 'mono' | 'white' | 'overlay'
  monoColor: '#33ff33',
  // audio
  muted: false,
  volume: 0.5,
  // key bindings: KeyboardEvent.code values, up to 2 per action
  keys: {
    left:  ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    fire:  ['Space'],
    start: ['Enter', 'Space'],
    pause: ['KeyP'],
    panel: ['KeyC'],
    mute:  ['KeyM'],
  },
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeInto(target, source) {
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      mergeInto(target[k], v);
    } else {
      target[k] = Array.isArray(v) ? v.slice() : v;
    }
  }
  return target;
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* Live config object: defaults overlaid with whatever the panel saved. */
export const config = (() => {
  const cfg = deepClone(DEFAULTS);
  const stored = loadStored();
  if (stored) mergeInto(cfg, stored);
  return cfg;
})();

export function saveConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* storage unavailable (private mode) — settings stay session-only */
  }
}

export function resetConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  const fresh = deepClone(DEFAULTS);
  for (const k of Object.keys(config)) delete config[k];
  mergeInto(config, fresh);
}
