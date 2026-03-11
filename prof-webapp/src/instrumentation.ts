// Polyfill localStorage pour Node.js 22+ (API expérimentale cassée)
// Firebase SDK tente d'y accéder côté serveur
export async function register() {
  if (typeof window === "undefined") {
    const storage = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      get length() { return storage.size; },
      key: (index: number) => [...storage.keys()][index] ?? null,
    };
  }
}
