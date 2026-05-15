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
    this._onUnitDied = null;
  }

  init() {
    // weapon:impact — drone weapon hits
    this._onImpact = ({ type }) => {
      const t = (type || '').toLowerCase();
      if (t === 'bomb') this.playExplosion(1);
      if (t === 'emp')     this.playEMP();
      if (t === 'cannon')  this.playCannonPew();
      if (t === 'missile') this.playExplosion(0.6);
    };

    // weapon:dronefire — drone fires (launch sounds)
    this._onDroneFire = ({ type }) => {
      const t = (type || '').toLowerCase();
      if (t === 'missile') this.playRocketLaunch(0.5);
      if (t === 'emp')     this.playEMPCharge();
    };

    // unit:fire — enemy ground units shoot
    this._onGunshot = ({ type, unitType }) => {
      if (type === 'emp') { this.playFlak(0.4); return; } // EMP mortar lob
      switch (unitType) {
        case 'flakGun':   this.playFlak(0.7);          break;
        case 'samMedium': this.playRocketLaunch(0.55);  break;
        case 'samHeavy':  this.playRocketLaunch(0.75);  break;
        case 'titanTank': this.playTitanFire();          break;
        default:          this.playGunshot();            break; // soldier, tank, etc.
      }
    };

    this._onUIClick = () => this.playUIClick();

    this._onUnitDied = ({ unit }) => this.playUnitDeath(unit?.type);
    bus.on('weapon:impact',          this._onImpact);
    bus.on('weapon:dronefire',       this._onDroneFire);
    bus.on('unit:fire',              this._onGunshot);
    bus.on('unit:died',              this._onUnitDied);
    bus.on('ui:click',               this._onUIClick);
    bus.on('drone:dead',             () => this.playDroneDeath());
    bus.on('map:waveStart',          () => this.playWaveIncoming());
    bus.on('audio:bombDrop',         () => this.playBombDrop());
    bus.on('audio:clusterSub',       ({ index }) => this.playClusterSub(index));
    bus.on('audio:workshopPurchase', () => this.playWorkshopPurchase());
    bus.on('drone:killstreakReady',  () => this.playPowerReady('killstreak'));
    bus.on('drone:overchargeReady',  () => this.playPowerReady('overcharge'));
    bus.on('enemyDrone:approach',    () => this.playEnemyDroneApproach());
    bus.on('map:complete',           () => this.playMapComplete());
    bus.on('run:ended',              ({ cleared }) => cleared ? this.playRunWin() : this.playRunLoss());
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

  /** Drone cannon: bright high "pew" — clearly player-owned, distinct from enemy fire. */
  playCannonPew() {
    if (!this._initialized) return;
    const t = this._now();

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.045);
    const g = this._gain(0);
    osc.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  /** Flak gun metallic bang — short mid-pitch crack. */
  playFlak(vol = 0.7) {
    if (!this._initialized) return;
    const t = this._now();

    // Tonal thud: mid-freq oscillator drops fast
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
    const oscG = this._gain(0);
    osc.connect(oscG);
    oscG.gain.setValueAtTime(0, t);
    oscG.gain.linearRampToValueAtTime(vol * 0.35, t + 0.003);
    oscG.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.start(t); osc.stop(t + 0.08);

    // Metallic crack noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 2200;
    const ng = this._gain(0);
    noise.connect(hpf); hpf.connect(ng);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vol * 0.25, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    noise.start(t); noise.stop(t + 0.05);
  }

  /** Rocket/SAM launch: rising hiss + whoosh tail. vol 0→1. */
  playRocketLaunch(vol = 0.6) {
    if (!this._initialized) return;
    const t = this._now();

    // Rising hiss
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(400, t);
    bpf.frequency.exponentialRampToValueAtTime(2400, t + 0.12);
    bpf.Q.value = 1.2;
    const ng = this._gain(0);
    noise.connect(bpf); bpf.connect(ng);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vol * 0.45, t + 0.015);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    noise.start(t); noise.stop(t + 0.25);

    // Low ignition thud underneath
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const og = this._gain(0);
    osc.connect(og);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(vol * 0.3, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.start(t); osc.stop(t + 0.14);
  }

  /** EMP charge-up: rising whine before activation. */
  playEMPCharge() {
    if (!this._initialized) return;
    const t = this._now();

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(4000, t + 0.18);
    const g = this._gain(0);
    osc.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.start(t); osc.stop(t + 0.22);
  }

  /** Titan cannon: deep heavy boom — clearly a boss-class threat. */
  playTitanFire() {
    if (!this._initialized) return;
    const t = this._now();

    // Very low oscillator thud
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(18, t + 0.4);
    const og = this._gain(0);
    osc.connect(og);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.7, t + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.start(t); osc.stop(t + 0.5);

    // Mid noise crack on top
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 600;
    const ng = this._gain(0);
    noise.connect(lpf); lpf.connect(ng);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.5, t + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    noise.start(t); noise.stop(t + 0.2);
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

  /** Map cleared: C4+E4+G4 chord simultaneously. */
  playMapComplete() {
    if (!this._initialized) return;
    const t = this._now();
    [261.63, 329.63, 392.00].forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      const g = this._gain(0);
      osc.connect(g);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.4, t + 0.1);
      g.gain.setValueAtTime(0.4, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      osc.start(t); osc.stop(t + 0.85);
    });
  }

  /** Run won: C4+E4+G4 chord → G4+B4+D5 resolution. */
  playRunWin() {
    if (!this._initialized) return;
    const t = this._now();
    [261.63, 329.63, 392.00].forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      const g = this._gain(0);
      osc.connect(g);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.4, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.start(t); osc.stop(t + 0.35);
    });
    [392.00, 493.88, 587.33].forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      const g = this._gain(0);
      osc.connect(g);
      g.gain.setValueAtTime(0, t + 0.3);
      g.gain.linearRampToValueAtTime(0.5, t + 0.4);
      g.gain.setValueAtTime(0.5, t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.start(t + 0.3); osc.stop(t + 1.15);
    });
  }

  /** Run lost: G4 → Eb4 → C4 descending minor. */
  playRunLoss() {
    if (!this._initialized) return;
    const t = this._now();
    [[392.00, 0], [311.13, 0.2], [261.63, 0.4]].forEach(([freq, delay]) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      const g = this._gain(0);
      osc.connect(g);
      const s = t + delay;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.4, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + (delay === 0.4 ? 0.6 : 0.22));
      osc.start(s); osc.stop(s + (delay === 0.4 ? 0.65 : 0.25));
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

  /** Drone takes a hit: short dull thud. */
  playDroneHit() {
    if (!this._initialized) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = this._gain(0);
    osc.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.start(t); osc.stop(t + 0.15);
  }

  /** Unit death sound — varies by type. */
  playUnitDeath(unitType) {
    if (!this._initialized) return;
    const t = this._now();
    if (unitType === 'soldier' || unitType === 'rocket' || unitType === 'rocketInfantry') {
      // Infantry: bandpass noise burst + short sine thud
      const noise = this.ctx.createBufferSource();
      noise.buffer = this._noiseBuffer();
      const bpf = this.ctx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 1400; bpf.Q.value = 0.8;
      const ng = this._gain(0);
      noise.connect(bpf); bpf.connect(ng);
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(0.35, t + 0.002);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      noise.start(t); noise.stop(t + 0.03);

      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
      const og = this._gain(0);
      osc.connect(og);
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.2, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.start(t); osc.stop(t + 0.1);
    } else if (unitType === 'commander') {
      // Commander: same as infantry + descending sine tail + brief delay echo
      const noise = this.ctx.createBufferSource();
      noise.buffer = this._noiseBuffer();
      const bpf = this.ctx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 1400; bpf.Q.value = 0.8;
      const ng = this._gain(0);
      noise.connect(bpf); bpf.connect(ng);
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(0.35, t + 0.002);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      noise.start(t); noise.stop(t + 0.03);

      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.25);
      const og = this._gain(0);
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.value = 0.06;
      const fbGain = this.ctx.createGain();
      fbGain.gain.value = 0.2;
      osc.connect(og);
      og.connect(delay); delay.connect(fbGain); fbGain.connect(delay);
      delay.connect(this._sfxGain);
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.4, t + 0.005);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t); osc.stop(t + 0.28);
    } else if (unitType === 'enemyDrone') {
      // Drone: electric crackle
      const noise = this.ctx.createBufferSource();
      noise.buffer = this._noiseBuffer();
      const bpf = this.ctx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 2500; bpf.Q.value = 0.8;
      const g = this._gain(0);
      noise.connect(bpf); bpf.connect(g);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      noise.start(t); noise.stop(t + 0.1);
    } else {
      // Vehicle (tank, flakGun, SAM, titan): metallic clang + low thud
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      const og = this._gain(0);
      osc.connect(og);
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.28, t + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.start(t); osc.stop(t + 0.22);
    }
  }

  /** UI Confirm: two ascending notes for upgrade selection. */
  playUIConfirm() {
    if (!this._initialized) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    [523, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(this._sfxGain);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.13);
    });
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

  /** Drone player death: crack + electronic fail + rumble. */
  playDroneDeath() {
    if (!this._initialized) return;
    const t = this._now();

    // Layer 1 — initial crack
    const crack = this.ctx.createBufferSource();
    crack.buffer = this._noiseBuffer();
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 600;
    const cg = this._gain(0);
    crack.connect(lpf); lpf.connect(cg);
    cg.gain.setValueAtTime(0, t);
    cg.gain.linearRampToValueAtTime(1.0, t + 0.002);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    crack.start(t); crack.stop(t + 0.025);

    // Layer 2 — electronic death: sine sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.6);
    const og = this._gain(0);
    osc.connect(og);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.7, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.start(t); osc.stop(t + 0.65);

    // Layer 2b — crackle pulses
    for (let i = 0; i < 4; i++) {
      const pulse = this.ctx.createBufferSource();
      pulse.buffer = this._noiseBuffer();
      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass'; hpf.frequency.value = 2000;
      const pg = this._gain(0);
      pulse.connect(hpf); hpf.connect(pg);
      const ps = t + i * 0.05;
      pg.gain.setValueAtTime(0, ps);
      pg.gain.linearRampToValueAtTime(0.5, ps + 0.002);
      pg.gain.exponentialRampToValueAtTime(0.0001, ps + 0.015);
      pulse.start(ps); pulse.stop(ps + 0.02);
    }

    // Layer 3 — rumble tail
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = this._noiseBuffer();
    const rlpf = this.ctx.createBiquadFilter();
    rlpf.type = 'lowpass'; rlpf.frequency.value = 80;
    const rg = this._gain(0);
    rumble.connect(rlpf); rlpf.connect(rg);
    rg.gain.setValueAtTime(0, t + 0.05);
    rg.gain.linearRampToValueAtTime(0.5, t + 0.1);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    rumble.start(t + 0.05); rumble.stop(t + 0.95);
  }

  /** Wave incoming alarm: two low pulses + rising swell. */
  playWaveIncoming() {
    if (!this._initialized) return;
    const t = this._now();

    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 120;
      const g = this._gain(0);
      osc.connect(g);
      const s = t + i * 0.2;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.6, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.15);
      osc.start(s); osc.stop(s + 0.17);
    }

    // Rising noise swell after pulses
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(200, t + 0.4);
    bpf.frequency.exponentialRampToValueAtTime(800, t + 0.7);
    bpf.Q.value = 1.2;
    const ng = this._gain(0);
    noise.connect(bpf); bpf.connect(ng);
    ng.gain.setValueAtTime(0, t + 0.4);
    ng.gain.linearRampToValueAtTime(0.4, t + 0.55);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    noise.start(t + 0.4); noise.stop(t + 0.75);
  }

  /** Falling bomb whistle: descending sine sweep with reverb tail. */
  playBombDrop() {
    if (!this._initialized) return;
    const t = this._now();

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.28);

    const delay = this.ctx.createDelay(0.5);
    delay.delayTime.value = 0.04;
    const fbGain = this.ctx.createGain();
    fbGain.gain.value = 0.25;
    const dryGain = this._gain(0);
    const wetGain = this.ctx.createGain();
    wetGain.gain.value = 0.3;
    wetGain.connect(this._sfxGain);

    osc.connect(dryGain);
    osc.connect(delay);
    delay.connect(fbGain); fbGain.connect(delay);
    delay.connect(wetGain);

    const mid = t + 0.14;
    dryGain.gain.setValueAtTime(0, t);
    dryGain.gain.linearRampToValueAtTime(0.7, mid);
    dryGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.start(t); osc.stop(t + 0.30);
  }

  /** Enemy drone approach: rising mechanical buzz with tremolo. */
  playEnemyDroneApproach() {
    if (!this._initialized || this._droneApproachPlaying) return;
    this._droneApproachPlaying = true;
    const t = this._now();
    const duration = 0.8;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + duration);

    // Tremolo LFO
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 18;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain);

    const g = this.ctx.createGain();
    g.gain.value = 0;
    lfoGain.connect(g.gain);
    osc.connect(g);
    g.connect(this._sfxGain);

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.15);
    g.gain.setValueAtTime(0.5, t + duration - 0.15);
    g.gain.linearRampToValueAtTime(0, t + duration);

    osc.start(t); lfo.start(t);
    osc.stop(t + duration); lfo.stop(t + duration);
    setTimeout(() => { this._droneApproachPlaying = false; }, duration * 1000 + 100);
  }

  /** Power-up ready chime: aggressive (killstreak) or powerful (overcharge). */
  playPowerReady(type) {
    if (!this._initialized) return;
    const t = this._now();
    const notes = type === 'killstreak'
      ? [659.25, 783.99]           // E5, G5
      : [523.25, 659.25, 783.99];  // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      const g = this._gain(0);
      osc.connect(g);
      const s = t + i * 0.1;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.5, s + 0.1);
      g.gain.setValueAtTime(0.5, s + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.3);
      osc.start(s); osc.stop(s + 0.32);
    });
  }

  /** Cluster sub-impact: short light crunch with pitch variation per index. */
  playClusterSub(index = 0) {
    if (!this._initialized) return;
    const t = this._now();

    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 1200;
    const ng = this._gain(0);
    noise.connect(lpf); lpf.connect(ng);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.45, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
    noise.start(t); noise.stop(t + 0.02);

    const freq = 95 + index * 6;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = freq;
    const og = this._gain(0);
    osc.connect(og);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.3, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.start(t); osc.stop(t + 0.2);
  }

  /** Workshop purchase: coin clink — two bright ascending notes. */
  playWorkshopPurchase() {
    if (!this._initialized) return;
    const t = this._now();
    [[523.25, 0], [659.25, 0.06]].forEach(([freq, delay]) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      const g = this._gain(0);
      osc.connect(g);
      const s = t + delay;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.5, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.14);
      osc.start(s); osc.stop(s + 0.15);
    });
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
    bus.off('weapon:impact',          this._onImpact);
    bus.off('weapon:dronefire',       this._onDroneFire);
    bus.off('unit:fire',              this._onGunshot);
    bus.off('unit:died',              this._onUnitDied);
    bus.off('ui:click',               this._onUIClick);
  }
}
