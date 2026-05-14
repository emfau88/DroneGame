import * as THREE from 'three';

const COLOR = {
  groundBase:   0x5FBD52,
  road:         0x6B625A,
  water:        0x3CAEE5,
  waterDeep:    0x1A7AAA,
  skyDay:       0x8EC7FF,
  skyDawn:      0xE87040,
  skyNight:     0x080E1E,
  desertGround: 0xC8A96E,
  desertDark:   0xB8955A,
  desertSky:    0xE8C87A,
  sandstormSky: 0xC4903A,
  forestGround: 0x3D7A36,
  forestSky:    0x6BA8D4,
  nightForestSky: 0x050D18,
  urbanGround:  0x555560,
  urbanSky:     0x9AADCC,
  urbanNightSky:0x080E1E,
  harborSky:    0x6AA8D8,
  harborWater:  0x1E6A9A,
};

// ── Shared geometry pool — created once, reused ─────────────────────────────
const _groundGeo       = new THREE.PlaneGeometry(160, 60);
const _riverGeo        = new THREE.PlaneGeometry(160, 8);
const _harborWaterGeo  = new THREE.PlaneGeometry(160, 28);
const _bridgeGeo       = new THREE.BoxGeometry(160, 0.22, 10);
const _bridgeRailGeo   = new THREE.BoxGeometry(160, 0.55, 0.22);
const _bridgePillarGeo = new THREE.BoxGeometry(1.8, 3.0, 8);
const _sandbagBaseGeo  = new THREE.BoxGeometry(2.2, 0.42, 0.72);
const _sandbagTopGeo   = new THREE.BoxGeometry(1.8, 0.38, 0.62);
const _sandbagSideGeo  = new THREE.BoxGeometry(0.68, 0.42, 0.72);
const _roadGeo         = new THREE.PlaneGeometry(160, 9);
const _duneGeo         = new THREE.CylinderGeometry(0, 3.5, 1.8, 8);
const _treeGeo         = new THREE.CylinderGeometry(0, 1.2, 3, 6);
const _trunkGeo        = new THREE.CylinderGeometry(0.25, 0.25, 1.5, 6);
const _bushGeo         = new THREE.SphereGeometry(0.65, 7, 5);
const _palmTrunkGeo    = new THREE.CylinderGeometry(0.18, 0.24, 4.5, 7);
const _palmLeafGeo     = new THREE.ConeGeometry(1.6, 1.0, 6);
const _rockGeo         = new THREE.DodecahedronGeometry(1.0, 0);
const _pyramidGeo      = new THREE.ConeGeometry(6, 5, 4);
const _windowGeo       = new THREE.BoxGeometry(0.6, 0.65, 0.08);
const _doorGeo         = new THREE.BoxGeometry(0.7, 1.1, 0.09);
const _stepGeo         = new THREE.BoxGeometry(1.2, 0.18, 0.5);
const _roofEdgeGeo     = new THREE.BoxGeometry(4.3, 0.22, 4.3);
// Crater — flat disc decal, no 3-D walls
const _craterGeo       = new THREE.CircleGeometry(1.9, 14);
// Harbor / ship deco
const _pierGeo         = new THREE.BoxGeometry(4, 0.35, 18);
const _bollardGeo      = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8);
const _craneBaseGeo    = new THREE.BoxGeometry(1.2, 5.0, 1.2);
const _craneArmGeo     = new THREE.BoxGeometry(6.0, 0.4, 0.4);
const _containerGeo    = new THREE.BoxGeometry(3.2, 1.6, 1.6);
// Titan arena deco
const _barrierGeo      = new THREE.BoxGeometry(4.0, 1.2, 0.55);
const _tankHullkGeo    = new THREE.BoxGeometry(2.2, 0.7, 1.4);
const _debrisGeo       = new THREE.BoxGeometry(1.0, 0.4, 0.8);
// Floodlight
const _lightPoleGeo    = new THREE.CylinderGeometry(0.08, 0.08, 6, 6);
const _lightHeadGeo    = new THREE.BoxGeometry(0.6, 0.18, 0.28);
// Forest night deco
const _fernGeo         = new THREE.ConeGeometry(0.55, 0.9, 5);
const _mossGeo         = new THREE.SphereGeometry(0.4, 5, 4);
// Sandstorm deco
const _skullGeo        = new THREE.IcosahedronGeometry(0.28, 0);
const _wreckGeo        = new THREE.BoxGeometry(3.2, 0.9, 1.8);

/**
 * World — terrain, lighting, and setting-specific decorations.
 * Settings: 'bridge' | 'harbor' | 'desert' | 'sandstorm' | 'forest' | 'night_forest' | 'urban' | 'titan_arena'
 */
export class World {
  constructor() {
    this._scene   = null;
    this._objects = [];
    this._sun     = null;
    this._lights  = []; // extra point/spot lights for cleanup
    this._animatedObjects = []; // { mesh, fn(t) } — updated each frame if needed
  }

  init(scene) {
    this._scene = scene;
    this._buildLighting(scene);
  }

  _buildLighting(scene) {
    this._sun = new THREE.DirectionalLight(0xFFF4D0, 1.6);
    this._sun.position.set(-25, 42, 20);
    this._sun.castShadow = true;
    this._sun.shadow.mapSize.width  = 2048;
    this._sun.shadow.mapSize.height = 2048;
    this._sun.shadow.camera.near = 1;
    this._sun.shadow.camera.far  = 130;
    this._sun.shadow.camera.left   = -55;
    this._sun.shadow.camera.right  =  55;
    this._sun.shadow.camera.top    =  55;
    this._sun.shadow.camera.bottom = -55;
    this._sun.shadow.bias = -0.0008;
    scene.add(this._sun);

    const hemi = new THREE.HemisphereLight(0xB4D4F5, 0x8B7040, 0.75);
    scene.add(hemi);
    this._lights.push(hemi);

    const fill = new THREE.DirectionalLight(0xCCDDFF, 0.35);
    fill.position.set(18, 22, -12);
    scene.add(fill);
    this._lights.push(fill);
  }

  build(setting, _scene, lightingOverride) {
    // lightingOverride: 'night' | 'sandstorm' — may be baked into setting now
    if (lightingOverride === 'night') this._applyNightLighting();
    if (lightingOverride === 'sandstorm') this._applySandstormLighting();

    switch (setting) {
      case 'bridge':      this._buildBridge();     break;
      case 'harbor':      this._buildHarbor();     break;
      case 'desert':      this._buildDesert();     break;
      case 'sandstorm':   this._buildSandstorm();  break;
      case 'forest':      this._buildForest();     break;
      case 'night_forest':this._buildNightForest();break;
      case 'urban':       this._buildUrban();      break;
      case 'titan_arena': this._buildTitanArena(); break;
      default:            this._buildBridge();     break;
    }
  }

  // ── Lighting overrides ────────────────────────────────────────────────────

  _applyNightLighting(tint = 0x8090C0, fogColor = COLOR.skyNight, fogNear = 35, fogFar = 90, sunIntensity = 0.18, hemiIntensity = 0.18) {
    this._scene.background = new THREE.Color(fogColor);
    this._scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    if (this._sun) {
      this._sun.intensity = sunIntensity;
      this._sun.color.setHex(tint);
    }
    for (const l of this._lights) {
      if (l.isHemisphereLight) { l.intensity = hemiIntensity; l.color.setHex(0x1A2840); l.groundColor.setHex(0x0A0A10); }
      if (l.isDirectionalLight && l !== this._sun) l.intensity = 0.05;
    }
  }

