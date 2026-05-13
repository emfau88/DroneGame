import { bus } from './EventBus.js';

const VALID_TRANSITIONS = {
  BOOT:           ['MENU'],
  MENU:           ['PLAYING'],
  PLAYING:        ['PAUSED', 'ENDED', 'UPGRADE_SELECT', 'RUN_OVER', 'RUN_WIN'],
  PAUSED:         ['PLAYING', 'MENU'],
  ENDED:          ['MENU', 'PLAYING'],
  UPGRADE_SELECT: ['PLAYING'],
  RUN_OVER:       ['MENU', 'PLAYING'],
  RUN_WIN:        ['MENU', 'PLAYING'],
};

/**
 * StateMachine — tracks game state and validates transitions.
 * Emits 'state:changed' on every valid transition.
 * New states: UPGRADE_SELECT, RUN_OVER, RUN_WIN (DRONE_STRIKE_REBUILD.md §Architecture)
 */
export class StateMachine {
  constructor() {
    this.current = 'BOOT';
  }

  transition(to) {
    const allowed = VALID_TRANSITIONS[this.current];
    if (!allowed || !allowed.includes(to)) {
      console.warn(`[StateMachine] Invalid transition: ${this.current} → ${to}`);
      return false;
    }
    const prev = this.current;
    this.current = to;
    bus.emit('state:changed', { from: prev, to });
    return true;
  }

  is(state) {
    return this.current === state;
  }
}
