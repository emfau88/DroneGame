import * as THREE from 'three';

const WEAPON_STATS = {
  missile: { damage: 38, cooldown: '1.8s', range: '22', type: 'Homing' },
  bomb:    { damage: 55, cooldown: '3.5s', range: 'Below drone', type: 'Area' },
  emp:     { damage: 0,  cooldown: '8.0s', range: '7.5', type: 'Stun AoE' },
  cluster: { damage: 22, cooldown: '12s',  range: 'Below drone', type: 'Multi-hit' },
};

/**
 * DroneShowcase — 3D drone + weapon preview for Workshop/Loadout screens.
 * Modes:
 *   'drone'  — drone rotates slowly, selected weapons float beside it
 *   'weapon' — single weapon shown large, rotating; drone hidden
 */
export class DroneShowcase {
  constructor() {
    this._renderer    = null;
    this._scene       = null;
    this._camera      = null;
    this._droneGroup  = null;
    this._weaponGroup = null;
    this._previewGroup = null; // single large weapon preview
    this._rotors      = [];
    this._t           = 0;
    this._rafId       = null;
    this._active      = false;
    this._canvas      = null;
    this._labelWrap   = null;
    this._weaponLabels = [];

    this._mode        = 'drone'; // 'drone' | 'weapon'
    this._previewType = null;

    // Info panel DOM (injected into labelWrap)
    this._infoPanel = null;
  }

  init(canvasId, labelWrapperId) {
    this._canvas    = document.getElementById(canvasId);
    this._labelWrap = document.getElementById(labelWrapperId);
    if (!this._canvas) return;

    this._renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setClearColor(0x000000, 0);
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.2;

    this._scene  = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this._camera.position.set(0, 3, 8);
    this._camera.lookAt(0, 0, 0);

    // Lighting
    this._scene.add(new THREE.AmbientLight(0x8899BB, 0.6));
    const sun = new THREE.DirectionalLight(0xFFEECC, 1.8);
    sun.position.set(4, 8, 5);
    this._scene.add(sun);
    const fill = new THREE.DirectionalLight(0xAABBFF, 0.4);
    fill.position.set(-5, 2, -3);
    this._scene.add(fill);
    const rim = new THREE.DirectionalLight(0xFFFFFF, 0.25);
    rim.position.set(0, -3, -5);
    this._scene.add(rim);

    this._buildDrone();
    this._weaponGroup  = new THREE.Group();
    this._previewGroup = new THREE.Group();
    this._scene.add(this._weaponGroup);
    this._scene.add(this._previewGroup);

    // Info panel (hidden by default)
    if (this._labelWrap) {
      this._labelWrap.style.pointerEvents = 'none'; // default
      this._infoPanel = document.createElement('div');
      this._infoPanel.style.cssText = `
        position:absolute; bottom:0; left:0; right:0;
        background:rgba(9,16,24,.90); border-top:1px solid rgba(255,255,255,.12);
        padding:8px 12px; display:none; flex-direction:column; gap:3px;
        pointer-events:auto;
      `;
      this._labelWrap.appendChild(this._infoPanel);

      // Back button
      const backBtn = document.createElement('button');
      backBtn.textContent = '← Back';
      backBtn.style.cssText = `
        position:absolute; top:8px; left:10px;
        background:none; border:none; color:rgba(255,255,255,.5);
        font-family:inherit; font-size:.65rem; letter-spacing:.08em;
        text-transform:uppercase; cursor:pointer; padding:2px 6px;
      `;
      backBtn.style.pointerEvents = 'auto';
      backBtn.addEventListener('pointerdown', () => this.showDrone());
      this._labelWrap.appendChild(backBtn);
      this._backBtn = backBtn;
      this._backBtn.style.display = 'none';
    }

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    if (!this._canvas || !this._renderer || !this._camera) return;
    const w = this._canvas.clientWidth  || this._canvas.parentElement?.clientWidth  || 280;
    const h = this._canvas.clientHeight || this._canvas.parentElement?.clientHeight || 400;
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }

  _buildDrone(modelId = 'wasp') {
    if (this._droneGroup) {
      this._scene.remove(this._droneGroup);
      this._rotors = [];
    }
    this._droneGroup = new THREE.Group();
    this._scene.add(this._droneGroup);

    if (modelId === 'hornet')      this._buildHornet(this._droneGroup);
    else if (modelId === 'reaper') this._buildReaper(this._droneGroup);
    else                           this._buildWasp(this._droneGroup);
  }

