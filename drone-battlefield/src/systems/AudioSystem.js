import { bus } from '../core/EventBus.js';

/**
 * AudioSystem — all sounds synthesized via Web Audio API. No audio files.
 * AudioContext created on first user gesture (browser requirement).
 */
export class AudioSystem {
  constructor() {
    this.ctx          = null;
    this.masterVolume = 1.0;
    this.sfxVolume    = 0.8;
    this._masterGain  = null;
    this._sfxGain     = null;
    this._windNode    = null;
    this._windGain    = null;
    this._initialized = false;

    this._onImpact   = null;
    this._onGunshot  = null;
    this._onUIClick  = null;
    this._onWin      = null;
    this._onLoss     = null;
  }

  init() {
    // Wire bus listeners — audio plays immediately on event
    this._onImpact  = ({ type }) => {
      const t = (type || '').toLowerCase();
      if (t === 'bomb' || t === 'cluster') this.playExplosion(1);
      if (t === 'emp')    this.playEMP();
      if (t === 'cannon') this.playGunshot();
      if (t === 'missile') this.playExplosion(0.6);
    };
    this._onGunshot  = ({ type }) => {
      // Ground unit fire
      if (!type || type === 'flak') {
        this.playGunshot();
      }
    };
    this._onUIClick  = () => this.playUIClick();
    this._onWin      = () => this.playLevelWin();
    this._onLoss     = () => this.playLevelLoss();

    bus.on('weapon:impact', this._onImpact);
    bus.on('unit:fire',     this._onGunshot);
    bus.on('ui:click',      this._onUIClick);
    bus.on('level:ended',   ({ result }) => result === 'win' ? this.playLevelWin() : this.playLevelLoss());
  }

  /** Called by Game on first pointer interaction to unlock AudioContext. */
  resume() {
    this._ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  _ensureContext() {
    if (this._initialized) return;
    this.ctx         = new AudioContext();
    this._masterGain = this.ctx.createGain();
    this._sfxGain    = this.ctx.createGain();
    this._sfxGain.connect(this._masterGain);
    this._masterGain.connect(this.ctx.destination);
    this._masterGain.gain.value = this.masterVolume;
    this._sfxGain.gain.value    = this.sfxVolume;
    this._initialized = true;
  }

  _now() { return this.ctx.currentTime; }

  /** Create a gain node connected to sfxGain with an optional start value. */
  _gain(value = 1) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(this._sfxGain);
    return g;
  }

