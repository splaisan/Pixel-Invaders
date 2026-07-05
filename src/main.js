/**
 * Pixel Invaders — bootstrap, fixed-timestep loop, FSM, game wiring
 * Created by Stephane Plaisance
 * Co-authored by Claude (Anthropic)
 * Version 1.1.0 — 2026-07-05
 */

import {
  GAME, config,
  APP_NAME, APP_TAGLINE, APP_VERSION, APP_DATE, APP_AUTHOR, APP_COAUTHOR,
} from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Panel } from './panel.js';
import {
  Player, Bullet, Bomb, Formation, Ufo, makeBunkers,
} from './entities.js';
import { rectsOverlap } from './collision.js';
import { SPRITES, drawSprite, drawText, drawTextCentered } from './sprites.js';
import { randRange, choice } from './util.js';

/* ------------------------------------------------------------------ */
/* Setup: canvas, integer scaling, input, audio, panel                 */
/* ------------------------------------------------------------------ */

const screenCanvas = document.getElementById('screen');
const screenCtx = screenCanvas.getContext('2d');
screenCtx.imageSmoothingEnabled = false;

const buffer = document.createElement('canvas');
buffer.width = GAME.width;
buffer.height = GAME.height;
const ctx = buffer.getContext('2d');

let scale = 1;
function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  scale = Math.max(1, Math.floor(Math.min(vw / GAME.width, vh / GAME.height)));
  screenCanvas.width = GAME.width * scale;
  screenCanvas.height = GAME.height * scale;
  screenCtx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

const input = new Input(() => config.keys);
input.attach(window);

const audio = new AudioEngine(config);
const unlockAudio = () => audio.unlock();
window.addEventListener('keydown', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);

const panel = new Panel({
  root: document.getElementById('panel'),
  input,
  audio,
  onOpen: () => {},
  onClose: () => {},
});
document.getElementById('gear').addEventListener('click', () => panel.toggle());

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */

const STATE = {
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  GAME_OVER: 'GAME_OVER',
};

const game = {
  state: STATE.TITLE,
  score: 0,
  hiScore: 0, // session-only, per handoff
  wave: 1,
  lives: 3,
  shotsFired: 0,
  extraLifeAwarded: false,
  paused: false,
  player: new Player(config),
  bullet: new Bullet(config),
  bombs: [],
  bombTimer: 0,
  formation: new Formation(config, 1),
  ufo: new Ufo(config),
  bunkers: makeBunkers(),
  explosions: [],   // {x, y, t, color?}
  floaters: [],     // {text, x, y, t}
  deathTimer: 0,    // freeze-frame after the player is hit
  clearTimer: 0,    // LEVEL_CLEAR pause
  blinkT: 0,
};

function bombDelay() {
  const tighten = Math.pow(config.bombWaveTighten, game.wave - 1);
  const lo = Math.min(config.bombMinDelayMs, config.bombMaxDelayMs);
  const hi = Math.max(config.bombMinDelayMs, config.bombMaxDelayMs);
  return randRange(lo, hi) * tighten;
}

function startGame() {
  game.score = 0;
  game.wave = 1;
  game.lives = config.lives;
  game.shotsFired = 0;
  game.extraLifeAwarded = false;
  startWave(1);
  game.state = STATE.PLAYING;
}

function startWave(wave) {
  game.wave = wave;
  game.formation.reset(wave);
  game.bunkers = makeBunkers();
  game.player.reset();
  game.bullet.active = false;
  game.bombs = [];
  game.bombTimer = bombDelay();
  game.ufo = new Ufo(config);
  game.explosions = [];
  game.floaters = [];
  game.deathTimer = 0;
  audio.resetMarch();
}

function gameOver() {
  audio.ufoStop();
  if (game.score > game.hiScore) game.hiScore = game.score;
  game.state = STATE.GAME_OVER;
}

function addExplosion(x, y, ms = 300) {
  game.explosions.push({ x, y, t: ms });
}

function addFloater(text, x, y, ms = 1000) {
  game.floaters.push({ text, x, y, t: ms });
}