  _buildWasp(g) {
    const S = 2.8;
    const bodyMat   = new THREE.MeshStandardMaterial({ color: 0x1A1A2A, roughness: 0.55, metalness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x2A2A3E, roughness: 0.45, metalness: 0.7 });
    const motorMat  = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.4,  metalness: 0.8 });
    const rotorMat  = new THREE.MeshStandardMaterial({ color: 0x333348, roughness: 0.5,  metalness: 0.3, transparent: true, opacity: 0.82 });
    const camMat    = new THREE.MeshStandardMaterial({ color: 0x0A0A14, roughness: 0.1,  metalness: 0.9 });

    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.38*S, 0.44*S, 0.18*S, 10), bodyMat));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22*S, 0.38*S, 0.10*S, 10), accentMat);
    top.position.y = 0.14*S; g.add(top);
    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.10*S, 8, 6), camMat);
    cam.position.y = -0.16*S; g.add(cam);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.035*S, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.7 }));
    glint.position.set(0, -0.17*S, 0.06*S); g.add(glint);

    const ledF = new THREE.Mesh(new THREE.SphereGeometry(0.045*S, 5, 4), new THREE.MeshBasicMaterial({ color: 0x44AAFF }));
    ledF.position.set(0, 0.05*S, -0.38*S); g.add(ledF);
    const ledB = new THREE.Mesh(new THREE.SphereGeometry(0.045*S, 5, 4), new THREE.MeshBasicMaterial({ color: 0xFF3322 }));
    ledB.position.set(0, 0.05*S, 0.38*S); g.add(ledB);
    const glowBlue = new THREE.PointLight(0x44AAFF, 0.7, 2.2*S);
    glowBlue.position.copy(ledF.position); g.add(glowBlue);
    const glowRed = new THREE.PointLight(0xFF3322, 0.7, 2.2*S);
    glowRed.position.copy(ledB.position); g.add(glowRed);

    for (const angle of [45, -45, 135, -135]) {
      const rad = THREE.MathUtils.degToRad(angle);
      const tipX = Math.cos(rad) * 0.72*S;
      const tipZ = Math.sin(rad) * 0.72*S;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0*S, 0.07*S, 0.09*S), accentMat.clone());
      arm.rotation.y = rad; arm.position.set(tipX*0.5, 0, tipZ*0.5); g.add(arm);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.11*S, 0.11*S, 0.14*S, 8), motorMat.clone());
      motor.position.set(tipX, 0, tipZ); g.add(motor);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.32*S, 0.32*S, 0.025*S, 16), rotorMat.clone());
      rotor.position.set(tipX, 0.10*S, tipZ); g.add(rotor);
      this._rotors.push(rotor);
    }
  }

  // Hornet — wide hexagonal body, 6 arms, yellow-orange accents, big rotors
  _buildHornet(g) {
    const S = 2.8;
    const bodyMat   = new THREE.MeshStandardMaterial({ color: 0x2A1A00, roughness: 0.5, metalness: 0.55 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xCC6600, roughness: 0.35, metalness: 0.7,
      emissive: 0x331100, emissiveIntensity: 0.4 });
    const motorMat  = new THREE.MeshStandardMaterial({ color: 0x1A1000, roughness: 0.4, metalness: 0.8 });
    const rotorMat  = new THREE.MeshStandardMaterial({ color: 0x553300, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0.80 });
    const armorMat  = new THREE.MeshStandardMaterial({ color: 0x3A2800, roughness: 0.6, metalness: 0.5 });

    // Wide flat body
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.52*S, 0.58*S, 0.22*S, 12), bodyMat));
    // Armored top dome
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.30*S, 0.52*S, 0.14*S, 12), armorMat);
    dome.position.y = 0.18*S; g.add(dome);
    // Armored skirt plates (6 around)
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.28*S, 0.10*S, 0.08*S), accentMat.clone());
      plate.position.set(Math.cos(ang)*0.55*S, -0.08*S, Math.sin(ang)*0.55*S);
      plate.rotation.y = ang; g.add(plate);
    }
    // Camera
    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.12*S, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x0A0800, roughness: 0.1, metalness: 0.9 }));
    cam.position.y = -0.20*S; g.add(cam);

    // Orange LEDs
    const ledF = new THREE.Mesh(new THREE.SphereGeometry(0.055*S, 5, 4), new THREE.MeshBasicMaterial({ color: 0xFF8800 }));
    ledF.position.set(0, 0.05*S, -0.50*S); g.add(ledF);
    const ledB = new THREE.Mesh(new THREE.SphereGeometry(0.055*S, 5, 4), new THREE.MeshBasicMaterial({ color: 0xFF4400 }));
    ledB.position.set(0, 0.05*S,  0.50*S); g.add(ledB);
    const hGlowF = new THREE.PointLight(0xFF8800, 1.0, 2.8*S);
    hGlowF.position.copy(ledF.position); g.add(hGlowF);
    const hGlowB = new THREE.PointLight(0xFF4400, 1.0, 2.8*S);
    hGlowB.position.copy(ledB.position); g.add(hGlowB);

    // 6 arms at 60° intervals
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const tipX = Math.cos(ang) * 0.82*S;
      const tipZ = Math.sin(ang) * 0.82*S;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95*S, 0.08*S, 0.10*S), accentMat.clone());
      arm.rotation.y = ang; arm.position.set(tipX*0.5, 0, tipZ*0.5); g.add(arm);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.13*S, 0.13*S, 0.16*S, 8), motorMat.clone());
      motor.position.set(tipX, 0, tipZ); g.add(motor);
      // Larger rotors
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.38*S, 0.38*S, 0.025*S, 16), rotorMat.clone());
      rotor.position.set(tipX, 0.12*S, tipZ); g.add(rotor);
      this._rotors.push(rotor);
    }
  }

  // Reaper — sleek X-frame stealth body, turbine exhausts, purple/red LEDs, dual cannon barrels
  _buildReaper(g) {
    const S = 2.8;
    const bodyMat    = new THREE.MeshStandardMaterial({ color: 0x0C0A14, roughness: 0.3, metalness: 0.85 });
    const accentMat  = new THREE.MeshStandardMaterial({ color: 0x1A0A2A, roughness: 0.25, metalness: 0.9 });
    const glowMat    = new THREE.MeshStandardMaterial({ color: 0x8800FF, roughness: 0.1, metalness: 1.0,
      emissive: 0x4400AA, emissiveIntensity: 1.2 });
    const redGlowMat = new THREE.MeshStandardMaterial({ color: 0xFF0022, roughness: 0.1, metalness: 1.0,
      emissive: 0x880011, emissiveIntensity: 1.0 });
    const turbineMat = new THREE.MeshStandardMaterial({ color: 0x080610, roughness: 0.2, metalness: 0.95 });

    // Slim angular body (flattened diamond shape)
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28*S, 0.34*S, 0.14*S, 8), bodyMat));
    // Angled top fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08*S, 0.28*S, 0.50*S), accentMat);
    fin.position.y = 0.18*S; g.add(fin);
    // Camera / sensor pod
    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.09*S, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xFF0022, roughness: 0.05, metalness: 1.0,
        emissive: 0x880011, emissiveIntensity: 1.5 }));
    cam.position.set(0, -0.14*S, -0.28*S); g.add(cam);
    const rCamGlow = new THREE.PointLight(0xFF0022, 1.2, 2*S);
    rCamGlow.position.copy(cam.position); g.add(rCamGlow);

    // Dual cannon barrels sticking forward
    for (const xOff of [-0.18*S, 0.18*S]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04*S, 0.04*S, 0.55*S, 6), accentMat.clone());
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(xOff, -0.04*S, -0.52*S); g.add(barrel);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.055*S, 0.04*S, 0.06*S, 6), glowMat.clone());
      tip.rotation.x = Math.PI / 2;
      tip.position.set(xOff, -0.04*S, -0.80*S); g.add(tip);
    }

    // 4 X-shaped arms (thinner, longer, angled)
    for (const angle of [35, -35, 145, -145]) {
      const rad  = THREE.MathUtils.degToRad(angle);
      const tipX = Math.cos(rad) * 0.88*S;
      const tipZ = Math.sin(rad) * 0.88*S;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.15*S, 0.055*S, 0.07*S), accentMat.clone());
      arm.rotation.y = rad; arm.position.set(tipX*0.5, 0, tipZ*0.5); g.add(arm);

      // Turbine housing (cylinder, no visible rotors — stealth turbines)
      const turbine = new THREE.Mesh(new THREE.CylinderGeometry(0.16*S, 0.14*S, 0.22*S, 10), turbineMat.clone());
      turbine.position.set(tipX, 0, tipZ); g.add(turbine);
      // Turbine glow ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14*S, 0.022*S, 6, 20), glowMat.clone());
      ring.position.set(tipX, 0.05*S, tipZ); g.add(ring);
      // Purple exhaust glow light
      const glow = new THREE.PointLight(0x8800FF, 0.6, 2.5*S);
      glow.position.set(tipX, -0.12*S, tipZ); g.add(glow);

      // Thin spinning disk inside turbine (acts as "rotor")
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.12*S, 0.12*S, 0.015*S, 12),
        new THREE.MeshStandardMaterial({ color: 0x220044, roughness: 0.2, metalness: 0.9, transparent: true, opacity: 0.7 }));
      rotor.position.set(tipX, 0.05*S, tipZ); g.add(rotor);
      this._rotors.push(rotor);
    }

    // Purple LED strip along body
    const ledPurple = new THREE.Mesh(new THREE.BoxGeometry(0.50*S, 0.03*S, 0.05*S), glowMat.clone());
    ledPurple.position.set(0, 0.08*S, 0); g.add(ledPurple);
    const rBodyGlow = new THREE.PointLight(0x8800FF, 1.5, 3*S);
    rBodyGlow.position.set(0, 0.08*S, 0); g.add(rBodyGlow);
  }

  /** Rebuild the drone 3D model for the given model id ('wasp'|'hornet'|'reaper'). */
  setDroneModel(modelId) {
    this._buildDrone(modelId);
  }

  /** Show drone + floating selected weapons. */
  setWeapons(slot1, slot2) {
    if (!this._weaponGroup) return;
    this._weaponGroup.clear();
    this._clearLabels();

    const S = 2.8;
    const weapons = [slot1, slot2].filter(Boolean);

    weapons.forEach((type, i) => {
      const xOff = weapons.length === 1 ? 5.5 : (i === 0 ? -5 : 5);
      const mesh = this._buildWeaponMesh(type, S * 0.7);
      if (!mesh) return;
      mesh.position.set(xOff, -0.8, 0);
      this._weaponGroup.add(mesh);

      if (this._labelWrap) {
        const label = document.createElement('div');
        label.className = 'showcase-weapon-label';
        label.textContent = type.toUpperCase();
        label.style.cssText = `
          position:absolute; bottom:${this._infoPanel ? '50px' : '10px'};
          ${weapons.length === 1 ? 'right:12px' : (i === 0 ? 'left:12px' : 'right:12px')};
          font-size:.6rem; font-weight:700; letter-spacing:.12em;
          text-transform:uppercase; color:#FFE28A;
          text-shadow:0 1px 4px rgba(0,0,0,.9); pointer-events:none;
        `;
        this._labelWrap.appendChild(label);
        this._weaponLabels.push(label);
      }
    });
  }

  /** Switch to large single-weapon preview mode. */
  showWeaponPreview(type) {
    if (!this._previewGroup) return;
    this._mode        = 'weapon';
    this._previewType = type;
    this._previewGroup.clear();

    const S = 4.5;
    const mesh = this._buildWeaponMesh(type, S);
    if (mesh) {
      this._previewGroup.add(mesh);
    }

    // Slide drone + weapon group out
    this._droneGroup.visible   = false;
    this._weaponGroup.visible  = false;

    // Camera closer for weapon
    this._camera.position.set(0, 2, 7);
    this._camera.lookAt(0, 0, 0);

    // Show info panel
    this._showInfoPanel(type);
    if (this._backBtn) this._backBtn.style.display = 'block';
  }

  /** Return to drone view. */
  showDrone() {
    this._mode = 'drone';
    this._previewGroup.clear();
    this._droneGroup.visible  = true;
    this._weaponGroup.visible = true;

    this._camera.position.set(0, 3, 8);
    this._camera.lookAt(0, 0, 0);

    if (this._infoPanel) this._infoPanel.style.display = 'none';
    if (this._backBtn)   this._backBtn.style.display   = 'none';
  }

  _showInfoPanel(type) {
    if (!this._infoPanel) return;
    const stats = WEAPON_STATS[type];
    if (!stats) return;

    const WEAPON_NAMES = { missile: 'Homing Missile', bomb: 'Bomb Bay', emp: 'EMP Cannon', cluster: 'Cluster Bomb' };
    const WEAPON_DESCS = {
      missile: 'Locks onto the highest-priority target (tanks first). Deals extra damage vs armored units.',
      bomb:    'Drops directly below the drone. Massive area damage with linear falloff.',
      emp:     'Emits a pulse that stuns all ground units in range. No damage — pure disruption.',
      cluster: 'Disperses 6 submunitions across a wide area. Devastating against grouped infantry.',
    };

    this._infoPanel.innerHTML = `
      <div style="font-size:.85rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#FFE28A;margin-bottom:2px;">
        ${WEAPON_NAMES[type] || type}
      </div>
      <div style="font-size:.7rem;color:rgba(255,255,255,.55);margin-bottom:6px;line-height:1.35;">
        ${WEAPON_DESCS[type] || ''}
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        <span style="font-size:.65rem;color:rgba(255,255,255,.7);">⚔ DMG <b style="color:#fff">${stats.damage || '—'}</b></span>
        <span style="font-size:.65rem;color:rgba(255,255,255,.7);">⏱ CD <b style="color:#fff">${stats.cooldown}</b></span>
        <span style="font-size:.65rem;color:rgba(255,255,255,.7);">📡 RNG <b style="color:#fff">${stats.range}</b></span>
        <span style="font-size:.65rem;color:rgba(255,255,255,.7);">🎯 <b style="color:#fff">${stats.type}</b></span>
      </div>
    `;
    this._infoPanel.style.display = 'flex';
  }

  _buildWeaponMesh(type, S) {
    const group = new THREE.Group();
    switch (type) {
      case 'missile': {
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08*S, 0.08*S, 0.75*S, 10),
          new THREE.MeshStandardMaterial({ color: 0xCC7700, roughness: 0.4, metalness: 0.7 }));
        body.rotation.z = Math.PI / 2;
        group.add(body);
        const nose = new THREE.Mesh(
          new THREE.ConeGeometry(0.08*S, 0.24*S, 10),
          new THREE.MeshStandardMaterial({ color: 0xFF4400, roughness: 0.35, metalness: 0.6 }));
        nose.rotation.z = -Math.PI / 2;
        nose.position.x = 0.5*S;
        group.add(nose);
        // Fins (cross)
        for (const rx of [0, Math.PI/2]) {
          const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.22*S, 0.28*S, 0.03*S),
            new THREE.MeshStandardMaterial({ color: 0x995500, roughness: 0.6, metalness: 0.4 }));
          fin.position.x = -0.32*S;
          fin.rotation.x = rx;
          group.add(fin);
        }
        // Engine glow
        const glow = new THREE.PointLight(0xFF6600, 1.2, 3*S);
        glow.position.x = -0.4*S;
        group.add(glow);
        break;
      }
      case 'bomb': {
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.3*S, 12, 9),
          new THREE.MeshStandardMaterial({ color: 0x2A2A2A, roughness: 0.65, metalness: 0.4 }));
        group.add(body);
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(0.11*S, 0.35*S, 10),
          new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.6, metalness: 0.5 }));
        tip.position.y = -0.4*S;
        tip.rotation.z = Math.PI;
        group.add(tip);
        // Warning stripe ring
        const stripe = new THREE.Mesh(
          new THREE.TorusGeometry(0.3*S, 0.042*S, 8, 28),
          new THREE.MeshStandardMaterial({ color: 0xFFDD00, roughness: 0.4, emissive: 0x443300, emissiveIntensity: 0.3 }));
        group.add(stripe);
        // Second stripe
        const stripe2 = stripe.clone();
        stripe2.rotation.x = Math.PI / 6;
        group.add(stripe2);
        break;
      }
      case 'emp': {
        // Outer pulsing ring
        const ring1 = new THREE.Mesh(
          new THREE.TorusGeometry(0.42*S, 0.055*S, 10, 32),
          new THREE.MeshStandardMaterial({ color: 0x00CCFF, roughness: 0.2, metalness: 0.9,
            emissive: 0x003366, emissiveIntensity: 0.8 }));
        group.add(ring1);
        const ring2 = new THREE.Mesh(
          new THREE.TorusGeometry(0.28*S, 0.04*S, 10, 28),
          new THREE.MeshStandardMaterial({ color: 0x44DDFF, roughness: 0.15, metalness: 0.95,
            emissive: 0x004488, emissiveIntensity: 0.7 }));
        ring2.rotation.x = Math.PI / 2.5;
        group.add(ring2);
        const ring3 = new THREE.Mesh(
          new THREE.TorusGeometry(0.17*S, 0.03*S, 8, 22),
          new THREE.MeshStandardMaterial({ color: 0x88FFFF, roughness: 0.1, metalness: 1.0,
            emissive: 0x0088AA, emissiveIntensity: 0.9 }));
        ring3.rotation.y = Math.PI / 3;
        group.add(ring3);
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.11*S, 12, 9),
          new THREE.MeshStandardMaterial({ color: 0xAAFFFF, roughness: 0.05, metalness: 1.0,
            emissive: 0x00AACC, emissiveIntensity: 1.5 }));
        group.add(core);
        // Light source
        group.add(new THREE.PointLight(0x00CCFF, 2.0, 5*S));
        break;
      }
      case 'cluster': {
        // Main canister
        const canister = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24*S, 0.2*S, 0.55*S, 10),
          new THREE.MeshStandardMaterial({ color: 0x4A5A3A, roughness: 0.55, metalness: 0.5 }));
        group.add(canister);
        // Cap
        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2*S, 0.24*S, 0.12*S, 10),
          new THREE.MeshStandardMaterial({ color: 0x3A4A2A, roughness: 0.6, metalness: 0.4 }));
        cap.position.y = -0.33*S;
        group.add(cap);
        // Submunitions popping out
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const r = 0.32*S;
          const sub = new THREE.Mesh(
            new THREE.SphereGeometry(0.085*S, 8, 7),
            new THREE.MeshStandardMaterial({ color: 0xFF5500, roughness: 0.45,
              emissive: 0x441100, emissiveIntensity: 0.4 }));
          sub.position.set(Math.cos(angle)*r, 0.28*S + Math.abs(Math.sin(i))*0.15*S, Math.sin(angle)*r);
          group.add(sub);
        }
        break;
      }
      default:
        return null;
    }
    return group;
  }

  _clearLabels() {
    for (const el of this._weaponLabels) el.remove();
    this._weaponLabels = [];
  }

  start() {
    this._active = true;
    // Defer resize until after the browser paints the newly-visible screen
    requestAnimationFrame(() => {
      this._onResize();
      this._tick();
    });
  }

  stop() {
    this._active = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  _tick() {
    if (!this._active) return;
    this._rafId = requestAnimationFrame(() => this._tick());
    this._t += 0.016;

    if (this._mode === 'drone') {
      if (this._droneGroup) {
        // Slow rotation + gentle hover
        this._droneGroup.rotation.y = this._t * 0.18;
        this._droneGroup.position.y = Math.sin(this._t * 0.9) * 0.18;
      }
      if (this._weaponGroup) {
        this._weaponGroup.rotation.y = this._t * 0.12;
        this._weaponGroup.position.y = Math.sin(this._t * 0.7 + 1) * 0.12 - 0.3;
      }
      for (const r of this._rotors) r.rotation.y += 0.28;

    } else if (this._mode === 'weapon') {
      if (this._previewGroup) {
        this._previewGroup.rotation.y = this._t * 0.55;
        this._previewGroup.position.y = Math.sin(this._t * 1.1) * 0.2;

        // Pulse emissive on EMP rings
        if (this._previewType === 'emp') {
          const pulse = 0.6 + 0.4 * Math.sin(this._t * 3.5);
          this._previewGroup.traverse(obj => {
            if (obj.isMesh && obj.material?.emissiveIntensity !== undefined) {
              obj.material.emissiveIntensity = pulse * (obj.material.emissiveIntensity > 0.5 ? 1.2 : 0.5);
            }
          });
        }
      }
    }

    if (this._renderer && this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  }

  destroy() {
    this.stop();
    this._clearLabels();
    if (this._renderer) this._renderer.dispose();
  }
}
