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
const _coverBoxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
const _roadGeo     = new THREE.PlaneGeometry(160, 9);
const _duneGeo     = new THREE.CylinderGeometry(0, 3.5, 1.8, 8);
const _buildingGeo = new THREE.BoxGeometry(4, 6, 4);
const _treeGeo     = new THREE.CylinderGeometry(0, 1.2, 3, 6);
const _trunkGeo    = new THREE.CylinderGeometry(0.25, 0.25, 1.5, 6);

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
    this._sun = new THREE.DirectionalLight(0xFFF5E0, 1.4);
    this._sun.position.set(-25, 42, 20);
    this._sun.castShadow = true;
    this._sun.shadow.mapSize.width  = 1024;
    this._sun.shadow.mapSize.height = 1024;
    this._sun.shadow.camera.near = 1;
    this._sun.shadow.camera.far  = 120;
    this._sun.shadow.camera.left   = -80;
    this._sun.shadow.camera.right  =  80;
    this._sun.shadow.camera.top    =  40;
    this._sun.shadow.camera.bottom = -40;
    scene.add(this._sun);

    const hemi = new THREE.HemisphereLight(0xFFFFFF, 0x7AA05C, 0.6);
    scene.add(hemi);
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
    const s = this._scene;
    this._scene.background = new THREE.Color(COLOR.skyDay);
    this._scene.fog = new THREE.Fog(COLOR.skyDay, 60, 130);

    this._add(new THREE.Mesh(_groundGeo, new THREE.MeshStandardMaterial({ color: COLOR.groundBase })),
      m => { m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.position.y = -0.01; });

    this._add(new THREE.Mesh(_riverGeo, new THREE.MeshStandardMaterial({ color: COLOR.water })),
      m => { m.rotation.x = -Math.PI / 2; m.position.y = -0.005; });

    this._add(new THREE.Mesh(_roadGeo, new THREE.MeshStandardMaterial({ color: COLOR.road })),
      m => { m.rotation.x = -Math.PI / 2; m.position.y = 0.001; });

    this._add(new THREE.Mesh(_bridgeGeo, new THREE.MeshStandardMaterial({ color: 0x8B7355 })),
      m => { m.position.y = 0.06; m.receiveShadow = true; m.castShadow = true; });

    this._addCoverObjects();
  }

  _buildDesert() {
    this._scene.background = new THREE.Color(COLOR.desertSky);
    this._scene.fog = new THREE.Fog(COLOR.desertSky, 60, 130);

    this._add(new THREE.Mesh(_groundGeo, new THREE.MeshStandardMaterial({ color: COLOR.desertGround })),
      m => { m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.position.y = -0.01; });

    this._addDunes();
  }

  _buildForest() {
    this._scene.background = new THREE.Color(COLOR.forestSky);
    this._scene.fog = new THREE.Fog(COLOR.forestSky, 50, 110);

    this._add(new THREE.Mesh(_groundGeo, new THREE.MeshStandardMaterial({ color: COLOR.forestGround })),
      m => { m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.position.y = -0.01; });

    this._add(new THREE.Mesh(_roadGeo, new THREE.MeshStandardMaterial({ color: COLOR.road })),
      m => { m.rotation.x = -Math.PI / 2; m.position.y = 0.001; });

    this._addTrees();
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
    const mat = new THREE.MeshStandardMaterial({ color: 0xC8A96E });
    const positions = [
      [-10, -10], [-10, 10], [-5, -12], [-5, 12],
      [5, -11], [5, 11], [10, -10], [10, 10],
    ];
    for (const [x, z] of positions) {
      this._add(new THREE.Mesh(_coverBoxGeo, mat),
        m => { m.position.set(x, 0.6, z); m.castShadow = true; m.receiveShadow = true; });
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

  _addTrees() {
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2D6E27 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6914 });
    const positions = [
      [-20,-18],[-20,18],[-15,-16],[-15,16],[-8,-18],[-8,18],
      [-2,-17],[-2,17],[5,-18],[5,18],[12,-16],[12,16],
      [18,-17],[18,17],[25,-18],[25,18],
    ];
    for (const [x, z] of positions) {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(_trunkGeo, trunkMat);
      trunk.position.y = 0.75;
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(_treeGeo, leafMat);
      leaves.position.y = 3.2;
      leaves.castShadow = true;
      group.add(trunk);
      group.add(leaves);
      group.position.set(x, 0, z);
      this._scene.add(group);
      this._objects.push(group);
    }
  }

  _addBuildings() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6A6A78 });
    const positions = [
      [-18,-16],[-18,16],[-12,-17],[-12,17],
      [-3,-18],[-3,18],[7,-17],[7,17],
      [14,-16],[14,16],[22,-17],[22,17],
    ];
    for (const [x, z] of positions) {
      const h = 4 + Math.abs((x * z) % 5);
      const geo = new THREE.BoxGeometry(4, h, 4);
      const bld = new THREE.Mesh(geo, mat);
      bld.position.set(x, h / 2, z);
      bld.castShadow = true;
      bld.receiveShadow = true;
      this._scene.add(bld);
      this._objects.push(bld);
    }
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
