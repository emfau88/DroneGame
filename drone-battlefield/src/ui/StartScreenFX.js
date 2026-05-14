import * as THREE from 'three';
import { MAP_TEMPLATES } from '../data/mapTemplates.js';
import { t, getLang, setLang } from '../core/i18n.js';

const QUIPS_EN = [
  '404: Enemy not found',
  'Calculating overkill...',
  'Low battery... just kidding',
  'Friendly fire? Never heard of it',
  'GPS: recalculating... recalculating...',
  'Coffee break in T-minus 3s',
  'I am not a weapon. I am a lifestyle.',
  'Stealth mode: ON\n(Nobody tell the explosions)',
  'Error: Too much fun detected',
  'Target acquired. Also hungry.',
  'Running on diesel and determination',
  'Have you tried turning the war off and on again?',
];
const QUIPS_DE = [
  '404: Feind nicht gefunden',
  'Berechne Überkillmodus...',
  'Niedriger Akku... nur ein Witz',
  'Freundschaftsbeschuss? Kenne ich nicht.',
  'GPS: Neuberechnung... Neuberechnung...',
  'Kaffeepause in 3... 2... 1...',
  'Ich bin keine Waffe. Ich bin ein Lebensstil.',
  'Tarnmodus: AN\n(Die Explosionen wissen es nicht)',
  'Fehler: Zu viel Spaß erkannt',
  'Ziel erfasst. Auch hungrig.',
  'Läuft mit Diesel und Entschlossenheit',
  'Haben Sie versucht, den Krieg neu zu starten?',
];

export class StartScreenFX {
  constructor() {
    this._renderer = null;
    this._scene    = null;
    this._camera   = null;
    this._drone    = null;
    this._rotors   = [];
    this._raf      = null;

    // Flight state — slow random drift
    this._pos      = new THREE.Vector2(0, 0);
    this._vel      = new THREE.Vector2(0.6, 0.3);
    this._targetVel= new THREE.Vector2(0.6, 0.3);
    this._tiltZ    = 0;
    this._tiltX    = 0;
    this._velChangeTimer = 0;

    // Manoeuvre state
    this._manoeuvreTimer  = this._randManoeuvreDelay();
    this._manoeuvre       = null;
    this._manoeuvrePhase  = 0;

    // Quip state — first quip after 12–18s, stays visible 9s, repeats every 30–50s
    this._quipTimer   = 12 + Math.random() * 6;
    this._quipEl      = null;
    this._quipVisible = false;
    this._quipFadeTimer = 0;

    this._particles = []; // DOM particle elements
  }

  init() {
    this._initCanvas();
    this._buildDrone();
    this._buildParticles();
    this._buildQuipBubble();
    this._buildMapPath();
    this._buildLangToggle();
    this._loop();

    document.addEventListener('langChanged', () => {
      this._refreshStaticText();
      this._rebuildMapPath();
    });
    // Set initial title based on saved language
    this._refreshStaticText();
  }

  _initCanvas() {
    const canvas = document.getElementById('drone-preview-canvas');
    if (!canvas) return;

    this._scene  = new THREE.Scene();
    const w = canvas.parentElement?.clientWidth || 600;
    const h = 220;

    this._camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    this._camera.position.set(0, 1.2, 7);
    this._camera.lookAt(0, 0, 0);

    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.setSize(w, h, false);
    this._renderer.setClearColor(0x000000, 0);

    const hemi = new THREE.HemisphereLight(0x88BBFF, 0x334455, 1.2);
    this._scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xFFFFFF, 1.4);
    sun.position.set(-3, 5, 4);
    this._scene.add(sun);

