/**
 * Pixel Invaders — keyboard input: held-key state + rebindable actions
 * Created by Stephane Plaisance
 * Co-authored by Claude (Anthropic)
 * Version 1.1.0 — 2026-07-05
 */

export class Input {
  /**
   * @param {() => Object<string, string[]>} getKeymap — returns the live
   *   action → [KeyboardEvent.code] map (read each event so panel rebinds
   *   apply instantly).
   */
  constructor(getKeymap) {
    this.getKeymap = getKeymap;
    this.held = new Set();
    this.pressQueue = [];
    this.captureCb = null; // when set, next keydown is routed to the panel
  }

  attach(target = window) {
    target.addEventListener('keydown', (e) => this.onKeyDown(e));
    target.addEventListener('keyup', (e) => this.onKeyUp(e));
    target.addEventListener('blur', () => this.held.clear());
  }

  boundCodes() {
    const map = this.getKeymap();
    const codes = new Set();
    for (const list of Object.values(map)) for (const c of list) codes.add(c);
    return codes;
  }

  onKeyDown(e) {
    if (this.captureCb) {
      e.preventDefault();
      const cb = this.captureCb;
      this.captureCb = null;
      cb(e.code === 'Escape' ? null : e.code);
      return;
    }
    // don't steal keys while typing in the settings panel
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const isGameKey =
      this.boundCodes().has(e.code) ||
      e.code.startsWith('Arrow') ||
      e.code === 'Space';
    if (isGameKey) e.preventDefault();

    if (!e.repeat && isGameKey) this.pressQueue.push(e.code);
    this.held.add(e.code);
  }

  onKeyUp(e) {
    this.held.delete(e.code);
  }

  /** True while any key bound to the action is held down. */
  isDown(action) {
    const codes = this.getKeymap()[action] || [];
    return codes.some((c) => this.held.has(c));
  }

  /** Edge-triggered: true once per physical key press of the action. */
  consumePress(action) {
    const codes = this.getKeymap()[action] || [];
    const idx = this.pressQueue.findIndex((c) => codes.includes(c));
    if (idx === -1) return false;
    this.pressQueue.splice(idx, 1);
    return true;
  }

  /** Drop unconsumed presses; call once per rendered frame. */
  endFrame() {
    this.pressQueue.length = 0;
  }

  /** Panel rebinding: route the next keydown to cb(code|null-on-Escape). */
  captureNextKey(cb) {
    this.captureCb = cb;
  }

  cancelCapture() {
    this.captureCb = null;
  }
}

/** Friendly display name for a KeyboardEvent.code. */
export function keyLabel(code) {
  if (!code) return '---';
  const nice = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    ShiftLeft: 'L-SHIFT',
    ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL',
    ControlRight: 'R-CTRL',
  };
  if (nice[code]) return nice[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM-' + code.slice(6);
  return code.toUpperCase();
}
