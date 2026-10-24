// ─────────────────────────────────────────────────────────────
// Persistent storage request. On first launch, we ask the browser
// to mark our IndexedDB as "persistent" — meaning the OS won't
// evict it under storage pressure. Without this, a phone running
// low on storage can silently delete our entire shop's data.
//
// Support: Chrome/Edge/Android yes. Safari 15.2+ yes. Firefox
// auto-grants for installed PWAs. If denied, we surface a warning
// banner ("Backup often") — that's the fallback.
// ─────────────────────────────────────────────────────────────

export type PersistState = {
  /** Browser supports the API at all */
  supported: boolean;
  /** Current persistence grant */
  granted: boolean;
  /** Approximate quota, in bytes (if reported) */
  quota: number | null;
  /** Approximate usage, in bytes (if reported) */
  usage: number | null;
  /** Human-readable status for the UI */
  message: string;
};

const CACHE_KEY = "pos.persistState.v1";

/**
 * Check current persistence state without prompting. Used on every
 * app launch to update the banner.
 */
export async function checkPersistState(): Promise<PersistState> {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return {
      supported: false,
      granted: false,
      quota: null,
      usage: null,
      message: "Storage API not available in this browser.",
    };
  }

  const supported = typeof navigator.storage.persist === "function";
  let granted = false;
  if (typeof navigator.storage.persisted === "function") {
    try {
      granted = await navigator.storage.persisted();
    } catch {
      granted = false;
    }
  }

  let quota: number | null = null;
  let usage: number | null = null;
  if (typeof navigator.storage.estimate === "function") {
    try {
      const est = await navigator.storage.estimate();
      quota = est.quota ?? null;
      usage = est.usage ?? null;
    } catch {
      /* ignore */
    }
  }

  let message: string;
  if (!supported) {
    message = "This browser cannot request persistent storage. Back up often.";
  } else if (granted) {
    message = "Data is protected — the browser will not auto-delete it.";
  } else {
    message = "Browser may evict data if the phone runs low on storage. Back up often.";
  }

  return { supported, granted, quota, usage, message };
}

/**
 * Request persistence. Called from a user gesture (button click) for
 * best results — Chrome requires user intent. Returns the resulting
 * state after the request.
 */
export async function requestPersist(): Promise<PersistState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return checkPersistState();
  }
  try {
    await navigator.storage.persist();
  } catch (err) {
    console.warn("persist() failed:", err);
  }
  const state = await checkPersistState();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ granted: state.granted, at: Date.now() }));
  } catch {
    /* localStorage may be disabled; not fatal */
  }
  return state;
}

/** Format bytes as "12.3 MB". */
export function formatBytes(n: number | null): string {
  if (n === null || isNaN(n)) return "unknown";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}