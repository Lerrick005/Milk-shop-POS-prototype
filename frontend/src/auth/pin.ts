// ─────────────────────────────────────────────────────────────
// PIN attempt limiter. Prevents brute-forcing a 4-digit PIN by
// slowing down after repeated failures. Stored in localStorage
// so it survives a page refresh (an attacker can't just reload
// to reset the counter).
//
// Policy:
//   attempts 1-5   → free retries
//   after 5 fails  → 30s cooldown before next attempt
//   after each further fail → cooldown doubles (30s, 60s, 2m, …)
//   successful sign-in → counter fully reset
//
// The lockout key is per-role so a cashier failing doesn't lock out
// the owner on the same phone.
// ─────────────────────────────────────────────────────────────

import type { UserRole } from "@/types/models";

type AttemptRecord = {
  failures: number;
  /** Timestamp (ms) of the last failed attempt */
  lastFailAt: number;
};

const KEY_PREFIX = "pos.pinAttempts.";
const MAX_FREE = 5;
const BASE_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 10 * 60_000; // cap at 10 minutes

function key(role: UserRole): string {
  return `${KEY_PREFIX}${role}`;
}

function read(role: UserRole): AttemptRecord {
  try {
    const raw = localStorage.getItem(key(role));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AttemptRecord>;
      if (typeof parsed.failures === "number" && typeof parsed.lastFailAt === "number") {
        return { failures: parsed.failures, lastFailAt: parsed.lastFailAt };
      }
    }
  } catch {
    /* ignore */
  }
  return { failures: 0, lastFailAt: 0 };
}

function write(role: UserRole, rec: AttemptRecord): void {
  try {
    localStorage.setItem(key(role), JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

/**
 * How many milliseconds the user must still wait before the next
 * attempt is allowed. 0 means "go ahead now".
 */
export function cooldownRemainingMs(role: UserRole): number {
  const rec = read(role);
  if (rec.failures < MAX_FREE) return 0;
  const excess = rec.failures - MAX_FREE; // 0 for the 6th failure, 1 for the 7th…
  const cooldown = Math.min(
    BASE_COOLDOWN_MS * Math.pow(2, excess),
    MAX_COOLDOWN_MS,
  );
  const elapsed = Date.now() - rec.lastFailAt;
  return Math.max(0, cooldown - elapsed);
}

/**
 * Record a failed attempt. Called by the sign-in screen after the
 * repository rejects the PIN.
 */
export function recordFailure(role: UserRole): void {
  const rec = read(role);
  write(role, { failures: rec.failures + 1, lastFailAt: Date.now() });
}

/** Record a successful attempt (full reset). */
export function recordSuccess(role: UserRole): void {
  write(role, { failures: 0, lastFailAt: 0 });
}

/** Number of free attempts the user has left before a cooldown. */
export function attemptsRemaining(role: UserRole): number {
  const rec = read(role);
  return Math.max(0, MAX_FREE - rec.failures);
}