/**
 * Pixel Invaders — settings control panel (DOM overlay)
 * Edits the live config: speeds, difficulty, UFO, display, audio, key bindings.
 * Changes persist in localStorage; "reset" restores handoff defaults.
 * Created by Stephane Plaisance
 * Co-authored by Claude (Anthropic)
 * Version 1.1.0 — 2026-07-05
 */

import { config, saveConfig, resetConfig } from './config.js';
import { keyLabel } from './input.js';

export class Panel {
  /**
   * @param {Object} deps
   * @param {HTMLElement} deps.root — container element for the panel
   * @param {import('./input.js').Input} deps.input — for key capture
   * @param {import('./audio.js').AudioEngine} deps.audio — live volume/mute
   * @param {() => void} deps.onOpen  — pause hook
   * @param {() => void} deps.onClose — resume hook
   */
  constructor({ root, input, audio, onOpen, onClose }) {
    this.root = root;
    this.input = input;
    this.audio = audio;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.isOpen = false;
    this.build();
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.root.classList.add('open');
    this.onOpen();
  }

  close() {
    this.input.cancelCapture();
    this.isOpen = false;
    this.root.classList.remove('open');
    this.onClose();
  }

  save() {
    saveConfig();
  }

  build() {
    this.root.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'panel-head';
    h.innerHTML = '<span>SETTINGS</span>';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'panel-close';
    closeBtn.addEventListener('click', () => this.close());
    h.appendChild(closeBtn);
    this.root.appendChild(h);

    const body = document.createElement('div');
    body.className = 'panel-body';
    this.root.appendChild(body);
    this.body = body;

    this.section('GAME');
    this.slider('Game speed', 'gameSpeed', 0.5, 2, 0.05, (v) => v.toFixed(2) + 'x');
    this.slider('Starting lives', 'lives', 1, 6, 1, String, 'next game');
    this.slider('Extra life at', 'extraLifeAt', 0, 5000, 500, (v) => (v === 0 ? 'off' : v + ' pts'), 'next game');
    this.slider('Wave pace-up', 'wavePace', 0.8, 1, 0.01, (v) => v.toFixed(2) + 'x/wave');

    this.section('PLAYER');
    this.slider('Cannon speed', 'playerSpeed', 30, 150, 5, (v) => v + ' px/s');
    this.slider('Bullet speed', 'bulletSpeed', 120, 480, 10, (v) => v + ' px/s');

    this.section('INVADERS');
    this.slider('March: slowest step', 'slowStepMs', 200, 1200, 20, (v) => v + ' ms');
    this.slider('March: fastest step', 'fastStepMs', 16, 200, 4, (v) => v + ' ms');
    this.slider('Max bombs on screen', 'bombCap', 0, 6, 1, String);
    this.slider('Bomb fall speed', 'bombSpeed', 40, 200, 5, (v) => v + ' px/s');
    this.slider('Bomb delay min', 'bombMinDelayMs', 100, 3000, 100, (v) => v + ' ms');
    this.slider('Bomb delay max', 'bombMaxDelayMs', 200, 5000, 100, (v) => v + ' ms');

    this.section('MYSTERY UFO');
    this.slider('Interval', 'ufoIntervalMs', 5000, 60000, 1000, (v) => (v / 1000).toFixed(0) + ' s');
    this.slider('Speed', 'ufoSpeed', 10, 80, 2, (v) => v + ' px/s');
    this.select('Scoring', 'ufoScoringMode', [
      ['random', 'Random 50-300'],
      ['shots', 'Authentic (shot count)'],
    ]);

    this.section('DISPLAY');
    this.select('Colors', 'colorMode', [
      ['mono', 'Mono green'],
      ['white', 'White'],
      ['overlay', 'Arcade overlay bands'],
    ]);

    this.section('AUDIO');
    this.checkbox('Mute', 'muted', () => this.audio.applyVolume());
    this.slider('Volume', 'volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%', null, () => this.audio.applyVolume());

    this.section('KEY BINDINGS');
    this.note('Click a key, then press the new key. ESC cancels.');
    for (const [action, label] of [
      ['left', 'Move left'],
      ['right', 'Move right'],
      ['fire', 'Fire'],
      ['start', 'Start / restart'],
      ['pause', 'Pause'],
      ['panel', 'Settings panel'],
      ['mute', 'Mute toggle'],
    ]) {
      this.keyRow(action, label);
    }

    this.section('');
    const resetBtn = document.createElement('button');
    resetBtn.className = 'panel-reset';
    resetBtn.textContent = 'RESET TO DEFAULTS';
    resetBtn.addEventListener('click', () => {
      resetConfig();
      this.audio.applyVolume();
      this.build(); // re-render controls with default values
    });
    this.body.appendChild(resetBtn);

    const note = document.createElement('div');
    note.className = 'panel-note';
    note.textContent = 'Settings are saved in this browser.';
    this.body.appendChild(note);
  }

