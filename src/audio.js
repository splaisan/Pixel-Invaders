/**
 * Pixel Invaders — WebAudio synthesis: no sound files, all generated
 * Created by Stephane Plaisance
 * Co-authored by Claude (Anthropic)
 * Version 1.1.0 — 2026-07-05
 */

const MARCH_NOTES = [130.8, 123.5, 110.0, 98.0]; // 4 descending bass notes

export class AudioEngine {
  constructor(config) {
    this.cfg = config;
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.ufoNodes = null;
    this.marchIndex = 0;
  }

  /* Create the context on first user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.cfg.muted ? 0 : this.cfg.volume;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate; // 1 s of white noise, reused for booms
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  get ready() {
    return !!this.ctx;
  }

  applyVolume() {
    if (this.master) {
      this.master.gain.value = this.cfg.muted ? 0 : this.cfg.volume;
    }
  }

  toggleMute() {
    this.cfg.muted = !this.cfg.muted;
    this.applyVolume();
    return this.cfg.muted;
  }

  tone({ type = 'square', freq = 440, endFreq = null, dur = 0.1, gain = 0.25, lowpass = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let node = osc;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, gain = 0.3, filterFreq = 1200, filterEnd = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t0);
    if (filterEnd !== null) f.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 10), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  playShoot() {
    this.tone({ type: 'sawtooth', freq: 1400, endFreq: 220, dur: 0.22, gain: 0.18 });
  }

  playInvaderBoom() {
    this.noise({ dur: 0.16, gain: 0.35, filterFreq: 2500, filterEnd: 300 });
  }

  playPlayerBoom() {
    this.noise({ dur: 0.8, gain: 0.45, filterFreq: 1200, filterEnd: 60 });
  }

  playUfoHit() {
    this.noise({ dur: 0.3, gain: 0.35, filterFreq: 3000, filterEnd: 200 });
    this.tone({ type: 'square', freq: 880, endFreq: 110, dur: 0.35, gain: 0.15 });
  }

  playExtraLife() {
    this.tone({ type: 'square', freq: 523, dur: 0.09, gain: 0.2 });
    setTimeout(() => this.tone({ type: 'square', freq: 659, dur: 0.09, gain: 0.2 }), 90);
    setTimeout(() => this.tone({ type: 'square', freq: 784, dur: 0.15, gain: 0.2 }), 180);
  }

  /* One heartbeat note per formation step — tempo tracks the march. */
  playMarchTick() {
    const freq = MARCH_NOTES[this.marchIndex % MARCH_NOTES.length];
    this.marchIndex++;
    this.tone({ type: 'square', freq, dur: 0.09, gain: 0.4, lowpass: 400 });
  }

  resetMarch() {
    this.marchIndex = 0;
  }

  /* Warbling tone looping while the UFO is on screen. */
  ufoStart() {
    if (!this.ctx || this.ufoNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 450;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 8;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const g = this.ctx.createGain();
    g.gain.value = 0.12;
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    lfo.start();
    this.ufoNodes = { osc, lfo, g };
  }

  ufoStop() {
    if (!this.ufoNodes) return;
    const { osc, lfo, g } = this.ufoNodes;
    try {
      osc.stop();
      lfo.stop();
    } catch { /* already stopped */ }
    g.disconnect();
    this.ufoNodes = null;
  }
}