  _applySandstormLighting() {
    const fogColor = 0xB87830;
    this._scene.background = new THREE.Color(fogColor);
    this._scene.fog = new THREE.Fog(fogColor, 18, 52);
    if (this._sun) { this._sun.intensity = 0.55; this._sun.color.setHex(0xDD9944); }
    for (const l of this._lights) {
      if (l.isHemisphereLight) { l.intensity = 0.45; l.color.setHex(0xCC8833); l.groundColor.setHex(0x7A5520); }
    }
  }

  // ── BRIDGE ────────────────────────────────────────────────────────────────

  _buildBridge() {
    this._scene.background = new THREE.Color(COLOR.skyDay);
    this._scene.fog = new THREE.Fog(COLOR.skyDay, 65, 140);

    // Vertex-colored grass
    const groundGeo = new THREE.PlaneGeometry(160, 60, 64, 24);
    this._applyGrassVertexColors(groundGeo, 0x5FBD52);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = -0.01;
    this._scene.add(ground); this._objects.push(ground);

    // River — multi-segment with animated shimmer via vertex colors
    const riverGeo = new THREE.PlaneGeometry(160, 8, 80, 8);
    this._applyWaterVertexColors(riverGeo);
    const riverMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.55, transparent: true, opacity: 0.92 });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2; river.position.y = 0.01;
    this._scene.add(river); this._objects.push(river);

    // Road with ruts
    const roadGeo = new THREE.PlaneGeometry(160, 9, 80, 20);
    this._applyRoadVertexColors(roadGeo);
    const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.001; road.receiveShadow = true;
    this._scene.add(road); this._objects.push(road);

    // Bridge deck — thicker, concrete-coloured
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x9A8C7A, roughness: 0.88, metalness: 0.05 });
    const deck = new THREE.Mesh(_bridgeGeo, deckMat);
    deck.position.y = 0.11; deck.receiveShadow = true; deck.castShadow = true;
    this._scene.add(deck); this._objects.push(deck);

    // Bridge railings (both sides)
    const railMat = new THREE.MeshStandardMaterial({ color: 0x7A6E60, roughness: 0.75, metalness: 0.2 });
    for (const zOff of [-4.7, 4.7]) {
      const rail = new THREE.Mesh(_bridgeRailGeo, railMat);
      rail.position.set(0, 0.5, zOff); rail.castShadow = true;
      this._scene.add(rail); this._objects.push(rail);
    }

    // Bridge support pillars every 20 units
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x888070, roughness: 0.85 });
    for (let px = -60; px <= 60; px += 20) {
      const p = new THREE.Mesh(_bridgePillarGeo, pillarMat);
      p.position.set(px, -1.3, 0); p.castShadow = true; p.receiveShadow = true;
      this._scene.add(p); this._objects.push(p);
    }

    this._addCoverObjects();
    this._addEdgeBushes();
    this._addBridgeDebris();
  }

  _addBridgeDebris() {
    // Scattered sandbags and blast craters near the bridge
    const craterMat = new THREE.MeshStandardMaterial({ color: 0x3A3020, roughness: 0.99 });
    const craterPositions = [[-12, 3], [4, -5], [18, 2], [-5, 6], [25, -4]];
    for (const [x, z] of craterPositions) {
      const c = new THREE.Mesh(_craterGeo, craterMat);
      c.rotation.x = -Math.PI / 2;
      c.position.set(x, 0.02, z);
      c.receiveShadow = true;
      this._scene.add(c); this._objects.push(c);
    }
    // Broken concrete chunks at bridge edges
    const chunkMat = new THREE.MeshStandardMaterial({ color: 0x888070, roughness: 0.95 });
    const chunkGeo = new THREE.BoxGeometry(0.9, 0.55, 0.65);
    const chunkPositions = [[-3, 4.2], [7, -4.5], [-15, 3.8], [12, 4.6]];
    for (const [x, z] of chunkPositions) {
      const chunk = new THREE.Mesh(chunkGeo, chunkMat);
      const rot = (x * z * 0.15) % (Math.PI * 2);
      chunk.position.set(x, 0.28, z);
      chunk.rotation.y = rot; chunk.castShadow = true;
      this._scene.add(chunk); this._objects.push(chunk);
    }
  }

  // ── HARBOR ────────────────────────────────────────────────────────────────

  _buildHarbor() {
    this._scene.background = new THREE.Color(COLOR.harborSky);
    this._scene.fog = new THREE.Fog(COLOR.harborSky, 55, 130);

    // Quay ground (concrete)
    const quayGeo = new THREE.PlaneGeometry(160, 60, 48, 18);
    this._applyConcreteVertexColors(quayGeo);
    const quay = new THREE.Mesh(quayGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.90 }));
    quay.rotation.x = -Math.PI / 2; quay.receiveShadow = true; quay.position.y = -0.01;
    this._scene.add(quay); this._objects.push(quay);

    // Harbor water — wide band behind enemy lines
    const waterGeo = new THREE.PlaneGeometry(160, 28, 80, 14);
    this._applyWaterVertexColors(waterGeo, 0x1E5A88, 0x0E3A60);
    const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.65, transparent: true, opacity: 0.90 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.03, -20);
    this._scene.add(water); this._objects.push(water);

    // Road / service lane
    const laneGeo = new THREE.PlaneGeometry(160, 9, 80, 20);
    this._applyRoadVertexColors(laneGeo);
    const lane = new THREE.Mesh(laneGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }));
    lane.rotation.x = -Math.PI / 2; lane.position.y = 0.002; lane.receiveShadow = true;
    this._scene.add(lane); this._objects.push(lane);

    this._addPiers();
    this._addCranes();
    this._addContainers();
    this._addCoverObjects();
    this._addHarborLights();
  }

  _addPiers() {
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x7A6E5A, roughness: 0.90, metalness: 0.05 });
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0x3A3028, roughness: 0.85, metalness: 0.3 });
    const pierConfigs = [{ x: -24, z: -22 }, { x: 0, z: -24 }, { x: 22, z: -22 }];
    for (const { x, z } of pierConfigs) {
      const pier = new THREE.Mesh(_pierGeo, pierMat);
      pier.position.set(x, 0.15, z); pier.castShadow = true; pier.receiveShadow = true;
      this._scene.add(pier); this._objects.push(pier);
      // Bollards along pier edge
      for (let bi = -6; bi <= 6; bi += 4) {
        const b = new THREE.Mesh(_bollardGeo, bollardMat);
        b.position.set(x + bi, 0.45, z - 8); b.castShadow = true;
        this._scene.add(b); this._objects.push(b);
      }
    }
  }

  _addCranes() {
    const craneMat  = new THREE.MeshStandardMaterial({ color: 0xE8A020, roughness: 0.55, metalness: 0.6 });
    const cableGeo  = new THREE.CylinderGeometry(0.04, 0.04, 5, 4);
    const cableMat  = new THREE.MeshStandardMaterial({ color: 0x585858, roughness: 0.6, metalness: 0.7 });
    const cranePositions = [{ x: -20, z: -18 }, { x: 14, z: -20 }];
    for (const { x, z } of cranePositions) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const base = new THREE.Mesh(_craneBaseGeo, craneMat);
      base.position.y = 2.5; base.castShadow = true; g.add(base);
      const arm = new THREE.Mesh(_craneArmGeo, craneMat);
      arm.position.set(2.5, 5.2, 0); arm.castShadow = true; g.add(arm);
      // Hanging cable
      const cable = new THREE.Mesh(cableGeo, cableMat);
      cable.position.set(4.5, 2.8, 0); g.add(cable);
      this._scene.add(g); this._objects.push(g);
    }
  }

  _addContainers() {
    const colors = [0xD43020, 0x2060C0, 0xE8A020, 0x206040, 0x884010];
    const configs = [
      { x: -28, z: -14, rot: 0.05 }, { x: -24, z: -14, rot: 0 },
      { x: -20, z: -14, rot: -0.04 }, { x: -28, z: -12, rot: 0.02 },
      { x: 20, z: -15, rot: 0.08 }, { x: 24, z: -15, rot: -0.03 },
      { x: 16, z: -13, rot: 0.06 }, { x: 28, z: -13, rot: 0 },
    ];
    for (let i = 0; i < configs.length; i++) {
      const { x, z, rot } = configs[i];
      const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.78, metalness: 0.25 });
      const c = new THREE.Mesh(_containerGeo, mat);
      c.position.set(x, 0.8, z); c.rotation.y = rot;
      c.castShadow = true; c.receiveShadow = true;
      this._scene.add(c); this._objects.push(c);
    }
  }

  _addHarborLights() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x888890, roughness: 0.6, metalness: 0.5 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xDDDDAA, roughness: 0.3, metalness: 0.4, emissive: new THREE.Color(0x554400) });
    const polePositions = [[-30, -10], [-10, -12], [8, -10], [26, -12]];
    for (const [x, z] of polePositions) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const pole = new THREE.Mesh(_lightPoleGeo, poleMat);
      pole.position.y = 3; pole.castShadow = true; g.add(pole);
      const head = new THREE.Mesh(_lightHeadGeo, headMat);
      head.position.set(0.25, 6.1, 0); g.add(head);
      const pt = new THREE.PointLight(0xFFEE88, 1.2, 12);
      pt.position.set(0, 6.0, 0); g.add(pt);
      this._scene.add(g); this._objects.push(g);
    }
  }

  // ── DESERT ────────────────────────────────────────────────────────────────

  _buildDesert() {
    this._scene.background = new THREE.Color(COLOR.desertSky);
    this._scene.fog = new THREE.Fog(COLOR.desertSky, 65, 145);

    const geoD = new THREE.PlaneGeometry(160, 60, 64, 24);
    this._applyGrassVertexColors(geoD, COLOR.desertGround, [
      new THREE.Color(0xA8884A),
      new THREE.Color(0xEED898),
      new THREE.Color(0xD4B870),
    ]);
    const meshD = new THREE.Mesh(geoD, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }));
    meshD.rotation.x = -Math.PI / 2; meshD.receiveShadow = true; meshD.position.y = -0.01;
    this._scene.add(meshD); this._objects.push(meshD);

    this._addDunes();
    this._addDesertRocks();
    this._addPalms();
    this._addPyramid();
    this._addDesertRuins();
  }

  _addDesertRuins() {
    // Crumbling stone walls and pillars scattered mid-field
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xC4A870, roughness: 0.97, metalness: 0.0 });
    const darkMat  = new THREE.MeshStandardMaterial({ color: 0x8A7040, roughness: 0.98 });
    const wallConfigs = [
      { x: -16, z: 11, w: 0.55, h: 2.2, d: 4.0, ry: 0.1 },
      { x: -16, z: -11, w: 0.55, h: 1.6, d: 3.2, ry: -0.12 },
      { x:   8, z: 12, w: 0.55, h: 2.8, d: 5.0, ry: 0.05 },
      { x:   8, z: -13, w: 0.55, h: 1.4, d: 2.8, ry: 0.15 },
      { x:  22, z: 10, w: 0.55, h: 2.0, d: 3.5, ry: -0.08 },
    ];
    for (const { x, z, w, h, d, ry } of wallConfigs) {
      const wg = new THREE.BoxGeometry(w, h, d);
      const wall = new THREE.Mesh(wg, stoneMat);
      wall.position.set(x, h / 2, z); wall.rotation.y = ry;
      wall.castShadow = true; wall.receiveShadow = true;
      this._scene.add(wall); this._objects.push(wall);
    }
    // Stone pillars
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.38, 3.0, 8);
    const pillarPositions = [[-20, -8, 0.4], [-20, 8, -0.2], [5, -9, 0.8], [18, 8, 0.15]];
    for (const [x, z, ry] of pillarPositions) {
      const pil = new THREE.Mesh(pillarGeo, darkMat);
      pil.position.set(x, 1.5, z); pil.rotation.y = ry;
      pil.castShadow = true; pil.receiveShadow = true;
      this._scene.add(pil); this._objects.push(pil);
    }
  }

  // ── SANDSTORM ─────────────────────────────────────────────────────────────

  _buildSandstorm() {
    this._applySandstormLighting();

    const geoS = new THREE.PlaneGeometry(160, 60, 64, 24);
    this._applyGrassVertexColors(geoS, 0xA87840, [
      new THREE.Color(0x7A5828),
      new THREE.Color(0xC89050),
      new THREE.Color(0x986830),
    ]);
    const meshS = new THREE.Mesh(geoS, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }));
    meshS.rotation.x = -Math.PI / 2; meshS.receiveShadow = true; meshS.position.y = -0.01;
    this._scene.add(meshS); this._objects.push(meshS);

    // Sand-blown track — slightly darker strip for spatial orientation
    const trackGeoS = new THREE.PlaneGeometry(160, 8, 80, 10);
    this._applySandstormTrackColors(trackGeoS);
    const trackS = new THREE.Mesh(trackGeoS, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.99 }));
    trackS.rotation.x = -Math.PI / 2; trackS.position.y = 0.001; trackS.receiveShadow = true;
    this._scene.add(trackS); this._objects.push(trackS);

    this._addDunes();
    this._addSandstormWrecks();
    this._addSandDrifts();
    this._addDesertRocks();
  }

  _addSandstormWrecks() {
    // Abandoned burned-out vehicle wrecks half-buried in sand
    const wreckMat  = new THREE.MeshStandardMaterial({ color: 0x3A2A18, roughness: 0.97, metalness: 0.3 });
    const rustMat   = new THREE.MeshStandardMaterial({ color: 0x6A3A18, roughness: 0.95, metalness: 0.25 });
    const wreckConfigs = [
      { x: -22, z:  8, ry: 0.4, tilt: 0.15 },
      { x:  -8, z: -9, ry: 1.1, tilt: -0.2 },
      { x:   6, z:  11, ry: 2.5, tilt: 0.1 },
      { x:  18, z: -7, ry: 0.8, tilt: -0.12 },
      { x:  26, z:  5, ry: 1.8, tilt: 0.18 },
    ];
    for (const { x, z, ry, tilt } of wreckConfigs) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const hull = new THREE.Mesh(_wreckGeo, wreckMat);
      hull.position.y = 0.25; hull.rotation.z = tilt;
      hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
      // Turret thrown off
      const turretGeo = new THREE.BoxGeometry(1.2, 0.55, 1.0);
      const turret = new THREE.Mesh(turretGeo, rustMat);
      turret.position.set(0.8, 0.6, 0.6); turret.rotation.set(tilt * 2, 0.5, tilt);
      turret.castShadow = true; g.add(turret);
      this._scene.add(g); this._objects.push(g);
    }
  }

  _addSandDrifts() {
    // Elongated low dunes — wind-blown looking
    const driftMat = new THREE.MeshStandardMaterial({ color: 0xBE9850, roughness: 0.99 });
    const driftGeo = new THREE.CylinderGeometry(0, 2.0, 0.65, 6);
    const driftPositions = [
      [-18, 5, 0.3], [-5, -12, 0.1], [8, 7, 0.5], [20, -8, 0.2], [-10, 10, 0.4],
      [3, -6, 0.15], [15, 4, 0.35], [-25, -5, 0.0],
    ];
    for (const [x, z, ry] of driftPositions) {
      const drift = new THREE.Mesh(driftGeo, driftMat);
      drift.scale.set(1.4, 1.0, 0.55); // elongate in wind direction
      drift.position.set(x, 0.08, z); drift.rotation.y = ry;
      drift.receiveShadow = true;
      this._scene.add(drift); this._objects.push(drift);
    }
  }

  // ── FOREST ────────────────────────────────────────────────────────────────

  _buildForest() {
    this._scene.background = new THREE.Color(COLOR.forestSky);
    this._scene.fog = new THREE.Fog(COLOR.forestSky, 50, 115);

    const geoF = new THREE.PlaneGeometry(160, 60, 64, 24);
    this._applyGrassVertexColors(geoF, COLOR.forestGround, [
      new THREE.Color(0x1E4A1A),
      new THREE.Color(0x52A045),
      new THREE.Color(0x6A8A30),
    ]);
    const meshF = new THREE.Mesh(geoF, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    meshF.rotation.x = -Math.PI / 2; meshF.receiveShadow = true; meshF.position.y = -0.01;
    this._scene.add(meshF); this._objects.push(meshF);

    const roadGeoF = new THREE.PlaneGeometry(160, 9, 80, 20);
    this._applyRoadVertexColors(roadGeoF);
    const roadF = new THREE.Mesh(roadGeoF, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }));
    roadF.rotation.x = -Math.PI / 2; roadF.position.y = 0.001; roadF.receiveShadow = true;
    this._scene.add(roadF); this._objects.push(roadF);

    this._addTrees();
    this._addEdgeBushes(0x2A5E22);
    this._addForestUndergrowth();
    this._addForestRocks();
    this._addLogBarriers();
  }

  _addForestUndergrowth() {
    const fernMat = new THREE.MeshStandardMaterial({ color: 0x2A6A22, roughness: 0.92 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x3A7030, roughness: 0.97 });
    // Ferns between trees
    const positions = [
      [-20, 12], [-14, -13], [-7, 15], [2, -14], [9, 13],
      [15, -15], [21, 14], [-24, -15], [27, -13],
    ];
    for (const [x, z] of positions) {
      const fern = new THREE.Mesh(_fernGeo, fernMat);
      fern.scale.set(1.2, 0.8, 1.2);
      fern.position.set(x + (Math.sin(x) * 0.5), 0.35, z + (Math.cos(z) * 0.4));
      fern.castShadow = true; this._scene.add(fern); this._objects.push(fern);
      // Moss blob nearby
      const moss = new THREE.Mesh(_mossGeo, mossMat);
      moss.scale.set(1.3, 0.6, 1.3);
      moss.position.set(x - 0.8, 0.18, z + 0.6);
      this._scene.add(moss); this._objects.push(moss);
    }
  }

  _addForestRocks() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5A5A4A, roughness: 0.96, metalness: 0.02 });
    const mossedMat = new THREE.MeshStandardMaterial({ color: 0x3A5A30, roughness: 0.98 });
    const configs = [
      { x: -19, z: -7, s: 1.1 }, { x: -11, z: 8, s: 0.8 },
      { x: 3, z: -10, s: 1.3 }, { x: 14, z: 9, s: 0.7 }, { x: 23, z: -8, s: 1.0 },
    ];
    for (const { x, z, s } of configs) {
      const rock = new THREE.Mesh(_rockGeo, rockMat);
      rock.scale.set(s, s * 0.7, s * 0.9); rock.position.set(x, s * 0.35, z);
      rock.rotation.y = x * 0.4; rock.castShadow = true; rock.receiveShadow = true;
      this._scene.add(rock); this._objects.push(rock);
      const mossy = new THREE.Mesh(_mossGeo, mossedMat);
      mossy.scale.set(s * 1.1, s * 0.3, s * 1.0); mossy.position.set(x, s * 0.65, z + 0.2);
      this._scene.add(mossy); this._objects.push(mossy);
    }
  }

  _addLogBarriers() {
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6B4A22, roughness: 0.98 });
    const logGeo = new THREE.CylinderGeometry(0.22, 0.26, 4.5, 8);
    const configs = [
      { x: -8, z: 7, ry: 0.15 }, { x: -8, z: -7, ry: -0.2 },
      { x:  6, z: 8, ry: 0.05 }, { x:  6, z: -8, ry: 0.1  },
      { x: 18, z: 7, ry: -0.1 },
    ];
    for (const { x, z, ry } of configs) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.rotation.set(0, ry, Math.PI / 2); // lay it horizontal
      log.position.set(x, 0.24, z);
      log.castShadow = true; log.receiveShadow = true;
      this._scene.add(log); this._objects.push(log);
    }
  }

  // ── NIGHT FOREST ─────────────────────────────────────────────────────────

  _buildNightForest() {
    // fogNear=38 so closer objects stay visible; sun/hemi bumped for playability
    this._applyNightLighting(0x304878, COLOR.nightForestSky, 38, 85, 0.45, 0.42);

    const geoNF = new THREE.PlaneGeometry(160, 60, 64, 24);
    this._applyGrassVertexColors(geoNF, 0x2A4A28, [
      new THREE.Color(0x1A2E18),
      new THREE.Color(0x3A6035),
      new THREE.Color(0x2E4E28),
    ]);
    const meshNF = new THREE.Mesh(geoNF, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }));
    meshNF.rotation.x = -Math.PI / 2; meshNF.receiveShadow = true; meshNF.position.y = -0.01;
    this._scene.add(meshNF); this._objects.push(meshNF);

    // Dark muddy track
    const trackGeo = new THREE.PlaneGeometry(160, 9, 80, 20);
    this._applyNightRoadVertexColors(trackGeo);
    const track = new THREE.Mesh(trackGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }));
    track.rotation.x = -Math.PI / 2; track.position.y = 0.001; track.receiveShadow = true;
    this._scene.add(track); this._objects.push(track);

    this._addNightTrees();
    this._addNightUndergrowth();
    this._addNightFirePits();
    this._addNightForestFog();
    this._addLogBarriers();
  }

  _addNightTrees() {
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x1C3A1A, roughness: 0.97 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3C2A14, roughness: 0.99 });
    // Denser than day forest — more trees, including mid-field
    const positions = [
      [-22,-18],[-22,18],[-16,-17],[-16,17],[-9,-18],[-9,18],
      [-1,-18],[-1,18],[6,-17],[6,17],[13,-18],[13,18],
      [19,-17],[19,17],[26,-18],[26,18],
      // Extra mid-field trees (slightly off lane)
      [-18,-10],[-18,10],[-5,-11],[-5,11],[10,-12],[10,12],[22,-11],[22,11],
    ];
    for (const [x, z] of positions) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(_trunkGeo, trunkMat);
      trunk.position.y = 0.75; trunk.castShadow = true;
      const scale = 0.9 + Math.abs((x * 7 + z * 3) % 10) * 0.028;
      const leaves = new THREE.Mesh(_treeGeo, leafMat);
      leaves.position.y = 3.2; leaves.scale.setScalar(scale); leaves.castShadow = true;
      g.add(trunk); g.add(leaves); g.position.set(x, 0, z);
      this._scene.add(g); this._objects.push(g);
    }
  }

  _addNightUndergrowth() {
    const fernMat = new THREE.MeshStandardMaterial({ color: 0x1E4820, roughness: 0.95 });
    const positions = [
      [-20, 8], [-12, -9], [-4, 10], [5, -11], [11, 9], [18, -10], [24, 8],
    ];
    for (const [x, z] of positions) {
      const fern = new THREE.Mesh(_fernGeo, fernMat);
      fern.scale.set(1.0, 0.7, 1.0);
      fern.position.set(x, 0.3, z); fern.castShadow = true;
      this._scene.add(fern); this._objects.push(fern);
    }
  }

  _addNightFirePits() {
    // Small campfires / burn barrels — orange glow in the dark
    const barrelGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.72, 8);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2A2018, roughness: 0.8, metalness: 0.4 });
    const flameMat  = new THREE.MeshBasicMaterial({ color: 0xFF6010, transparent: true, opacity: 0.85 });
    const flameGeo  = new THREE.ConeGeometry(0.18, 0.55, 6);
    const positions = [
      [-15, 5], [-15, -5], [2, 8], [2, -8], [18, 5],
    ];
    for (const [x, z] of positions) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.position.y = 0.36; g.add(barrel);
      const flame = new THREE.Mesh(flameGeo, flameMat.clone());
      flame.position.y = 0.98; g.add(flame);
      // Warm orange point light
      const light = new THREE.PointLight(0xFF5510, 1.8, 8);
      light.position.y = 1.1; g.add(light);
      this._scene.add(g); this._objects.push(g);
    }
  }

  _addNightForestFog() {
    // Low mist planes near ground to sell depth
    const mistGeo = new THREE.PlaneGeometry(80, 20, 1, 1);
    const mistMat = new THREE.MeshBasicMaterial({ color: 0x102020, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
    const mistPositions = [[0, 3], [0, -3]];
    for (const [, z] of mistPositions) {
      const mist = new THREE.Mesh(mistGeo, mistMat.clone());
      mist.rotation.x = -Math.PI / 2; mist.position.set(0, 0.25, z);
      this._scene.add(mist); this._objects.push(mist);
    }
  }

  // ── URBAN ─────────────────────────────────────────────────────────────────

  _buildUrban() {
    this._scene.background = new THREE.Color(COLOR.urbanSky);
    this._scene.fog = new THREE.Fog(COLOR.urbanSky, 58, 125);

    // Vertex-painted concrete ground
    const urbanGeo = new THREE.PlaneGeometry(160, 60, 64, 24);
    this._applyConcreteVertexColors(urbanGeo);
    const urbanGround = new THREE.Mesh(urbanGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }));
    urbanGround.rotation.x = -Math.PI / 2; urbanGround.receiveShadow = true; urbanGround.position.y = -0.01;
    this._scene.add(urbanGround); this._objects.push(urbanGround);

    // Road with worn asphalt
    const roadGeo = new THREE.PlaneGeometry(160, 9, 80, 20);
    this._applyUrbanRoadVertexColors(roadGeo);
    const roadMesh = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 }));
    roadMesh.rotation.x = -Math.PI / 2; roadMesh.position.y = 0.002; roadMesh.receiveShadow = true;
    this._scene.add(roadMesh); this._objects.push(roadMesh);

    this._addBuildings();
    this._addUrbanDebris();
    this._addUrbanBarricades();
  }

  _addUrbanDebris() {
    // Overturned cars, rubble piles, blast craters
    const craterMat = new THREE.MeshStandardMaterial({ color: 0x2A2828, roughness: 0.99 });
    const craterPos = [[-6, 4], [8, -5], [20, 3], [-14, -6]];
    for (const [x, z] of craterPos) {
      const c = new THREE.Mesh(_craterGeo, craterMat);
      c.rotation.x = -Math.PI / 2; c.position.set(x, 0.015, z); c.receiveShadow = true;
      this._scene.add(c); this._objects.push(c);
    }
    // Rubble piles
    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x888090, roughness: 0.97 });
    const rubbleGeo = new THREE.IcosahedronGeometry(0.7, 0);
    const rubblePos = [[-10, 13], [-10, -13], [5, 14], [16, -14], [24, 13]];
    for (const [x, z] of rubblePos) {
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(rubbleGeo, rubbleMat);
        r.scale.set(0.5 + k * 0.2, 0.3 + k * 0.12, 0.4 + k * 0.15);
        r.position.set(x + k * 0.6, 0.25, z + k * 0.3);
        r.rotation.y = k * 1.2; r.castShadow = true;
        this._scene.add(r); this._objects.push(r);
      }
    }
  }

  _addUrbanBarricades() {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8A8890, roughness: 0.93 });
    const positions = [
      { x: -10, z:  9, ry: 0   },
      { x:  -5, z: -9, ry: 0.1 },
      { x:   7, z:  9, ry: -0.05 },
      { x:  14, z: -9, ry: 0.08 },
      { x:  22, z:  9, ry: 0   },
    ];
    for (const { x, z, ry } of positions) {
      const b = new THREE.Mesh(_barrierGeo, concreteMat);
      b.position.set(x, 0.6, z); b.rotation.y = ry;
      b.castShadow = true; b.receiveShadow = true;
      this._scene.add(b); this._objects.push(b);
    }
  }

  // ── TITAN ARENA ───────────────────────────────────────────────────────────

  _buildTitanArena() {
    // Night city — burning, devastated urban warzone
    this._applyNightLighting(0x2040A0, COLOR.urbanNightSky, 38, 85, 0.42, 0.38);

    // Scorched concrete ground
    const arenaGeo = new THREE.PlaneGeometry(160, 60, 64, 24);
    this._applyScorchedConcreteVertexColors(arenaGeo);
    const arenaGround = new THREE.Mesh(arenaGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.90 }));
    arenaGround.rotation.x = -Math.PI / 2; arenaGround.receiveShadow = true; arenaGround.position.y = -0.01;
    this._scene.add(arenaGround); this._objects.push(arenaGround);

    // Road — cracked and burned
    const arenaRoadGeo = new THREE.PlaneGeometry(160, 9, 80, 20);
    this._applyUrbanRoadVertexColors(arenaRoadGeo, true);
    const arenaRoad = new THREE.Mesh(arenaRoadGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }));
    arenaRoad.rotation.x = -Math.PI / 2; arenaRoad.position.y = 0.002; arenaRoad.receiveShadow = true;
    this._scene.add(arenaRoad); this._objects.push(arenaRoad);

    this._addBurnedBuildings();
    this._addTitanDebris();
    this._addFireEffects();
    this._addSearchlights();
  }

  _addBurnedBuildings() {
    const burnedMat  = new THREE.MeshStandardMaterial({ color: 0x2A2830, roughness: 0.88 });
    const charredMat = new THREE.MeshStandardMaterial({ color: 0x1A1820, roughness: 0.92, emissive: new THREE.Color(0x060404) });
    const configs = [
      { x: -18, z: -15, w: 5, h: 8, d: 5 },
      { x: -18, z:  15, w: 5, h: 4, d: 5 },  // shorter — partially collapsed
      { x:  -9, z: -16, w: 4, h: 10, d: 4 },
      { x:  -9, z:  16, w: 4, h: 6, d: 4 },
      { x:   2, z: -17, w: 4.5, h: 12, d: 4.5 },
      { x:   2, z:  17, w: 4.5, h: 7, d: 4.5 },
      { x:  12, z: -16, w: 4, h: 9, d: 4 },
      { x:  12, z:  16, w: 4, h: 5, d: 4 },
      { x:  21, z: -15, w: 5, h: 11, d: 5 },
      { x:  21, z:  15, w: 5, h: 8, d: 5 },
    ];
    for (const { x, z, w, h, d } of configs) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const body = new THREE.Mesh(bodyGeo, burnedMat);
      body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
      // Charred top section — darker
      const charGeo = new THREE.BoxGeometry(w * 0.9, h * 0.3, d * 0.9);
      const char = new THREE.Mesh(charGeo, charredMat);
      char.position.y = h * 0.85; g.add(char);
      // Broken windows — emissive orange for fire glow inside
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xFF4400, transparent: true, opacity: 0.6 });
      const numWin = Math.floor(w / 1.8);
      const numRows = Math.max(1, Math.floor(h / 3) - 1);
      const facingZ = z < 0 ? 1 : -1;
      const winZ = (d / 2 + 0.05) * facingZ;
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numWin; col++) {
          if (Math.abs((x + z + row * 3 + col * 7) % 3) === 0) continue; // some dark
          const wx = -((numWin - 1) / 2) * 1.5 + col * 1.5;
          const wy = 1.5 + row * 2.5;
          if (wy + 0.5 > h - 0.3) continue;
          const win = new THREE.Mesh(_windowGeo, fireMat);
          win.position.set(wx, wy, winZ);
          g.add(win);
        }
      }
      this._scene.add(g); this._objects.push(g);
    }
  }

  _addTitanDebris() {
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x3A3840, roughness: 0.95 });
    const metalMat  = new THREE.MeshStandardMaterial({ color: 0x2A2830, roughness: 0.7, metalness: 0.5 });
    // Scattered concrete slabs and steel beams
    const slabConfigs = [
      { x: -12, z: 6, s: [2.8, 0.3, 1.4], ry: 0.3, rx: 0.1 },
      { x:  -3, z:-8, s: [3.2, 0.25, 1.2], ry: -0.5, rx: -0.08 },
      { x:   9, z: 7, s: [2.2, 0.28, 1.8], ry: 1.1, rx: 0.12 },
      { x:  17, z:-6, s: [2.6, 0.3, 1.3], ry: 0.7, rx: -0.1 },
      { x:  25, z: 5, s: [1.8, 0.32, 2.0], ry: -0.2, rx: 0.05 },
    ];
    for (const { x, z, s, ry, rx } of slabConfigs) {
      const slabGeo = new THREE.BoxGeometry(...s);
      const slab = new THREE.Mesh(slabGeo, debrisMat);
      slab.position.set(x, s[1] / 2, z); slab.rotation.set(rx, ry, 0);
      slab.castShadow = true; slab.receiveShadow = true;
      this._scene.add(slab); this._objects.push(slab);
    }
    // Destroyed tank wrecks — foreshadowing the Titan
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x1E1C1A, roughness: 0.88, metalness: 0.4 });
    const wrecks = [{ x: -20, z: 7, ry: 0.4 }, { x: 5, z: -9, ry: 1.8 }];
    for (const { x, z, ry } of wrecks) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const hull = new THREE.Mesh(_tankHullkGeo, hullMat);
      hull.position.y = 0.35; hull.castShadow = true; g.add(hull);
      const turretGeo = new THREE.BoxGeometry(1.0, 0.5, 0.9);
      const turret = new THREE.Mesh(turretGeo, metalMat);
      turret.position.set(0.5, 0.85, 0.4); turret.rotation.set(0.2, 0.8, 0.15); g.add(turret);
      this._scene.add(g); this._objects.push(g);
    }
    // Craters everywhere
    const craterMat2 = new THREE.MeshStandardMaterial({ color: 0x1A1818, roughness: 0.99 });
    for (const [x, z] of [[-8, 4], [6, -5], [18, 4], [-2, -7], [24, -4]]) {
      const c = new THREE.Mesh(_craterGeo, craterMat2);
      c.rotation.x = -Math.PI / 2; c.position.set(x, 0.01, z); c.receiveShadow = true;
      this._scene.add(c); this._objects.push(c);
    }
  }

  _addFireEffects() {
    // Fire glow columns from windows and ground — PointLights + flame meshes
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xFF5510, transparent: true, opacity: 0.75 });
    const bigFlameMat = new THREE.MeshBasicMaterial({ color: 0xFF3300, transparent: true, opacity: 0.65 });
    const flameGeo    = new THREE.ConeGeometry(0.5, 1.8, 6);
    const bigFlameGeo = new THREE.ConeGeometry(0.9, 3.0, 6);
    const firePositions = [
      { x: -18, z: -13, size: 'big', h: 0.9 },
      { x:   2, z:  15, size: 'big', h: 0.9 },
      { x:  21, z: -13, size: 'big', h: 0.9 },
      { x: -10, z:   8, size: 'small', h: 0.6 },
      { x:   8, z:  -8, size: 'small', h: 0.6 },
      { x:  16, z:   7, size: 'small', h: 0.6 },
    ];
    for (const { x, z, size, h } of firePositions) {
      const isBig = size === 'big';
      const flame = new THREE.Mesh(isBig ? bigFlameGeo : flameGeo, isBig ? bigFlameMat : flameMat);
      flame.position.set(x, h, z);
      this._scene.add(flame); this._objects.push(flame);
      const light = new THREE.PointLight(isBig ? 0xFF3300 : 0xFF5510, isBig ? 3.5 : 2.0, isBig ? 18 : 10);
      light.position.set(x, h + 1, z);
      this._scene.add(light); this._lights.push(light);
    }
  }

  _addSearchlights() {
    // Rotating searchlight beams — static cones to simulate sweep
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xCCEEFF, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
    const beamGeo = new THREE.CylinderGeometry(0.05, 3.5, 28, 8, 1, true);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x606068, roughness: 0.6, metalness: 0.55 });
    const slConfigs = [{ x: -30, z: 0, ry: 0.3 }, { x: 35, z: 0, ry: -0.4 }];
    for (const { x, z, ry } of slConfigs) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const pole = new THREE.Mesh(_lightPoleGeo, poleMat);
      pole.position.y = 3; g.add(pole);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 20, 0); beam.rotation.set(ry, 0, 0.15);
      g.add(beam);
      const spot = new THREE.SpotLight(0xCCEEFF, 2.5, 60, Math.PI / 14, 0.3);
      spot.position.set(0, 6, 0); spot.target.position.set(8, 0, 5); g.add(spot); g.add(spot.target);
      this._scene.add(g); this._objects.push(g);
    }
  }

  // ── Shared decoration helpers ─────────────────────────────────────────────

  _addCoverObjects() {
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xB8A06A, roughness: 0.97 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x96834A, roughness: 0.98 });
    const positions = [
      [-10, -10, 0], [-10, 10, 0], [-5, -12, 0.5], [-5, 12, 0.5],
      [5, -11, 1.0], [5, 11, 1.0], [10, -10, 1.5], [10, 10, 1.5],
    ];
    for (const [x, z, rotY] of positions) {
      const group = new THREE.Group();
      group.position.set(x, 0, z); group.rotation.y = rotY;
      const base = new THREE.Mesh(_sandbagBaseGeo, sandMat);
      base.position.y = 0.21; base.castShadow = true; base.receiveShadow = true; group.add(base);
      const bagL = new THREE.Mesh(_sandbagSideGeo, darkMat); bagL.position.set(-0.76, 0.21, 0); group.add(bagL);
      const bagR = new THREE.Mesh(_sandbagSideGeo, darkMat); bagR.position.set(0.76, 0.21, 0); group.add(bagR);
      const top = new THREE.Mesh(_sandbagTopGeo, sandMat); top.position.y = 0.63; top.castShadow = true; group.add(top);
      this._scene.add(group); this._objects.push(group);
    }
  }

  _addDunes() {
    const mat = new THREE.MeshStandardMaterial({ color: COLOR.desertDark, roughness: 0.99 });
    const positions = [
      [-18,-14],[-18,14],[-8,-16],[-8,16],[2,-15],[2,15],
      [12,-13],[12,13],[20,-16],[20,16],[-3,0],[15,0],
      [-26,-12],[-26,12],[28,-14],[28,14],
    ];
    for (const [x, z] of positions) {
      const dune = new THREE.Mesh(_duneGeo, mat);
      const sx = 0.85 + Math.abs((x * z) % 7) * 0.04;
      const sz = 0.72 + Math.abs((x + z) % 5) * 0.06;
      dune.scale.set(sx, 1, sz);
      dune.position.set(x, 0, z); dune.castShadow = true; dune.receiveShadow = true;
      this._scene.add(dune); this._objects.push(dune);
    }
  }

  _addDesertRocks() {
    const mat     = new THREE.MeshStandardMaterial({ color: 0x9A8060, roughness: 0.95, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x6A5840, roughness: 0.97 });
    const configs = [
      {x:-22,z:-12,s:1.2,r:0.3},{x:-22,z:12,s:0.9,r:0.8},{x:-9,z:-14,s:0.7,r:0.5},
      {x:4,z:13,s:1.4,r:1.1},{x:14,z:-15,s:0.8,r:0.2},{x:20,z:11,s:1.1,r:1.6},
      {x:25,z:-13,s:1.5,r:0.9},{x:-15,z:0,s:0.6,r:0.4},{x:8,z:-1,s:0.5,r:1.2},
    ];
    for (const {x,z,s,r} of configs) {
      const rock = new THREE.Mesh(_rockGeo, mat);
      rock.scale.set(s, s*0.65, s*0.9); rock.position.set(x, s*0.32, z); rock.rotation.y = r;
      rock.castShadow = true; rock.receiveShadow = true;
      this._scene.add(rock); this._objects.push(rock);
      const rock2 = new THREE.Mesh(_rockGeo, darkMat);
      const s2 = s*0.45; rock2.scale.set(s2, s2*0.6, s2);
      rock2.position.set(x+s*0.9, s2*0.3, z+s*0.5); rock2.rotation.y = r+1.2; rock2.castShadow = true;
      this._scene.add(rock2); this._objects.push(rock2);
    }
  }

  _addPalms() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6830, roughness: 0.95 });
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x4A8A28, roughness: 0.85 });
    const positions = [[-24,-17],[-24,17],[-14,-18],[-14,18],[0,-18],[0,18],[16,-17],[16,17],[24,-18]];
    for (const [x, z] of positions) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(_palmTrunkGeo, trunkMat);
      trunk.position.y = 2.25; trunk.rotation.z = z > 0 ? -0.08 : 0.08; trunk.castShadow = true; g.add(trunk);
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(_palmLeafGeo, leafMat);
        leaf.position.set(Math.cos(angle)*0.9, 4.6, Math.sin(angle)*0.9);
        leaf.rotation.z = Math.PI * 0.28; leaf.rotation.y = -angle; leaf.castShadow = true; g.add(leaf);
      }
      const top = new THREE.Mesh(_palmLeafGeo, leafMat); top.position.y = 5.1; top.scale.setScalar(0.6); g.add(top);
      g.position.set(x, 0, z);
      this._scene.add(g); this._objects.push(g);
    }
  }

  _addPyramid() {
    const mat     = new THREE.MeshStandardMaterial({ color: 0xC8A855, roughness: 0.90, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0xA88835, roughness: 0.92 });
    const pyr = new THREE.Mesh(_pyramidGeo, mat);
    pyr.rotation.y = Math.PI / 4; pyr.position.set(28, 2.5, -22);
    pyr.castShadow = true; pyr.receiveShadow = true;
    this._scene.add(pyr); this._objects.push(pyr);
    const pyr2 = new THREE.Mesh(_pyramidGeo, darkMat);
    pyr2.rotation.y = Math.PI / 4; pyr2.scale.setScalar(0.55); pyr2.position.set(22, 1.4, -24);
    pyr2.castShadow = true;
    this._scene.add(pyr2); this._objects.push(pyr2);
  }

  _addTrees() {
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2D6E27, roughness: 0.90 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.95 });
    const positions = [
      [-22,-18],[-22,18],[-16,-17],[-16,17],[-9,-18],[-9,18],
      [-1,-18],[-1,18],[6,-17],[6,17],[13,-18],[13,18],[19,-17],[19,17],[26,-18],[26,18],
    ];
    for (const [x, z] of positions) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(_trunkGeo, trunkMat); trunk.position.y = 0.75; trunk.castShadow = true;
      const scale = 0.85 + Math.abs((x*7+z*3)%10)*0.032;
      const leaves = new THREE.Mesh(_treeGeo, leafMat); leaves.position.y = 3.0; leaves.scale.setScalar(scale); leaves.castShadow = true;
      g.add(trunk); g.add(leaves); g.position.set(x, 0, z);
      this._scene.add(g); this._objects.push(g);
    }
  }

  _addEdgeBushes(color = 0x4A8A3A) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const positions = [[-14,-17],[-14,17],[-6,-18],[-6,18],[3,-17],[3,17],[11,-18],[11,18],[20,-17],[20,17]];
    for (const [x, z] of positions) {
      const bush = new THREE.Mesh(_bushGeo, mat);
      const s = 0.75 + Math.abs((x+z)%5)*0.07;
      bush.scale.set(s, s*0.7, s); bush.position.set(x, 0.38, z); bush.castShadow = true;
      this._scene.add(bush); this._objects.push(bush);
    }
  }

  _addBuildings() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x7A7A88, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4A4A56, roughness: 0.80 });
    const winMat  = new THREE.MeshStandardMaterial({ color: 0x1A3A5C, roughness: 0.3, metalness: 0.4 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3A2A1A, roughness: 0.90 });
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x888898, roughness: 0.90 });
    const configs = [
      {x:-18,z:-16,w:4,h:6,d:4},{x:-18,z:16,w:4,h:5,d:4},
      {x:-11,z:-17,w:3,h:7,d:3.5},{x:-11,z:17,w:4,h:5,d:3.5},
      {x:-2,z:-18,w:3.5,h:8,d:4},{x:-2,z:18,w:3.5,h:6,d:4},
      {x:8,z:-17,w:4,h:5,d:4},{x:8,z:17,w:4,h:7,d:4},
      {x:16,z:-16,w:3.5,h:6,d:3.5},{x:16,z:16,w:3.5,h:5,d:3.5},
      {x:22,z:-17,w:4,h:8,d:4},{x:22,z:17,w:4,h:6,d:4},
    ];
    for (const {x,z,w,h,d} of configs) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
      body.position.y = h/2; body.castShadow = true; body.receiveShadow = true; g.add(body);
      const roof = new THREE.Mesh(_roofEdgeGeo, roofMat);
      roof.scale.set(w/4, 1, d/4); roof.position.y = h+0.11; roof.castShadow = true; g.add(roof);
      const facingZ = z < 0 ? 1 : -1;
      const winZ = (d/2+0.05)*facingZ;
      const rows = Math.max(1, Math.floor(h/3)-1);
      const cols = Math.floor(w/1.8);
      for (let row=0; row<rows; row++) {
        for (let col=0; col<cols; col++) {
          const wx = -((cols-1)/2)*1.5+col*1.5;
          const wy = 1.5+row*2.5;
          if (wy+0.5 > h-0.3) continue;
          const win = new THREE.Mesh(_windowGeo, winMat);
          win.position.set(wx, wy, winZ); if (facingZ<0) win.rotation.y = Math.PI; g.add(win);
        }
      }
      const door = new THREE.Mesh(_doorGeo, doorMat);
      door.position.set(0, 0.55, winZ*1.01); if (facingZ<0) door.rotation.y = Math.PI; g.add(door);
      const step = new THREE.Mesh(_stepGeo, stepMat);
      step.position.set(0, 0.09, winZ+(facingZ>0?0.3:-0.3)); g.add(step);
      this._scene.add(g); this._objects.push(g);
    }
    this._addEdgeBushes(0x3A5A30);
  }

  // ── Vertex coloring helpers ───────────────────────────────────────────────

  _applyGrassVertexColors(geo, baseHex, overrides) {
    const base  = new THREE.Color(baseHex);
    const dark  = overrides?.[0] ?? new THREE.Color(0x3E8E35);
    const light = overrides?.[1] ?? new THREE.Color(0x72CC60);
    const dry   = overrides?.[2] ?? new THREE.Color(0x8AAA55);
    const pos   = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const n1 = Math.sin(x*0.18+y*0.22)*0.5+0.5;
      const n2 = Math.sin(x*0.07-y*0.13+2.4)*0.5+0.5;
      const n3 = Math.sin(x*0.31+y*0.09-1.1)*0.5+0.5;
      const c = base.clone();
      if (n1>0.65) c.lerp(dark,(n1-0.65)*2.0); else if (n1<0.35) c.lerp(light,(0.35-n1)*1.8);
      if (n2>0.7)  c.lerp(dry,(n2-0.7)*1.5);
      c.lerp(n3>0.5?light:dark,(Math.abs(n3-0.5))*0.18);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _applyRoadVertexColors(geo) {
    const base=new THREE.Color(0x6B625A),dark=new THREE.Color(0x4A4238),light=new THREE.Color(0xA89880),mud=new THREE.Color(0x5A5045);
    const pos=geo.attributes.position, colors=new Float32Array(pos.count*3);
    for (let i=0;i<pos.count;i++) {
      const x=pos.getX(i),y=pos.getY(i);
      const rutL=Math.exp(-Math.pow((y-1.6)/0.4,2)),rutR=Math.exp(-Math.pow((y+1.6)/0.4,2));
      const rut=Math.max(rutL,rutR),centre=Math.exp(-Math.pow(y/0.7,2));
      const n1=Math.sin(x*0.12+y*0.5)*0.5+0.5,n2=Math.sin(x*0.07+1.3)*0.5+0.5,n3=Math.sin(x*0.35-y*0.3+2.1)*0.5+0.5;
      const c=base.clone();
      c.lerp(dark,rut*0.65); c.lerp(light,centre*0.35);
      if(n2>0.55)c.lerp(mud,(n2-0.55)*1.4); if(n1>0.60)c.lerp(light,(n1-0.60)*1.8); if(n3>0.75)c.lerp(dark,(n3-0.75)*1.2);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _applyNightRoadVertexColors(geo) {
    const base=new THREE.Color(0x3A3630),dark=new THREE.Color(0x262220),light=new THREE.Color(0x4E4A40);
    const pos=geo.attributes.position, colors=new Float32Array(pos.count*3);
    for (let i=0;i<pos.count;i++) {
      const x=pos.getX(i),y=pos.getY(i);
      const rut=Math.max(Math.exp(-Math.pow((y-1.6)/0.5,2)),Math.exp(-Math.pow((y+1.6)/0.5,2)));
      const n=Math.sin(x*0.14+y*0.4)*0.5+0.5;
      const c=base.clone();
      c.lerp(dark,rut*0.7); if(n>0.65)c.lerp(light,(n-0.65)*1.5);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _applySandstormTrackColors(geo) {
    const base=new THREE.Color(0x8A6530),dark=new THREE.Color(0x6A4A20),light=new THREE.Color(0xA87840);
    const pos=geo.attributes.position, colors=new Float32Array(pos.count*3);
    for (let i=0;i<pos.count;i++) {
      const x=pos.getX(i),y=pos.getY(i);
      const rut=Math.max(Math.exp(-Math.pow((y-1.4)/0.5,2)),Math.exp(-Math.pow((y+1.4)/0.5,2)));
      const n=Math.sin(x*0.11+y*0.3)*0.5+0.5;
      const c=base.clone();
      c.lerp(dark,rut*0.55); if(n>0.6)c.lerp(light,(n-0.6)*1.2);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _applyConcreteVertexColors(geo) {
    const base=new THREE.Color(0x6A6870),dark=new THREE.Color(0x4A484E),light=new THREE.Color(0x8A8890),stain=new THREE.Color(0x3A3840);
    const pos=geo.attributes.position, colors=new Float32Array(pos.count*3);
    for (let i=0;i<pos.count;i++) {
      const x=pos.getX(i),y=pos.getY(i);
      const n1=Math.sin(x*0.22+y*0.18)*0.5+0.5,n2=Math.sin(x*0.09-y*0.21+1.8)*0.5+0.5,n3=Math.sin(x*0.41+y*0.15-0.9)*0.5+0.5;
      const c=base.clone();
      if(n1>0.68)c.lerp(dark,(n1-0.68)*2.2); else if(n1<0.32)c.lerp(light,(0.32-n1)*1.6);
      if(n2>0.72)c.lerp(stain,(n2-0.72)*2.5);
      c.lerp(n3>0.5?light:dark,(Math.abs(n3-0.5))*0.12);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _applyUrbanRoadVertexColors(geo, scorched=false) {
    const base  = new THREE.Color(scorched ? 0x303035 : 0x484848);
    const dark  = new THREE.Color(scorched ? 0x222228 : 0x303030);
    const light = new THREE.Color(scorched ? 0x3E3C48 : 0x5A5A60);
    const crack = new THREE.Color(scorched ? 0x282630 : 0x282828);
    const pos=geo.attributes.position, colors=new Float32Array(pos.count*3);
    for (let i=0;i<pos.count;i++) {
      const x=pos.getX(i),y=pos.getY(i);
      const n1=Math.sin(x*0.25+y*0.35)*0.5+0.5,n2=Math.sin(x*0.08+y*0.12+2.2)*0.5+0.5;
      const cracks=Math.exp(-Math.pow(Math.sin(x*0.45+y*0.3)*3,2));
      const c=base.clone();
      if(n1>0.65)c.lerp(dark,(n1-0.65)*1.4); if(n2<0.3)c.lerp(light,(0.3-n2)*1.4);
      c.lerp(crack,cracks*0.28);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _applyScorchedConcreteVertexColors(geo) {
    const base=new THREE.Color(0x363440),dark=new THREE.Color(0x222028),light=new THREE.Color(0x4A4858),burn=new THREE.Color(0x201E24);
    const pos=geo.attributes.position, colors=new Float32Array(pos.count*3);
    for (let i=0;i<pos.count;i++) {
      const x=pos.getX(i),y=pos.getY(i);
      const n1=Math.sin(x*0.20+y*0.17)*0.5+0.5,n2=Math.sin(x*0.11-y*0.25+1.4)*0.5+0.5,n3=Math.sin(x*0.38+y*0.22-1.0)*0.5+0.5;
      const c=base.clone();
      if(n1>0.66)c.lerp(dark,(n1-0.66)*1.8); else if(n1<0.34)c.lerp(light,(0.34-n1)*1.5);
      if(n2>0.74)c.lerp(burn,(n2-0.74)*1.8);
      c.lerp(n3>0.5?light:burn,(Math.abs(n3-0.5))*0.18);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _applyWaterVertexColors(geo, lightHex=0x3CAEE5, darkHex=0x1A7AAA) {
    const light=new THREE.Color(lightHex),dark=new THREE.Color(darkHex),foam=new THREE.Color(0x88CCEE);
    const pos=geo.attributes.position, colors=new Float32Array(pos.count*3);
    for (let i=0;i<pos.count;i++) {
      const x=pos.getX(i),y=pos.getY(i);
      const wave=Math.sin(x*0.22+y*0.38)*0.5+0.5;
      const ripple=Math.sin(x*0.55-y*0.28+1.1)*0.5+0.5;
      const c=dark.clone();
      c.lerp(light, wave*0.55);
      if(ripple>0.78)c.lerp(foam,(ripple-0.78)*3.5);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  /** Helper: add mesh with optional setup callback, register for disposal. */
  _add(mesh, setup) {
    if (setup) setup(mesh);
    this._scene.add(mesh);
    this._objects.push(mesh);
  }

  dispose() {
    for (const obj of this._objects) {
      this._scene.remove(obj);
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    for (const light of this._lights) {
      this._scene.remove(light);
    }
    this._objects = [];
    this._lights  = [];
    this._animatedObjects = [];
    this._scene.background = new THREE.Color(COLOR.skyDay);
    this._scene.fog = new THREE.Fog(COLOR.skyDay, 65, 140);
    // Restore sun to defaults
    if (this._sun) {
      this._sun.intensity = 1.6;
      this._sun.color.setHex(0xFFF4D0);
    }
  }
}