  section(title) {
    const el = document.createElement('div');
    el.className = 'panel-section';
    el.textContent = title;
    this.body.appendChild(el);
  }

  note(text) {
    const el = document.createElement('div');
    el.className = 'panel-note';
    el.textContent = text;
    this.body.appendChild(el);
  }

  row(labelText) {
    const row = document.createElement('label');
    row.className = 'panel-row';
    const lab = document.createElement('span');
    lab.className = 'panel-label';
    lab.textContent = labelText;
    row.appendChild(lab);
    this.body.appendChild(row);
    return row;
  }

  slider(label, key, min, max, step, fmt, hint = null, onChange = null) {
    const row = this.row(label + (hint ? ` (${hint})` : ''));
    const val = document.createElement('span');
    val.className = 'panel-value';
    val.textContent = fmt(config[key]);
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = min;
    inp.max = max;
    inp.step = step;
    inp.value = config[key];
    inp.addEventListener('input', () => {
      config[key] = Number(inp.value);
      val.textContent = fmt(config[key]);
      this.save();
      if (onChange) onChange();
    });
    row.appendChild(inp);
    row.appendChild(val);
  }

  checkbox(label, key, onChange = null) {
    const row = this.row(label);
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!config[key];
    inp.addEventListener('change', () => {
      config[key] = inp.checked;
      this.save();
      if (onChange) onChange();
    });
    row.appendChild(inp);
  }

  select(label, key, options) {
    const row = this.row(label);
    const sel = document.createElement('select');
    for (const [value, text] of options) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      if (config[key] === value) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      config[key] = sel.value;
      this.save();
    });
    row.appendChild(sel);
  }

  keyRow(action, label) {
    const row = this.row(label);
    row.classList.add('panel-keys');
    const slots = document.createElement('span');
    slots.className = 'panel-keyslots';
    row.appendChild(slots);

    const render = () => {
      slots.innerHTML = '';
      const bindings = config.keys[action];
      for (let slot = 0; slot < 2; slot++) {
        const btn = document.createElement('button');
        btn.className = 'panel-keybtn';
        btn.textContent = keyLabel(bindings[slot]);
        btn.title = bindings[slot] ? 'Click to rebind' : 'Click to add a key';
        btn.addEventListener('click', () => {
          btn.textContent = '···';
          btn.classList.add('capturing');
          this.input.captureNextKey((code) => {
            if (code) {
              if (slot < bindings.length) bindings[slot] = code;
              else bindings.push(code);
              this.save();
            }
            render();
          });
        });
        slots.appendChild(btn);
        // allow clearing the secondary binding
        if (slot === 1 && bindings[1]) {
          const clear = document.createElement('button');
          clear.className = 'panel-keyclear';
          clear.textContent = '✕';
          clear.title = 'Remove this key';
          clear.addEventListener('click', () => {
            bindings.splice(1, 1);
            this.save();
            render();
          });
          slots.appendChild(clear);
        }
      }
    };
    render();
  }
}
