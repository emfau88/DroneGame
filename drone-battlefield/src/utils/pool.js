/**
 * ObjectPool — recycles objects to avoid per-frame allocation.
 * Used for bullets and short-lived effects.
 * @template T
 */
export class ObjectPool {
  /**
   * @param {() => T} factory - Creates a new item
   * @param {(item: T) => void} reset - Resets an item to clean state before reuse
   * @param {number} initialSize
   */
  constructor(factory, reset, initialSize = 16) {
    this._factory = factory;
    this._reset = reset;
    this._pool = [];
    for (let i = 0; i < initialSize; i++) {
      this._pool.push(factory());
    }
  }

  acquire() {
    const item = this._pool.length > 0 ? this._pool.pop() : this._factory();
    return item;
  }

  release(item) {
    this._reset(item);
    this._pool.push(item);
  }

  get size() {
    return this._pool.length;
  }
}