function addScore(points) {
  game.score += points;
  if (game.score > game.hiScore) game.hiScore = game.score;
  if (
    !game.extraLifeAwarded &&
    config.extraLifeAt > 0 &&
    game.score >= config.extraLifeAt
  ) {
    game.extraLifeAwarded = true;
    game.lives++;
    audio.playExtraLife();
    addFloater('EXTRA LIFE', GAME.width / 2 - 30, 120, 1500);
  }
}

function ufoScore() {
  if (config.ufoScoringMode === 'shots') {
    const n = game.shotsFired;
    if (n === 23 || (n > 23 && (n - 23) % 15 === 0)) return 300;
    return choice([50, 100, 150]);
  }
  return choice(GAME.ufoScores);
}

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

function colorFor(y) {
  switch (config.colorMode) {
    case 'white':
      return '#ffffff';
    case 'overlay':
      if (y < 32) return '#ff5555';        // UFO strip
      if (y >= 184) return '#33ff33';      // bunkers + player band
      return '#ffffff';
    case 'mono':
    default:
      return config.monoColor;
  }
}

function hudColor() {
  return config.colorMode === 'mono' ? config.monoColor : '#ffffff';
}

/* ------------------------------------------------------------------ */
/* Update                                                              */
/* ------------------------------------------------------------------ */

function updatePlaying(dt) {
  // freeze-frame while the player explosion plays out
  if (game.deathTimer > 0) {
    game.deathTimer -= dt;
    tickEffects(dt);
    if (game.deathTimer <= 0) {
      if (game.lives > 0) {
        game.player.reset();
        game.bombs = [];
      } else {
        gameOver();
      }
    }
    return;
  }

  // player + firing
  game.player.update(dt, input);
  if (!game.bullet.active && input.isDown('fire')) {
    game.bullet.fire(
      game.player.x + Math.floor(game.player.w / 2),
      game.player.y - 4
    );
    game.shotsFired++;
    audio.playShoot();
  }
  game.bullet.update(dt);

  // formation march
  const { stepped } = game.formation.update(dt);
  if (stepped) {
    audio.playMarchTick();
    // aliens grind away any bunker they march through
    game.formation.forEachAlive((r) => {
      for (const b of game.bunkers) b.erodeRect(r);
    });
  }
  if (game.formation.lowestBottomY() >= GAME.invasionY) {
    gameOver(); // invasion — immediate loss regardless of lives
    return;
  }

  // player bullet collisions
  if (game.bullet.active) {
    const br = game.bullet.rect();
    // vs UFO
    if (game.ufo.active && rectsOverlap(br, game.ufo.rect())) {
      const pts = ufoScore();
      addScore(pts);
      addFloater(String(pts), game.ufo.x + 2, game.ufo.y, 1200);
      addExplosion(game.ufo.x + 4, game.ufo.y);
      game.ufo.shotDown();
      audio.ufoStop();
      audio.playUfoHit();
      game.bullet.active = false;
    }
    // vs invaders
    if (game.bullet.active) {
      let hit = null;
      game.formation.forEachAlive((r, i) => {
        if (!hit && rectsOverlap(br, r)) hit = { r, i };
      });
      if (hit) {
        const pts = game.formation.killAt(hit.i);
        addScore(pts);
        addExplosion(hit.r.x + hit.r.w / 2 - 4, hit.r.y);
        audio.playInvaderBoom();
        game.bullet.active = false;
      }
    }
    // vs bunkers
    if (game.bullet.active) {
      for (const b of game.bunkers) {
        const p = b.collide(br);
        if (p) {
          b.explodeAt(p.x, p.y, 2);
          game.bullet.active = false;
          break;
        }
      }
    }
  }

  // bombs: spawn from bottom-of-column aliens, capped
  game.bombTimer -= dt;
  if (
    game.bombTimer <= 0 &&
    game.bombs.length < config.bombCap &&
    game.formation.aliveCount > 0
  ) {
    const droppers = game.formation.bottomAliens();
    if (droppers.length > 0) {
      const from = choice(droppers);
      game.bombs.push(new Bomb(config, from.x + from.w / 2, from.y + from.h));
    }
    game.bombTimer = bombDelay();
  }

  for (const bomb of game.bombs) {
    bomb.update(dt);
    if (!bomb.active) continue;
    const r = bomb.rect();
    // vs player bullet (bullets can shoot bombs down)
    if (game.bullet.active && rectsOverlap(r, game.bullet.rect())) {
      bomb.active = false;
      game.bullet.active = false;
      addExplosion(bomb.x - 2, bomb.y);
      continue;
    }
    // vs bunkers
    let hitBunker = false;
    for (const b of game.bunkers) {
      const p = b.collide(r);
      if (p) {
        b.explodeAt(p.x, p.y, 3);
        bomb.active = false;
        hitBunker = true;
        break;
      }
    }
    if (hitBunker) continue;
    // vs player
    if (game.player.alive && rectsOverlap(r, game.player.rect())) {
      bomb.active = false;
      killPlayer();
    }
  }
  game.bombs = game.bombs.filter((b) => b.active);

  // UFO
  const wasActive = game.ufo.active;
  game.ufo.update(dt);
  if (game.ufo.active && !wasActive) audio.ufoStart();
  if (!game.ufo.active && wasActive) audio.ufoStop();

  tickEffects(dt);

  // wave cleared
  if (game.formation.aliveCount === 0) {
    audio.ufoStop();
    game.clearTimer = 2000;
    game.state = STATE.LEVEL_CLEAR;
  }
}

