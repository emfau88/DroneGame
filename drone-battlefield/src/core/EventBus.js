/**
 * EventBus — pub/sub event system. All cross-system communication goes through here.
 * No system imports another system directly; they only import this singleton.
 */
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  }

  off(event, callback) {
    const list = this._listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit(event, data) {
    const list = this._listeners.get(event);
    if (!list) return;
    // Iterate over a copy so listeners can safely call off() inside a handler
    for (const cb of list.slice()) {
      cb(data);
    }
  }
}

export const bus = new EventBus();