    window.addEventListener('resize', () => {
      const nw = canvas.parentElement?.clientWidth || 600;
      this._camera.aspect = nw / 220;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(nw, 220, false);
    });
  }

  _buildDrone() {
    const group = new THREE.Group();
    const bodyMat   = new THREE.MeshStandardMaterial({ color: 0x1A1A2A, roughness: 0.55, metalness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x2A2A3E, roughness: 0.45, metalness: 0.7 });
    const motorMat  = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.4,  metalness: 0.8 });
    const rotorMat  = new THREE.MeshStandardMaterial({ color: 0x333348, roughness: 0.5,  metalness: 0.3, transparent: true, opacity: 0.82 });
    const camMat    = new THREE.MeshStandardMaterial({ color: 0x0A0A14, roughness: 0.1,  metalness: 0.9 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.18, 10), bodyMat);
    group.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 0.10, 10), accentMat);
    top.position.y = 0.14; group.add(top);
    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), camMat);
    cam.position.y = -0.16; group.add(cam);

    const ledF = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), new THREE.MeshBasicMaterial({ color: 0x44AAFF }));
    ledF.position.set(0, 0.05, -0.38); group.add(ledF);
    const ledB = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), new THREE.MeshBasicMaterial({ color: 0xFF3322 }));
    ledB.position.set(0, 0.05, 0.38); group.add(ledB);

    for (const angle of [45, -45, 135, -135]) {
      const rad  = THREE.MathUtils.degToRad(angle);
      const tipX = Math.cos(rad) * 0.72;
      const tipZ = Math.sin(rad) * 0.72;

      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.09), accentMat);
      arm.rotation.y = rad;
      arm.position.set(tipX * 0.5, 0, tipZ * 0.5);
      group.add(arm);

      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 8), motorMat);
      motor.position.set(tipX, 0, tipZ); group.add(motor);

      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.025, 16), rotorMat);
      rotor.position.set(tipX, 0.10, tipZ); group.add(rotor);
      this._rotors.push(rotor);
    }

    group.scale.setScalar(1.5);
    this._drone = group;
    this._scene.add(group);
  }

  _buildQuipBubble() {
    const el = document.createElement('div');
    el.id = 'drone-quip';
    el.style.cssText = `
      position:absolute; top:8px; left:50%; transform:translateX(-50%);
      background:rgba(20,28,44,0.92); border:1px solid rgba(41,123,255,0.5);
      border-radius:8px; padding:6px 14px; font-size:.78rem; letter-spacing:.05em;
      color:rgba(255,255,255,.88); pointer-events:none; white-space:pre-line;
      text-align:center; opacity:0; transition:opacity .4s;
      max-width:260px; line-height:1.4;
    `;
    const wrap = document.getElementById('drone-canvas-wrap');
    if (wrap) wrap.appendChild(el);
    this._quipEl = el;
  }

  _showQuip() {
    if (!this._quipEl) return;
    const quips = getLang() === 'de' ? QUIPS_DE : QUIPS_EN;
    this._quipEl.textContent = quips[Math.floor(Math.random() * quips.length)];
    this._quipEl.style.opacity = '1';
    this._quipVisible  = true;
    this._quipFadeTimer = 9.0;
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    const dt = 0.016;

    this._updateFlight(dt);
    this._updateQuip(dt);
    this._renderer?.render(this._scene, this._camera);
  }

  _updateFlight(dt) {
    // Slowly drift toward a new random target velocity every few seconds
    this._velChangeTimer -= dt;
    if (this._velChangeTimer <= 0) {
      this._velChangeTimer = 2.5 + Math.random() * 3;
      const spd = 0.5 + Math.random() * 0.8;
      const angle = Math.random() * Math.PI * 2;
      this._targetVel.set(Math.cos(angle) * spd, Math.sin(angle) * spd * 0.35);
    }

    // Manoeuvre override
    this._manoeuvreTimer -= dt;
    if (this._manoeuvreTimer <= 0 && !this._manoeuvre) {
      this._startManoeuvre();
    }

    if (this._manoeuvre) {
      this._tickManoeuvre(dt);
    } else {
      // Normal drift
      this._vel.lerp(this._targetVel, dt * 0.8);
      this._pos.x += this._vel.x * dt;
      this._pos.y += this._vel.y * dt;

      // Soft bounce at edges
      const limX = 3.5, limY = 0.7;
      if (Math.abs(this._pos.x) > limX) {
        this._vel.x *= -0.8;
        this._pos.x = Math.sign(this._pos.x) * limX;
      }
      if (Math.abs(this._pos.y) > limY) {
        this._vel.y *= -0.8;
        this._pos.y = Math.sign(this._pos.y) * limY;
      }

      // Tilt based on velocity
      const targetTiltZ = -this._vel.x * 0.18;
      const targetTiltX =  this._vel.y * 0.10;
      this._tiltZ += (targetTiltZ - this._tiltZ) * dt * 3;
      this._tiltX += (targetTiltX - this._tiltX) * dt * 3;
    }

    const bob = Math.sin(Date.now() * 0.0018) * 0.06;

    if (this._drone) {
      this._drone.position.x = this._pos.x;
      this._drone.position.y = this._pos.y + bob;
      this._drone.rotation.z = this._tiltZ;
      this._drone.rotation.x = this._tiltX;
      this._drone.rotation.y += dt * 0.3;
    }

    for (const r of this._rotors) r.rotation.y += dt * 18;
  }

  _startManoeuvre() {
    const types = ['wiggle', 'spin', 'pause'];
    this._manoeuvre = types[Math.floor(Math.random() * types.length)];
    this._manoeuvrePhase = 0;
  }

  _tickManoeuvre(dt) {
    this._manoeuvrePhase += dt;

    if (this._manoeuvre === 'wiggle') {
      // Rapid left-right shake
      this._tiltZ = Math.sin(this._manoeuvrePhase * 18) * 0.45;
      this._drone.position.x = this._pos.x + Math.sin(this._manoeuvrePhase * 18) * 0.3;
      if (this._manoeuvrePhase > 0.9) this._endManoeuvre();

    } else if (this._manoeuvre === 'spin') {
      // Full Y-axis spin
      if (this._drone) this._drone.rotation.y += dt * 8;
      if (this._manoeuvrePhase > 0.85) this._endManoeuvre();

    } else if (this._manoeuvre === 'pause') {
      // Stop and hover, show quip
      this._vel.set(0, 0);
      this._tiltZ += (0 - this._tiltZ) * dt * 4;
      if (this._manoeuvrePhase > 0.3 && !this._quipVisible) this._showQuip();
      if (this._manoeuvrePhase > 7.5) this._endManoeuvre();
    }
  }

  _endManoeuvre() {
    this._manoeuvre = null;
    this._manoeuvreTimer = this._randManoeuvreDelay();
  }

  _randManoeuvreDelay() { return 22 + Math.random() * 18; }

  _updateQuip(dt) {
    if (!this._quipEl) return;
    if (this._quipVisible) {
      this._quipFadeTimer -= dt;
      if (this._quipFadeTimer <= 0) {
        this._quipEl.style.opacity = '0';
        this._quipVisible = false;
      }
    }
    // Independent quip timer (separate from manoeuvre pauses)
    this._quipTimer -= dt;
    if (this._quipTimer <= 0 && !this._quipVisible) {
      this._quipTimer = 30 + Math.random() * 20;
      this._showQuip();
    }
  }

  _buildMapPath() {
    const row = document.getElementById('map-path-row');
    if (!row) return;
    row.innerHTML = '';

    const icons = { bridge: '🌉', desert: '🏜️', forest: '🌲', urban: '🏙️' };

    MAP_TEMPLATES.forEach((tpl, i) => {
      if (i > 0) {
        const conn = document.createElement('div');
        conn.className = 'map-connector';
        row.appendChild(conn);
      }
      const node = document.createElement('div');
      node.className = 'map-node';

      const circle = document.createElement('div');
      circle.className = 'map-node-circle';
      circle.title = `${t('map.' + tpl.id)} — ★${'★'.repeat(Math.min(tpl.difficulty - 1, 4))}`;
      circle.textContent = icons[tpl.setting] ?? '🎯';

      const label = document.createElement('div');
      label.className = 'map-node-name';
      label.textContent = t('map.' + tpl.id);

      node.appendChild(circle);
      node.appendChild(label);
      row.appendChild(node);
    });
  }

  _rebuildMapPath() { this._buildMapPath(); }

  _refreshStaticText() {
    const subtitle = document.querySelector('#screen-start p[data-i18n="start.subtitle"]');
    if (subtitle) subtitle.textContent = t('start.subtitle');
    const btn = document.querySelector('#btn-play');
    if (btn) btn.textContent = t('start.newRun');
    // Update title for language
    const titleEl = document.getElementById('start-title');
    if (titleEl) titleEl.textContent = getLang() === 'de' ? 'Drohnenwahn' : 'Drone Strike';
  }

  _buildLangToggle() {
    const wrap = document.getElementById('lang-toggle-wrap');
    if (!wrap) return;

    const renderToggle = () => {
      wrap.innerHTML = '';
      const current = getLang();
      for (const [code, flag] of [['en', '🇬🇧'], ['de', '🇩🇪']]) {
        const btn = document.createElement('button');
        btn.className = 'lang-btn' + (current === code ? ' active' : '');
        btn.title = code === 'en' ? 'English' : 'Deutsch';
        btn.textContent = flag;
        btn.addEventListener('pointerdown', () => { setLang(code); renderToggle(); });
        wrap.appendChild(btn);
      }
    };
    renderToggle();

    document.addEventListener('langChanged', () => renderToggle());
  }

  _buildParticles() {
    const wrap = document.getElementById('drone-canvas-wrap');
    if (!wrap) return;
    // 12 small slow-drifting particles for depth
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div');
      el.className = 'start-particle';
      const size = 1.5 + Math.random() * 2.5;
      const duration = 8 + Math.random() * 14;
      const delay    = -(Math.random() * duration);
      const drift    = (Math.random() - 0.5) * 40;
      el.style.cssText = `
        width:${size}px; height:${size}px;
        left:${Math.random() * 100}%;
        bottom:${Math.random() * 60}%;
        --px-drift:${drift}px;
        animation-duration:${duration}s;
        animation-delay:${delay}s;
        opacity:0;
      `;
      wrap.appendChild(el);
      this._particles.push(el);
    }
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._renderer?.dispose();
    for (const p of this._particles) p.remove();
    this._particles = [];
  }
}