function killPlayer() {
  game.player.alive = false;
  game.lives--;
  game.deathTimer = 1500;
  addExplosion(game.player.x + 2, game.player.y, 1500);
  audio.ufoStop();
  audio.playPlayerBoom();
}

function tickEffects(dt) {
  for (const e of game.explosions) e.t -= dt;
  game.explosions = game.explosions.filter((e) => e.t > 0);
  for (const f of game.floaters) f.t -= dt;
  game.floaters = game.floaters.filter((f) => f.t > 0);
}

function update(dt) {
  game.blinkT += dt;

  if (input.consumePress('mute')) {
    audio.toggleMute();
  }
  if (input.consumePress('panel')) {
    panel.toggle();
  }
  if (panel.isOpen) return; // settings open = game held

  switch (game.state) {
    case STATE.TITLE:
      if (input.consumePress('start')) startGame();
      break;
    case STATE.PLAYING:
      if (input.consumePress('pause')) game.paused = !game.paused;
      if (!game.paused) updatePlaying(dt);
      break;
    case STATE.LEVEL_CLEAR:
      game.clearTimer -= dt;
      if (game.clearTimer <= 0) {
        startWave(game.wave + 1);
        game.state = STATE.PLAYING;
      }
      break;
    case STATE.GAME_OVER:
      if (input.consumePress('start')) game.state = STATE.TITLE;
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function pad(n, width = 4) {
  return String(n).padStart(width, '0');
}

function drawHud() {
  const c = hudColor();
  drawText(ctx, 'SCORE', 8, 2, c);
  drawText(ctx, pad(game.score), 8, 11, colorFor(200));
  drawText(ctx, 'HI-SCORE', 122, 2, c);
  drawText(ctx, pad(game.hiScore), 122, 11, colorFor(200));
}

function drawBottomHud() {
  const green = colorFor(200);
  ctx.fillStyle = green;
  ctx.fillRect(0, GAME.groundY, GAME.width, 1);
  drawText(ctx, String(Math.max(game.lives, 0)), 8, 243, green);
  let x = 20;
  for (let i = 0; i < Math.max(game.lives - 1, 0) && i < 5; i++) {
    drawSprite(ctx, SPRITES.player[0], x, 243, green);
    x += 16;
  }
  const waveText = 'WAVE ' + game.wave;
  drawText(ctx, waveText, GAME.width - 8 - waveText.length * 6, 243, green);
}

function drawPlayfield() {
  game.formation.draw(ctx, colorFor);
  for (const b of game.bunkers) b.draw(ctx, colorFor(GAME.bunkerY));
  game.player.draw(ctx, colorFor(GAME.playerY));
  game.bullet.draw(ctx, hudColor());
  for (const bomb of game.bombs) bomb.draw(ctx, colorFor(bomb.y));
  game.ufo.draw(ctx, colorFor(GAME.ufoY));
  for (const e of game.explosions) {
    drawSprite(ctx, SPRITES.explosion[0], e.x, e.y, colorFor(e.y));
  }
  for (const f of game.floaters) {
    drawText(ctx, f.text, f.x, f.y, hudColor());
  }
}

function blinkOn() {
  return Math.floor(game.blinkT / 500) % 2 === 0;
}

function renderTitle() {
  const c = hudColor();
  const green = config.colorMode === 'white' ? '#ffffff' : '#33ff33';
  drawHud();
  drawTextCentered(ctx, APP_NAME, GAME.width / 2, 44, c, 2);
  drawTextCentered(ctx, APP_TAGLINE, GAME.width / 2, 64, green);

  // score table with the actual sprites
  drawTextCentered(ctx, '* SCORE ADVANCE TABLE *', GAME.width / 2, 84, c);
  const rows = [
    [SPRITES.ufo[0], '= ? MYSTERY', '#ff5555'],
    [SPRITES.squid[0], '= 30 POINTS', c],
    [SPRITES.crab[0], '= 20 POINTS', c],
    [SPRITES.octopus[0], '= 10 POINTS', c],
  ];
  let y = 100;
  for (const [bmp, text, color] of rows) {
    const useColor = config.colorMode === 'mono' ? config.monoColor : color;
    drawSprite(ctx, bmp, 66 - bmp[0].length / 2, y, useColor);
    drawText(ctx, text, 84, y, c);
    y += 16;
  }

  if (blinkOn()) {
    drawTextCentered(ctx, 'PRESS ENTER TO PLAY', GAME.width / 2, 172, c);
  }
  drawTextCentered(ctx, 'C = SETTINGS   M = MUTE', GAME.width / 2, 188, c);

  drawTextCentered(ctx, 'CREATED BY ' + APP_AUTHOR, GAME.width / 2, 216, green);
  drawTextCentered(ctx, APP_COAUTHOR, GAME.width / 2, 226, green);
  drawTextCentered(ctx, 'V' + APP_VERSION + ' - ' + APP_DATE, GAME.width / 2, 236, green);
}

function renderPlaying() {
  drawHud();
  drawPlayfield();
  drawBottomHud();
  if (game.paused) {
    drawTextCentered(ctx, 'PAUSED', GAME.width / 2, 124, hudColor(), 2);
  }
}

function renderLevelClear() {
  drawHud();
  drawPlayfield();
  drawBottomHud();
  if (blinkOn()) {
    drawTextCentered(ctx, 'WAVE ' + game.wave + ' CLEARED', GAME.width / 2, 124, hudColor());
  }
}

function renderGameOver() {
  drawHud();
  drawPlayfield();
  drawBottomHud();
  drawTextCentered(ctx, 'GAME OVER', GAME.width / 2, 108, '#ff5555', 2);
  drawTextCentered(ctx, 'SCORE ' + pad(game.score), GAME.width / 2, 136, hudColor());
  if (blinkOn()) {
    drawTextCentered(ctx, 'PRESS ENTER', GAME.width / 2, 156, hudColor());
  }
}

function render() {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, GAME.width, GAME.height);

  switch (game.state) {
    case STATE.TITLE: renderTitle(); break;
    case STATE.PLAYING: renderPlaying(); break;
    case STATE.LEVEL_CLEAR: renderLevelClear(); break;
    case STATE.GAME_OVER: renderGameOver(); break;
  }

  if (panel.isOpen) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, GAME.width, GAME.height);
    drawTextCentered(ctx, 'SETTINGS OPEN', GAME.width / 2, 124, hudColor());
  }

  screenCtx.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
  screenCtx.drawImage(
    buffer,
    0, 0, GAME.width, GAME.height,
    0, 0, GAME.width * scale, GAME.height * scale
  );
}

/* ------------------------------------------------------------------ */
/* Fixed-timestep loop (framerate-independent)                         */
/* ------------------------------------------------------------------ */

const UPDATE_HZ = 60;
const STEP = 1000 / UPDATE_HZ;
let last = performance.now();
let accumulator = 0;

function loop(now) {
  accumulator += now - last;
  last = now;
  if (accumulator > 250) accumulator = 250; // tab was hidden — don't burst
  while (accumulator >= STEP) {
    update(STEP * config.gameSpeed);
    accumulator -= STEP;
  }
  input.endFrame();
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

/* Debug/testing handle (read-only inspection; harmless in production). */
window.__pixelInvaders = { game, config, GAME };
