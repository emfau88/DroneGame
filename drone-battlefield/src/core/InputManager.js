const DEAD_ZONE = 0.08;

/**
 * InputManager — unified joystick (touch) + keyboard input.
 * Output: { x, y, firePrimary, fireSecondary }
 * firePrimary/fireSecondary are true every frame the button is HELD (not edge-triggered).
 * Weapons fire when cooldown is ready AND button is held — Drone.js manages cooldowns.
 */
export class InputManager {
  constructor() {
    this._joystickEl   = null;
    this._knobEl       = null;
    this._firePrimaryBtn  = null;
    this._fireSecondaryBtn = null;

    this._joystickActive    = false;
    this._joystickOrigin    = { x: 0, y: 0 };
    this._joystickRadius    = 55;
    this._joystickPointerId = null;
    this._rawX = 0;
    this._rawY = 0;

    // Keyboard
    this._keys = {};

    // Hold state — true while button/key held
    this._primaryHeld   = false;
    this._secondaryHeld = false;

    // Touch pointer IDs for multi-touch fire
    this._primaryPointerId   = null;
    this._secondaryPointerId = null;

    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp   = this._handlePointerUp.bind(this);
    this._onKeyDown     = this._handleKeyDown.bind(this);
    this._onKeyUp       = this._handleKeyUp.bind(this);
  }

  init() {
    this._joystickEl        = document.getElementById('joystick');
    this._knobEl            = document.getElementById('joystick-knob');
    this._firePrimaryBtn    = document.getElementById('fire-primary-btn');
    this._fireSecondaryBtn  = document.getElementById('fire-secondary-btn');

    if (!this._joystickEl || !this._knobEl) {
      console.warn('[InputManager] HUD elements not found — check index.html IDs');
      return;
    }

    this._joystickRadius = 55;

    this._joystickEl.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup',   this._onPointerUp);
    window.addEventListener('keydown',     this._onKeyDown);
    window.addEventListener('keyup',       this._onKeyUp);

    if (this._firePrimaryBtn) {
      this._firePrimaryBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this._primaryHeld = true;
        this._primaryPointerId = e.pointerId;
      });
      this._firePrimaryBtn.addEventListener('pointerup', (e) => {
        if (e.pointerId === this._primaryPointerId) {
          this._primaryHeld = false;
          this._primaryPointerId = null;
        }
      });
      this._firePrimaryBtn.addEventListener('pointerleave', (e) => {
        if (e.pointerId === this._primaryPointerId) {
          this._primaryHeld = false;
          this._primaryPointerId = null;
        }
      });
    }

    if (this._fireSecondaryBtn) {
      this._fireSecondaryBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this._secondaryHeld = true;
        this._secondaryPointerId = e.pointerId;
      });
      this._fireSecondaryBtn.addEventListener('pointerup', (e) => {
        if (e.pointerId === this._secondaryPointerId) {
          this._secondaryHeld = false;
          this._secondaryPointerId = null;
        }
      });
      this._fireSecondaryBtn.addEventListener('pointerleave', (e) => {
        if (e.pointerId === this._secondaryPointerId) {
          this._secondaryHeld = false;
          this._secondaryPointerId = null;
        }
      });
    }
  }

  _handlePointerDown(e) {
    if (this._joystickActive) return;
    this._joystickActive = true;
    this._joystickPointerId = e.pointerId;
    const rect = this._joystickEl.getBoundingClientRect();
    this._joystickOrigin.x = rect.left + rect.width / 2;
    this._joystickOrigin.y = rect.top + rect.height / 2;
    if (rect.width > 0) this._joystickRadius = rect.width / 2;
    this._joystickEl.setPointerCapture(e.pointerId);
  }

  _handlePointerMove(e) {
    if (!this._joystickActive || e.pointerId !== this._joystickPointerId) return;
    const dx = e.clientX - this._joystickOrigin.x;
    const dy = e.clientY - this._joystickOrigin.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = this._joystickRadius;
    const clampedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);

    this._rawX = (clampedDist / maxDist) * Math.cos(angle);
    this._rawY = (clampedDist / maxDist) * Math.sin(angle);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    this._knobEl.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  _handlePointerUp(e) {
    if (e.pointerId !== this._joystickPointerId) return;
    this._joystickActive = false;
    this._joystickPointerId = null;
    this._rawX = 0;
    this._rawY = 0;
    this._knobEl.style.transform = 'translate(0,0)';
  }

  _handleKeyDown(e) {
    this._keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') e.preventDefault();
  }

  _handleKeyUp(e) {
    this._keys[e.code] = false;
  }

  /**
   * Called once per frame. Returns current input state.
   * firePrimary/fireSecondary are true every frame the button is held.
   */
  getState() {
    let kx = 0;
    let ky = 0;
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  kx -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) kx += 1;
    if (this._keys['KeyW'] || this._keys['ArrowUp'])    ky -= 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  ky += 1;

    let x = this._rawX + kx;
    let y = this._rawY + ky;

    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }

    if (Math.abs(x) < DEAD_ZONE) x = 0;
    if (Math.abs(y) < DEAD_ZONE) y = 0;

    // Space = primary fire, Shift = secondary fire
    const firePrimary   = this._primaryHeld   || this._keys['Space'] === true;
    const fireSecondary = this._secondaryHeld  || this._keys['ShiftLeft'] === true || this._keys['ShiftRight'] === true;

    return { x, y, firePrimary, fireSecondary };
  }

  destroy() {
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup',   this._onPointerUp);
    window.removeEventListener('keydown',     this._onKeyDown);
    window.removeEventListener('keyup',       this._onKeyUp);
  }
}
