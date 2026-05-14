import * as THREE from 'three';

const COLOR = {
  groundBase:   0x5FBD52,
  road:         0x6B625A,
  water:        0x3CAEE5,
  skyDay:       0x8EC7FF,
  skyNight:     0x0a1025,
  desertGround: 0xC8A96E,
  desertDark:   0xB8955A,
  desertSky:    0xE8C87A,
  forestGround: 0x3D7A36,
  forestSky:    0x6BA8D4,
  urbanGround:  0x555560,
  urbanSky:     0x9AADCC,
};

// Shared geometry — created once
const _groundGeo   = new THREE.PlaneGeometry(160, 60);
const _riverGeo    = new THREE.PlaneGeometry(160, 4);
const _bridgeGeo   = new THREE.BoxGeometry(160, 0.12, 9);
// Sandbag barrier: wide flat base + slightly smaller top row
const _sandbagBaseGeo = new THREE.BoxGeometry(2.2, 0.42, 0.72);
const _sandbagTopGeo  = new THREE.BoxGeometry(1.8, 0.38, 0.62);
const _sandbagSideGeo = new THREE.BoxGeometry(0.68, 0.42, 0.72);
const _roadGeo     = new THREE.PlaneGeometry(160, 9);
const _duneGeo     = new THREE.CylinderGeometry(0, 3.5, 1.8, 8);
const _treeGeo     = new THREE.CylinderGeometry(0, 1.2, 3, 6);
const _trunkGeo    = new THREE.CylinderGeometry(0.25, 0.25, 1.5, 6);
const _bushGeo     = new THREE.SphereGeometry(0.65, 7, 5);
// Desert props
const _palmTrunkGeo  = new THREE.CylinderGeometry(0.18, 0.24, 4.5, 7);
const _palmLeafGeo   = new THREE.ConeGeometry(1.6, 1.0, 6);
const _rockGeo       = new THREE.DodecahedronGeometry(1.0, 0);
const _pyramidGeo    = new THREE.ConeGeometry(6, 5, 4);
const _windowGeo   = new THREE.BoxGeometry(0.6, 0.65, 0.08);
const _doorGeo     = new THREE.BoxGeometry(0.7, 1.1, 0.09);
const _stepGeo     = new THREE.BoxGeometry(1.2, 0.18, 0.5);
const _roofEdgeGeo = new THREE.BoxGeometry(4.3, 0.22, 4.3);

/**
 * World — builds static scene: terrain, lighting, setting-specific objects.
 * Call build(setting) to populate. Call dispose() to clear for next map.
 */
export class World {
  constructor() {
    this._scene   = null;
    this._objects = [];
    this._sun     = null;
  }

  init(scene) {
    this._scene = scene;
    this._buildLighting(scene);
  }

  _buildLighting(scene) {
    // Warm afternoon sun with soft shadows
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

    // Sky-blue top, warm-brown ground: gives units natural top/bottom shading
    const hemi = new THREE.HemisphereLight(0xB4D4F5, 0x8B7040, 0.75);
    scene.add(hemi);

    // Soft blue fill from opposite side — keeps shadows from going pitch black
    const fill = new THREE.DirectionalLight(0xCCDDFF, 0.35);
    fill.position.set(18, 22, -12);
    scene.add(fill);
  }

  /**
   * Build the terrain for a given setting.
   * @param {string} setting - 'bridge' | 'desert' | 'forest' | 'urban'
   * @param {THREE.Scene} _scene - ignored, uses this._scene
   * @param {string} [lightingOverride] - 'night' for night maps
   */
  build(setting, _scene, lightingOverride) {
    if (lightingOverride === 'night') {
      this._applyNightLighting();
    }
    switch (setting) {
      case 'bridge': this._buildBridge(); break;
      case 'desert': this._buildDesert(); break;
      case 'forest': this._buildForest(); break;
      case 'urban':  this._buildUrban();  break;
      default:       this._buildBridge(); break;
    }
  }

