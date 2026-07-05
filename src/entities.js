/**
 * Pixel Invaders — entities: Player, Formation, Bullet, Bomb, Ufo, Bunker
 * Created by Stephane Plaisance
 * Co-authored by Claude (Anthropic)
 * Version 1.1.0 — 2026-07-05
 */

import { GAME } from './config.js';
import { SPRITES, bmpWidth, bmpHeight, drawSprite, makeBunkerGrid } from './sprites.js';
import { clamp, lerp, randRange, choice } from './util.js';
import { rectIntersection } from './collision.js';

/* Row layout, top → bottom: 1 squid row, 2 crab rows, 2 octopus rows. */
export const ROW_TYPES = ['squid', 'crab', 'crab', 'octopus', 'octopus'];

/* ------------------------------------------------------------------ */

export class Player {
  constructor(cfg) {
    this.cfg = cfg;
    this.w = bmpWidth(SPRITES.player[0]);
    this.h = bmpHeight(SPRITES.player[0]);
    this.y = GAME.playerY;
    this.reset();
  }

  reset() {
    this.x = GAME.playerStartX;
    this.alive = true;
  }

  update(dt, input) {
    if (!this.alive) return;
    const dx = (this.cfg.playerSpeed * dt) / 1000;
    if (input.isDown('left')) this.x -= dx;
    if (input.isDown('right')) this.x += dx;
    this.x = clamp(this.x, GAME.playfieldLeft, GAME.playfieldRight - this.w);
  }

  rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  draw(ctx, color) {
    if (this.alive) drawSprite(ctx, SPRITES.player[0], this.x, this.y, color);
  }
}

/* ------------------------------------------------------------------ */

export class Bullet {
  constructor(cfg) {
    this.cfg = cfg;
    this.w = 1;
    this.h = 4;
    this.active = false;
    this.x = 0;
    this.y = 0;
  }

  fire(fromX, fromY) {
    this.active = true;
    this.x = fromX;
    this.y = fromY;
  }

  update(dt) {
    if (!this.active) return;
    this.y -= (this.cfg.bulletSpeed * dt) / 1000;
    if (this.y + this.h < GAME.bulletTopLimit) this.active = false;
  }

  rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  draw(ctx, color) {
    if (!this.active) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), this.w, this.h);
  }
}

/* ------------------------------------------------------------------ */

const BOMB_SPRITES = {
  squiggly: SPRITES.bombSquiggly,
  plunger: SPRITES.bombPlunger,
  rolling: SPRITES.bombRolling,
};

export class Bomb {
  constructor(cfg, x, y) {
    this.cfg = cfg;
    this.type = choice(['squiggly', 'plunger', 'rolling']);
    this.frames = BOMB_SPRITES[this.type];
    this.w = bmpWidth(this.frames[0]);
    this.h = bmpHeight(this.frames[0]);
    this.x = x - this.w / 2;
    this.y = y;
    this.active = true;
    this.animT = 0;
    this.frame = 0;
  }

  update(dt) {
    if (!this.active) return;
    this.y += (this.cfg.bombSpeed * dt) / 1000;
    this.animT += dt;
    if (this.animT > 100) {
      this.animT = 0;
      this.frame = 1 - this.frame;
    }
    if (this.y > GAME.groundY - this.h) this.active = false;
  }

  rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  draw(ctx, color) {
    if (this.active) drawSprite(ctx, this.frames[this.frame], this.x, this.y, color);
  }
}

/* ------------------------------------------------------------------ */

export class Formation {
  constructor(cfg, wave = 1) {
    this.cfg = cfg;
    this.reset(wave);
  }

  reset(wave) {
    this.wave = wave;
    this.originX = GAME.formationStartX;
    this.originY = Math.min(
      GAME.formationStartY + (wave - 1) * GAME.waveStartYStep,
      GAME.formationMaxStartY
    );
    this.dir = 1;
    this.frame = 0;
    this.stepTimer = 0;
    this.alive = new Array(GAME.rows * GAME.cols).fill(true);
    this.aliveCount = GAME.rows * GAME.cols;
  }

