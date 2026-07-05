/**
 * Pixel Invaders — collision helpers (AABB; bunkers do per-pixel tests)
 * Created by Stephane Plaisance
 * Co-authored by Claude (Anthropic)
 * Version 1.1.0 — 2026-07-05
 */

/** Axis-aligned rectangle overlap. Rects are {x, y, w, h}. */
export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Intersection rect of two AABBs, or null if disjoint. */
export function rectIntersection(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x || y2 <= y) return null;
  return { x, y, w: x2 - x, h: y2 - y };
}