  _applyNightLighting() {
    this._scene.background = new THREE.Color(COLOR.skyNight);
    this._scene.fog = new THREE.Fog(COLOR.skyNight, 40, 100);
    if (this._sun) {
      this._sun.intensity = 0.3;
      this._sun.color.setHex(0x8090C0);
    }
  }

  _buildBridge() {
    this._scene.background = new THREE.Color(COLOR.skyDay);
    this._scene.fog = new THREE.Fog(COLOR.skyDay, 60, 130);

    // Vertex-colored grass ground — 48×18 segments for organic variation
    const groundGeo = new THREE.PlaneGeometry(160, 60, 48, 18);
    this._applyGrassVertexColors(groundGeo, 0x5FBD52);
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.01;
    this._scene.add(ground);
    this._objects.push(ground);

    this._add(new THREE.Mesh(_riverGeo, new THREE.MeshStandardMaterial({ color: COLOR.water, roughness: 0.15, metalness: 0.3 })),
      m => { m.rotation.x = -Math.PI / 2; m.position.y = -0.005; });

    const roadGeo = new THREE.PlaneGeometry(160, 9, 80, 20);
    this._applyRoadVertexColors(roadGeo);
    const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.001;
    road.receiveShadow = true;
    this._scene.add(road);
    this._objects.push(road);

    this._add(new THREE.Mesh(_bridgeGeo, new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.88 })),
      m => { m.position.y = 0.06; m.receiveShadow = true; m.castShadow = true; });

    this._addCoverObjects();
    this._addEdgeBushes();
  }

  _applyRoadVertexColors(geo) {
    const base  = new THREE.Color(0x6B625A); // main dirt/gravel
    const dark  = new THREE.Color(0x2E2820); // deep muddy ruts — much darker
    const light = new THREE.Color(0xA89880); // pale dry gravel — much lighter
    const mud   = new THREE.Color(0x3A3028); // muddy patches

    const pos    = geo.attributes.position;
    const count  = pos.count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i); // along road length
      const y = pos.getY(i); // across road width (-4.5 to +4.5)

      // Wheel ruts: two dark stripes at ±1.6 units from centre
      const rutL = Math.exp(-Math.pow((y - 1.6) / 0.4, 2));
      const rutR = Math.exp(-Math.pow((y + 1.6) / 0.4, 2));
      const rut  = Math.max(rutL, rutR);

      // Centre strip: slightly lighter (less traffic)
      const centre = Math.exp(-Math.pow(y / 0.7, 2));

      // Along-road variation
      const n1 = Math.sin(x * 0.12 + y * 0.5)  * 0.5 + 0.5;
      const n2 = Math.sin(x * 0.07 + 1.3)       * 0.5 + 0.5; // long mud patches
      const n3 = Math.sin(x * 0.35 - y * 0.3 + 2.1) * 0.5 + 0.5;

      const c = base.clone();
      c.lerp(dark,  rut * 0.85);            // ruts very dark
      c.lerp(light, centre * 0.35);         // centre strip lighter
      if (n2 > 0.55) c.lerp(mud,   (n2 - 0.55) * 2.2);   // mud patches
      if (n1 > 0.60) c.lerp(light, (n1 - 0.60) * 1.8);   // gravel highlights
      if (n3 > 0.75) c.lerp(dark,  (n3 - 0.75) * 3.0);   // dark pebbles

      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _applyGrassVertexColors(geo, baseHex, overrides) {
    const base = new THREE.Color(baseHex);
    const dark  = overrides?.[0] ?? new THREE.Color(0x3E8E35);
    const light = overrides?.[1] ?? new THREE.Color(0x72CC60);
    const dry   = overrides?.[2] ?? new THREE.Color(0x8AAA55);

    const pos    = geo.attributes.position;
    const count  = pos.count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // this is Z in world space (plane is XY before rotation)

      // Two overlapping low-frequency sine waves → organic patches, no randomness
      const n1 = Math.sin(x * 0.18 + y * 0.22) * 0.5 + 0.5;          // 0–1
      const n2 = Math.sin(x * 0.07 - y * 0.13 + 2.4) * 0.5 + 0.5;    // 0–1
      const n3 = Math.sin(x * 0.31 + y * 0.09 - 1.1) * 0.5 + 0.5;    // fine detail

      // Blend between base colors based on noise values
      const c = base.clone();
      if (n1 > 0.65)       c.lerp(dark,  (n1 - 0.65) * 2.0);
      else if (n1 < 0.35)  c.lerp(light, (0.35 - n1) * 1.8);
      if (n2 > 0.7)        c.lerp(dry,   (n2 - 0.7)  * 1.5);
      c.lerp(n3 > 0.5 ? light : dark, (Math.abs(n3 - 0.5)) * 0.18); // subtle fine grain

      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _buildDesert() {
    this._scene.background = new THREE.Color(COLOR.desertSky);
    this._scene.fog = new THREE.Fog(COLOR.desertSky, 60, 130);

    const geoD = new THREE.PlaneGeometry(160, 60, 48, 18);
    this._applyGrassVertexColors(geoD, COLOR.desertGround, [
      new THREE.Color(0xA8884A), // darker dune shadow
      new THREE.Color(0xE8D090), // bright sunlit sand
      new THREE.Color(0xD4B870), // warm dry patch
    ]);
    const matD = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const meshD = new THREE.Mesh(geoD, matD);
    meshD.rotation.x = -Math.PI / 2;
    meshD.receiveShadow = true;
    meshD.position.y = -0.01;
    this._scene.add(meshD);
    this._objects.push(meshD);

    this._addDunes();
    this._addDesertRocks();
    this._addPalms();
    this._addPyramid();
  }

  _buildForest() {
    this._scene.background = new THREE.Color(COLOR.forestSky);
    this._scene.fog = new THREE.Fog(COLOR.forestSky, 50, 110);

    const geoF = new THREE.PlaneGeometry(160, 60, 48, 18);
    this._applyGrassVertexColors(geoF, COLOR.forestGround, [
      new THREE.Color(0x1E4A1A), // dark undergrowth shadow
      new THREE.Color(0x52A045), // bright sunlit patch
      new THREE.Color(0x6A8A30), // mossy yellow-green
    ]);
    const matF = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const meshF = new THREE.Mesh(geoF, matF);
    meshF.rotation.x = -Math.PI / 2;
    meshF.receiveShadow = true;
    meshF.position.y = -0.01;
    this._scene.add(meshF);
    this._objects.push(meshF);

    const roadGeoF = new THREE.PlaneGeometry(160, 9, 80, 20);
    this._applyRoadVertexColors(roadGeoF);
    const roadMatF = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 });
    const roadF = new THREE.Mesh(roadGeoF, roadMatF);
    roadF.rotation.x = -Math.PI / 2;
    roadF.position.y = 0.001;
    roadF.receiveShadow = true;
    this._scene.add(roadF);
    this._objects.push(roadF);

    this._addTrees();
    this._addEdgeBushes(0x2A5E22);
  }

  _buildUrban() {
    this._scene.background = new THREE.Color(COLOR.urbanSky);
    this._scene.fog = new THREE.Fog(COLOR.urbanSky, 55, 120);

    this._add(new THREE.Mesh(_groundGeo, new THREE.MeshStandardMaterial({ color: COLOR.urbanGround })),
      m => { m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.position.y = -0.01; });

    this._add(new THREE.Mesh(_roadGeo, new THREE.MeshStandardMaterial({ color: 0x484848 })),
      m => { m.rotation.x = -Math.PI / 2; m.position.y = 0.001; });

    this._addBuildings();
  }

  _addCoverObjects() {
    // Sandbag barriers: tan/olive colored, low and wide — clearly readable as cover
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xB8A06A, roughness: 0.97, metalness: 0.0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x96834A, roughness: 0.98, metalness: 0.0 });

    const positions = [
      [-10, -10, 0],   [-10,  10, 0],
      [ -5, -12, 0.5], [ -5,  12, 0.5],
      [  5, -11, 1.0], [  5,  11, 1.0],
      [ 10, -10, 1.5], [ 10,  10, 1.5],
    ];

    for (const [x, z, rotY] of positions) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = rotY;

      // Bottom row — 3 bags side by side
      const base = new THREE.Mesh(_sandbagBaseGeo, sandMat);
      base.position.y = 0.21;
      base.castShadow = true; base.receiveShadow = true;
      group.add(base);

      // Left end bag (slightly darker for depth)
      const bagL = new THREE.Mesh(_sandbagSideGeo, darkMat);
      bagL.position.set(-0.76, 0.21, 0);
      group.add(bagL);

      const bagR = new THREE.Mesh(_sandbagSideGeo, darkMat);
      bagR.position.set(0.76, 0.21, 0);
      group.add(bagR);

      // Top row — narrower, centered
      const top = new THREE.Mesh(_sandbagTopGeo, sandMat);
      top.position.y = 0.63;
      top.castShadow = true;
      group.add(top);

      this._scene.add(group);
      this._objects.push(group);
    }
  }

  _addDunes() {
    const mat = new THREE.MeshStandardMaterial({ color: COLOR.desertDark });
    const positions = [
      [-18, -14], [-18, 14], [-8, -16], [-8, 16],
      [2, -15], [2, 15], [12, -13], [12, 13],
      [20, -16], [20, 16], [-3, 0], [15, 0],
    ];
    for (const [x, z] of positions) {
      const dune = new THREE.Mesh(_duneGeo, mat);
      const sx = 0.8 + Math.abs((x * z) % 7) * 0.04;
      const sz = 0.7 + Math.abs((x + z) % 5) * 0.06;
      dune.scale.set(sx, 1, sz);
      dune.position.set(x, 0, z);
      dune.castShadow = true;
      dune.receiveShadow = true;
      this._scene.add(dune);
      this._objects.push(dune);
    }
  }

  _addDesertRocks() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x9A8060, roughness: 0.95, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x6A5840, roughness: 0.97 });
    // Small clusters of rocks — only at edges, a few scattered mid-field
    const configs = [
      { x: -22, z: -12, s: 1.2, r: 0.3  },
      { x: -22, z:  12, s: 0.9, r: 0.8  },
      { x:  -9, z: -14, s: 0.7, r: 0.5  },
      { x:   4, z:  13, s: 1.4, r: 1.1  },
      { x:  14, z: -15, s: 0.8, r: 0.2  },
      { x:  20, z:  11, s: 1.1, r: 1.6  },
      { x:  25, z: -13, s: 1.5, r: 0.9  },
      { x: -15, z:   0, s: 0.6, r: 0.4  }, // lone mid-field rock
      { x:   8, z:  -1, s: 0.5, r: 1.2  },
    ];
    for (const { x, z, s, r } of configs) {
      // Main rock
      const rock = new THREE.Mesh(_rockGeo, mat);
      rock.scale.set(s, s * 0.65, s * 0.9);
      rock.position.set(x, s * 0.32, z);
      rock.rotation.y = r;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this._scene.add(rock);
      this._objects.push(rock);

      // Small companion rock next to it
      const rock2 = new THREE.Mesh(_rockGeo, darkMat);
      const s2 = s * 0.45;
      rock2.scale.set(s2, s2 * 0.6, s2);
      rock2.position.set(x + s * 0.9, s2 * 0.3, z + s * 0.5);
      rock2.rotation.y = r + 1.2;
      rock2.castShadow = true;
      this._scene.add(rock2);
      this._objects.push(rock2);
    }
  }

  _addPalms() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6830, roughness: 0.95 });
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x4A8A28, roughness: 0.85 });
    // Only at outer edge
    const positions = [
      [-24, -17], [-24, 17], [-14, -18], [-14, 18],
      [  0, -18], [  0, 18], [ 16, -17], [ 16, 17],
      [ 24, -18],
    ];
    for (const [x, z] of positions) {
      const group = new THREE.Group();
      // Trunk — slight lean toward centre
      const trunk = new THREE.Mesh(_palmTrunkGeo, trunkMat);
      trunk.position.y = 2.25;
      const leanX = z > 0 ? -0.08 : 0.08;
      trunk.rotation.z = leanX;
      trunk.castShadow = true;
      group.add(trunk);

      // Fan of 5 leaf cones at top, rotated outward
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(_palmLeafGeo, leafMat);
        const angle = (i / 5) * Math.PI * 2;
        leaf.position.set(
          Math.cos(angle) * 0.9,
          4.6,
          Math.sin(angle) * 0.9,
        );
        leaf.rotation.z = Math.PI * 0.28; // droop outward
        leaf.rotation.y = -angle;
        leaf.castShadow = true;
        group.add(leaf);
      }
      // Centre top tuft
      const top = new THREE.Mesh(_palmLeafGeo, leafMat);
      top.position.y = 5.1;
      top.scale.setScalar(0.6);
      group.add(top);

      group.position.set(x, 0, z);
      this._scene.add(group);
      this._objects.push(group);
    }
  }

  _addPyramid() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xC8A855, roughness: 0.9, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0xA88835, roughness: 0.92 });

    // Main pyramid — far background corner, not in combat area
    const pyr = new THREE.Mesh(_pyramidGeo, mat);
    pyr.rotation.y = Math.PI / 4; // align edges with cardinal axes
    pyr.position.set(28, 2.5, -22);
    pyr.castShadow = true;
    pyr.receiveShadow = true;
    this._scene.add(pyr);
    this._objects.push(pyr);

    // Smaller companion pyramid nearby
    const pyr2 = new THREE.Mesh(_pyramidGeo, darkMat);
    pyr2.rotation.y = Math.PI / 4;
    pyr2.scale.setScalar(0.55);
    pyr2.position.set(22, 1.4, -24);
    pyr2.castShadow = true;
    this._scene.add(pyr2);
    this._objects.push(pyr2);
  }

  _addTrees() {
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2D6E27, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.95 });
    // Trees only at outer edge (|z| >= 16) — don't clutter the battlefield
    const positions = [
      [-22,-18],[-22,18],[-16,-17],[-16,17],[-9,-18],[-9,18],
      [-1,-18],[-1,18],[6,-17],[6,17],[13,-18],[13,18],
      [19,-17],[19,17],[26,-18],[26,18],
    ];
    for (const [x, z] of positions) {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(_trunkGeo, trunkMat);
      trunk.position.y = 0.75;
      trunk.castShadow = true;
      // Slight size variation per tree
      const scale = 0.85 + Math.abs((x * 7 + z * 3) % 10) * 0.032;
      const leaves = new THREE.Mesh(_treeGeo, leafMat);
      leaves.position.y = 3.0;
      leaves.scale.setScalar(scale);
      leaves.castShadow = true;
      group.add(trunk);
      group.add(leaves);
      group.position.set(x, 0, z);
      this._scene.add(group);
      this._objects.push(group);
    }
  }

  _addEdgeBushes(color = 0x4A8A3A) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    // Sparse bushes only at the z-edges of the map
    const positions = [
      [-14,-17],[-14,17],[-6,-18],[-6,18],
      [3,-17],[3,17],[11,-18],[11,18],[20,-17],[20,17],
    ];
    for (const [x, z] of positions) {
      const bush = new THREE.Mesh(_bushGeo, mat);
      const s = 0.75 + Math.abs((x + z) % 5) * 0.07;
      bush.scale.set(s, s * 0.7, s);
      bush.position.set(x, 0.38, z);
      bush.castShadow = true;
      this._scene.add(bush);
      this._objects.push(bush);
    }
  }

  _addBuildings() {
    const wallMat  = new THREE.MeshStandardMaterial({ color: 0x7A7A88, roughness: 0.85 });
    const roofMat  = new THREE.MeshStandardMaterial({ color: 0x4A4A56, roughness: 0.8  });
    const winMat   = new THREE.MeshStandardMaterial({ color: 0x1A3A5C, roughness: 0.3, metalness: 0.4 });
    const doorMat  = new THREE.MeshStandardMaterial({ color: 0x3A2A1A, roughness: 0.9 });
    const stepMat  = new THREE.MeshStandardMaterial({ color: 0x888898, roughness: 0.9 });

    // Buildings at outer edge only — leave centre lane clear for combat
    const configs = [
      { x: -18, z: -16, w: 4, h: 6, d: 4 },
      { x: -18, z:  16, w: 4, h: 5, d: 4 },
      { x: -11, z: -17, w: 3, h: 7, d: 3.5 },
      { x: -11, z:  17, w: 4, h: 5, d: 3.5 },
      { x:  -2, z: -18, w: 3.5, h: 8, d: 4 },
      { x:  -2, z:  18, w: 3.5, h: 6, d: 4 },
      { x:   8, z: -17, w: 4, h: 5, d: 4 },
      { x:   8, z:  17, w: 4, h: 7, d: 4 },
      { x:  16, z: -16, w: 3.5, h: 6, d: 3.5 },
      { x:  16, z:  16, w: 3.5, h: 5, d: 3.5 },
      { x:  22, z: -17, w: 4, h: 8, d: 4 },
      { x:  22, z:  17, w: 4, h: 6, d: 4 },
    ];

    for (const { x, z, w, h, d } of configs) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Main body
      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const body = new THREE.Mesh(bodyGeo, wallMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Roof edge (slightly wider/darker lip)
      const roof = new THREE.Mesh(_roofEdgeGeo, roofMat);
      roof.scale.set(w / 4, 1, d / 4);
      roof.position.y = h + 0.11;
      roof.castShadow = true;
      group.add(roof);

      // Windows — 2 rows, facing the -z side (toward battlefield centre)
      const facingZ = z < 0 ? 1 : -1; // face inward
      const winOffsetZ = (d / 2 + 0.05) * facingZ;
      const windowRows = Math.max(1, Math.floor(h / 3) - 1);
      const windowCols = Math.floor(w / 1.8);
      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          const wx = -((windowCols - 1) / 2) * 1.5 + col * 1.5;
          const wy = 1.5 + row * 2.5;
          if (wy + 0.5 > h - 0.3) continue;
          const win = new THREE.Mesh(_windowGeo, winMat);
          win.position.set(wx, wy, winOffsetZ);
          if (facingZ < 0) win.rotation.y = Math.PI;
          group.add(win);
        }
      }

      // Door — ground floor, centre of inward face
      const door = new THREE.Mesh(_doorGeo, doorMat);
      door.position.set(0, 0.55, winOffsetZ * 1.01);
      if (facingZ < 0) door.rotation.y = Math.PI;
      group.add(door);

      // Entrance step
      const step = new THREE.Mesh(_stepGeo, stepMat);
      step.position.set(0, 0.09, winOffsetZ * 1.0 + (facingZ > 0 ? 0.3 : -0.3));
      group.add(step);

      this._scene.add(group);
      this._objects.push(group);
    }

    // A few edge bushes between buildings
    this._addEdgeBushes(0x3A5A30);
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
        if (child.material) child.material.dispose();
      });
    }
    this._objects = [];
    this._scene.background = new THREE.Color(COLOR.skyDay);
    this._scene.fog = new THREE.Fog(COLOR.skyDay, 60, 130);
  }
}
