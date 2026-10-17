const DEVICE_KEY = "games:device";
const DEVICE_RE = /^[A-Za-z0-9_-]{24}$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

let memoryId: string | null = null;

function generate(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  // 64 symbols, so `& 63` is unbiased.
  return Array.from(bytes, (b) => ALPHABET[b & 63]).join("");
}

/** Anonymous per-browser id (24 chars), created once; used for counting devices, never for identity. */
export function getDeviceId(): string {
  if (memoryId) return memoryId;
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved && DEVICE_RE.test(saved)) return (memoryId = saved);
  } catch {
    /* storage blocked: the id lasts until the tab closes */
  }
  const id = generate();
  memoryId = id;
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}