  typeOfRow(row) {
    return ROW_TYPES[row];
  }

  spriteFor(row) {
    return SPRITES[this.typeOfRow(row)][this.frame];
  }

  /* Screen rect of alien index i (row-major), centred in its cell. */
  alienRect(i) {
    const row = Math.floor(i / GAME.cols);
    const col = i % GAME.cols;
    const bmp = SPRITES[this.typeOfRow(row)][0];
    const w = bmpWidth(bmp);
    const h = bmpHeight(bmp);
    return {
      x: this.originX + col * GAME.cellW + (GAME.cellW - w) / 2,
      y: this.originY + row * GAME.cellH,
      w,
      h,
      row,
      col,
      index: i,
    };
  }

  forEachAlive(cb) {
    for (let i = 0; i < this.alive.length; i++) {
      if (this.alive[i]) cb(this.alienRect(i), i);
    }
  }

  killAt(i) {
    if (!this.alive[i]) return null;
    this.alive[i] = false;
    this.aliveCount--;
    const row = Math.floor(i / GAME.cols);
    return GAME.scores[this.typeOfRow(row)];
  }

  /* Emergent speed-up: step interval scales with alive count and wave. */
  stepIntervalMs() {
    const t = this.aliveCount / (GAME.rows * GAME.cols);
    const pace = Math.pow(this.cfg.wavePace, this.wave - 1);
    return lerp(this.cfg.fastStepMs, this.cfg.slowStepMs, t) * pace;
  }

  horizontalExtent() {
    let min = Infinity;
    let max = -Infinity;
    this.forEachAlive((r) => {
      if (r.x < min) min = r.x;
      if (r.x + r.w > max) max = r.x + r.w;
    });
    return { min, max };
  }

  /* Lowest occupied pixel row of the formation. */
  lowestBottomY() {
    let bottom = -Infinity;
    this.forEachAlive((r) => {
      if (r.y + r.h > bottom) bottom = r.y + r.h;
    });
    return bottom;
  }

  /**
   * Advance the march timer; performs at most one lockstep move.
   * @returns {{stepped: boolean}} stepped=true when the block moved
   *   (caller plays one heartbeat note and erodes bunkers under aliens).
   */
  update(dt) {
    if (this.aliveCount === 0) return { stepped: false };
    this.stepTimer += dt;
    const interval = this.stepIntervalMs();
    if (this.stepTimer < interval) return { stepped: false };
    this.stepTimer -= interval;
    if (this.stepTimer > interval) this.stepTimer = 0; // don't burst after lag

    const { min, max } = this.horizontalExtent();
    const dx = this.cfg.stepDx * this.dir;
    const hitsWall =
      min + dx < GAME.playfieldLeft || max + dx > GAME.playfieldRight;
    if (hitsWall) {
      this.originY += this.cfg.dropDy;
      this.dir = -this.dir;
    } else {
      this.originX += dx;
    }
    this.frame = 1 - this.frame; // 2-frame walk animation
    return { stepped: true };
  }

  /* Bottom-most alive alien of each column — the only bomb droppers. */
  bottomAliens() {
    const result = [];
    for (let col = 0; col < GAME.cols; col++) {
      for (let row = GAME.rows - 1; row >= 0; row--) {
        const i = row * GAME.cols + col;
        if (this.alive[i]) {
          result.push(this.alienRect(i));
          break;
        }
      }
    }
    return result;
  }

  draw(ctx, colorFor) {
    this.forEachAlive((r) => {
      drawSprite(ctx, this.spriteFor(r.row), r.x, r.y, colorFor(r.y));
    });
  }
}

/* ------------------------------------------------------------------ */

export class Ufo {
  constructor(cfg) {
    this.cfg = cfg;
    this.w = bmpWidth(SPRITES.ufo[0]);
    this.h = bmpHeight(SPRITES.ufo[0]);
    this.y = GAME.ufoY;
    this.active = false;
    this.fromLeft = true;
    this.resetTimer();
  }

