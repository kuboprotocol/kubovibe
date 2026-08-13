class MemoryStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

// Provide a minimal in-memory localStorage for Node test environments.
// If a browser environment is present this will not override it.
if (typeof globalThis.localStorage === 'undefined') {
  // @ts-ignore - augmenting globalThis for test environments
  globalThis.localStorage = new MemoryStorage();
}

// Also provide a minimal sessionStorage if needed by code paths
if (typeof globalThis.sessionStorage === 'undefined') {
  // @ts-ignore
  globalThis.sessionStorage = new MemoryStorage();
}