  /** Schedule a gain envelope: ramp up then exponential decay. */
  _adsr(gainNode, peak, attackTime, decayTime) {
    const t = this._now();
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attackTime + decayTime);
  }

  /** White noise buffer (1s, mono). */
  _noiseBuffer() {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Sound implementations ──────────────────────────────────────────────────

  /**
   * Explosion: low oscillator burst + filtered noise + rumble tail.
   * @param {number} intensity - 0→1 scale
   */
  playExplosion(intensity = 1) {
    if (!this._initialized) return;
    const t = this._now();
    const vol = intensity * 0.6;

    // Low oscillator thud
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);
    const oscGain = this._gain(0);
    osc.connect(oscGain);
    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(vol, t + 0.01);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.35);

    // Noise burst (filtered)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 200;
    const noiseGain = this._gain(0);
    noise.connect(hpf);
    hpf.connect(noiseGain);
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(vol * 0.4, t + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    noise.start(t);
    noise.stop(t + 0.12);

    // Low-pass rumble tail
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = this._noiseBuffer();
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 120;
    const rumbleGain = this._gain(0);
    rumble.connect(lpf);
    lpf.connect(rumbleGain);
    rumbleGain.gain.setValueAtTime(0, t + 0.05);
    rumbleGain.gain.linearRampToValueAtTime(vol * 0.3, t + 0.1);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    rumble.start(t + 0.05);
    rumble.stop(t + 0.7);
  }

  /** EMP: sine frequency sweep downward + crackle burst. */
  playEMP() {
    if (!this._initialized) return;
    const t = this._now();

    // Sine sweep 8000→200Hz over 0.5s
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(8000, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    const sweepGain = this._gain(0);
    osc.connect(sweepGain);
    sweepGain.gain.setValueAtTime(0, t);
    sweepGain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.52);

    // Crackle after sweep
    const crackle = this.ctx.createBufferSource();
    crackle.buffer = this._noiseBuffer();
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 3000;
    bpf.Q.value = 0.5;
    const crackleGain = this._gain(0);
    crackle.connect(bpf);
    bpf.connect(crackleGain);
    crackleGain.gain.setValueAtTime(0, t + 0.52);
    crackleGain.gain.linearRampToValueAtTime(0.3, t + 0.54);
    crackleGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    crackle.start(t + 0.52);
    crackle.stop(t + 0.67);
  }

  /** Gunshot: very short high-pass noise burst with pitch randomization. */
  playGunshot() {
    if (!this._initialized) return;
    const t = this._now();

    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1000 + Math.random() * 1500; // pitch randomization
    const g = this._gain(0);
    noise.connect(hpf);
    hpf.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
    noise.start(t);
    noise.stop(t + 0.025);
  }

  /** Impact: mid-frequency thud. */
  playImpact() {
    if (!this._initialized) return;
    const t = this._now();

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    const g = this._gain(0);
    osc.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  /** UI click: clean sine blip. */
  playUIClick() {
    if (!this._initialized) return;
    const t = this._now();

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    const g = this._gain(0);
    osc.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  /** Win: three ascending notes C-E-G. */
  playLevelWin() {
    if (!this._initialized) return;
    const t    = this._now();
    const notes = [261.63, 329.63, 392.00]; // C4, E4, G4
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this._gain(0);
      osc.connect(g);
      const start = t + i * 0.15;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.25, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  /** Loss: descending minor interval (A4→F4). */
  playLevelLoss() {
    if (!this._initialized) return;
    const t     = this._now();
    const notes = [440, 349.23]; // A4, F4
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this._gain(0);
      osc.connect(g);
      const start = t + i * 0.3;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.25, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }

  /** Near-miss whoosh: short high-velocity air rush. */
  playNearMiss() {
    if (!this._initialized) return;
    const t = this._now();

    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(3000, t);
    bpf.frequency.exponentialRampToValueAtTime(800, t + 0.08);
    bpf.Q.value = 1.5;
    const g = this._gain(0);
    noise.connect(bpf);
    bpf.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    noise.start(t);
    noise.stop(t + 0.12);
  }

  /** Wind: low-amplitude brown noise loop, barely perceptible. */
  startWind() {
    if (!this._initialized || this._windNode) return;

    // Brown noise approximation: integrate white noise
    const bufLen = this.ctx.sampleRate * 2;
    const buf    = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data   = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5; // normalize
    }

    this._windNode = this.ctx.createBufferSource();
    this._windNode.buffer = buf;
    this._windNode.loop   = true;
    this._windGain = this.ctx.createGain();
    this._windGain.gain.value = 0.04;
    this._windNode.connect(this._windGain);
    this._windGain.connect(this._sfxGain);
    this._windNode.start();
  }

  stopWind() {
    if (!this._windNode) return;
    this._windNode.stop();
    this._windNode.disconnect();
    this._windGain.disconnect();
    this._windNode = null;
    this._windGain = null;
  }

  setVolume(type, value) {
    if (type === 'master' && this._masterGain) {
      this.masterVolume = value;
      this._masterGain.gain.value = value;
    }
    if (type === 'sfx' && this._sfxGain) {
      this.sfxVolume = value;
      this._sfxGain.gain.value = value;
    }
  }

  destroy() {
    this.stopWind();
    bus.off('weapon:impact', this._onImpact);
    bus.off('unit:fire',     this._onGunshot);
    bus.off('ui:click',      this._onUIClick);
  }
}