  resetTimer() {
    this.timer = this.cfg.ufoIntervalMs * randRange(0.8, 1.2);
  }

  update(dt) {
    if (!this.active) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.active = true;
        this.fromLeft = !this.fromLeft;
        this.x = this.fromLeft ? -this.w : GAME.width;
      }
      return;
    }
    const dx = (this.cfg.ufoSpeed * dt) / 1000;
    this.x += this.fromLeft ? dx : -dx;
    if (this.x > GAME.width || this.x + this.w < 0) {
      this.active = false;
      this.resetTimer();
    }
  }

  shotDown() {
    this.active = false;
    this.resetTimer();
  }

  rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  draw(ctx, color) {
    if (this.active) drawSprite(ctx, SPRITES.ufo[0], this.x, this.y, color);
  }
}

/* ------------------------------------------------------------------ */

export class Bunker {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = GAME.bunkerW;
    this.h = GAME.bunkerH;
    this.grid = makeBunkerGrid(this.w, this.h);
  }

  rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  pixelOn(gx, gy) {
    return (
      gx >= 0 && gx < this.w && gy >= 0 && gy < this.h &&
      this.grid[gy * this.w + gx] === 1
    );
  }

  clearPixel(gx, gy) {
    if (gx >= 0 && gx < this.w && gy >= 0 && gy < this.h) {
      this.grid[gy * this.w + gx] = 0;
    }
  }

  /**
   * Per-pixel collision: first 'on' pixel overlapped by the rect,
   * in world coords, or null.
   */
  collide(rect) {
    const inter = rectIntersection(rect, this.rect());
    if (!inter) return null;
    const gx0 = Math.floor(inter.x - this.x);
    const gy0 = Math.floor(inter.y - this.y);
    const gx1 = Math.ceil(inter.x + inter.w - this.x);
    const gy1 = Math.ceil(inter.y + inter.h - this.y);
    for (let gy = gy0; gy < gy1; gy++) {
      for (let gx = gx0; gx < gx1; gx++) {
        if (this.pixelOn(gx, gy)) {
          return { x: this.x + gx, y: this.y + gy };
        }
      }
    }
    return null;
  }

  /* Carve a ragged blast footprint around a world-coord impact point. */
  explodeAt(wx, wy, radius) {
    const cx = Math.floor(wx - this.x);
    const cy = Math.floor(wy - this.y);
    const r = radius;
    for (let dy = -r - 1; dy <= r + 1; dy++) {
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 <= r * r || (d2 <= (r + 1) * (r + 1) && Math.random() < 0.4)) {
          this.clearPixel(cx + dx, cy + dy);
        }
      }
    }
  }

  /* Aliens marching through a bunker erase what they touch. */
  erodeRect(rect) {
    const inter = rectIntersection(rect, this.rect());
    if (!inter) return;
    const gx0 = Math.floor(inter.x - this.x);
    const gy0 = Math.floor(inter.y - this.y);
    const gx1 = Math.ceil(inter.x + inter.w - this.x);
    const gy1 = Math.ceil(inter.y + inter.h - this.y);
    for (let gy = gy0; gy < gy1; gy++) {
      for (let gx = gx0; gx < gx1; gx++) this.clearPixel(gx, gy);
    }
  }

  draw(ctx, color) {
    ctx.fillStyle = color;
    for (let gy = 0; gy < this.h; gy++) {
      for (let gx = 0; gx < this.w; gx++) {
        if (this.grid[gy * this.w + gx] === 1) {
          ctx.fillRect(this.x + gx, this.y + gy, 1, 1);
        }
      }
    }
  }
}

/** Build the 4 evenly-spaced bunkers. */
export function makeBunkers() {
  const n = GAME.bunkerCount;
  const gap = (GAME.width - n * GAME.bunkerW) / (n + 1);
  const bunkers = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(gap + i * (GAME.bunkerW + gap));
    bunkers.push(new Bunker(x, GAME.bunkerY));
  }
  return bunkers;
}
