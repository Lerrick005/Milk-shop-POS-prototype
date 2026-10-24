// ─────────────────────────────────────────────────────────────
// User repository. Two roles: owner, cashier. Each has a 4-6 digit
// PIN. We NEVER store the raw PIN — we store:
//   pinSalt = 16 random bytes (hex)
//   pinHash = SHA-256(pinSalt || pin)
//
// The schema enforces only one user per role (&role unique), which
// matches this app's design: one owner + one cashier share the phone.
// ─────────────────────────────────────────────────────────────

import { db, newId, nowISO, touchSyncMeta, withSyncMeta } from "@/db/db";
import type { User, UserRole } from "@/types/models";

// ─────────────────────────────────────────────────────────────
// Hashing (SubtleCrypto — built into the browser, no dependency)
// ─────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** SHA-256(salt || pin) as hex. */
async function hashPin(pin: string, saltHex: string): Promise<string> {
  const salt = hexToBytes(saltHex);
  const pinBytes = new TextEncoder().encode(pin);
  const combined = new Uint8Array(salt.length + pinBytes.length);
  combined.set(salt, 0);
  combined.set(pinBytes, salt.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return bytesToHex(new Uint8Array(digest));
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

function validatePin(pin: string): void {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

/** Return all live users, ordered owner first. */
export async function listUsers(): Promise<User[]> {
  const all = await db.users.filter((u) => u.deletedAt === null).toArray();
  return all.sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (b.role === "owner" && a.role !== "owner") return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Look up a user by role. Returns undefined if not created yet. */
export async function getUserByRole(role: UserRole): Promise<User | undefined> {
  const u = await db.users.where("role").equals(role).first();
  if (!u || u.deletedAt !== null) return undefined;
  return u;
}

/** Look up a user by id. */
export async function getUser(id: string): Promise<User | undefined> {
  const u = await db.users.get(id);
  if (!u || u.deletedAt !== null) return undefined;
  return u;
}

// ─────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────

export type CreateUserInput = {
  name: string;
  role: UserRole;
  pin: string;
};

/**
 * Create a user. Enforces one-per-role by checking uniqueness first
 * (also enforced by the &role index — belt and braces).
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  validatePin(input.pin);
  if (!input.name.trim()) {
    throw new Error("Name is required");
  }
  const existing = await getUserByRole(input.role);
  if (existing) {
    throw new Error(
      `A ${input.role} already exists (${existing.name}). Change their PIN instead.`,
    );
  }

  const salt = randomSaltHex();
  const hash = await hashPin(input.pin, salt);

  const record: User = withSyncMeta({
    name: input.name.trim(),
    role: input.role,
    pinHash: hash,
    pinSalt: salt,
    createdAt: nowISO(),
  }) as User;
  await db.users.add(record);
  return record;
}

/** Change a user's PIN. Requires knowing the current PIN. */
export async function changePin(
  userId: string,
  currentPin: string,
  newPin: string,
): Promise<void> {
  validatePin(newPin);
  const existing = await db.users.get(userId);
  if (!existing || existing.deletedAt !== null) {
    throw new Error("User not found");
  }
  const currentHash = await hashPin(currentPin, existing.pinSalt);
  if (currentHash !== existing.pinHash) {
    throw new Error("Current PIN is incorrect");
  }
  const newSalt = randomSaltHex();
  const newHash = await hashPin(newPin, newSalt);
  await db.users.put(
    touchSyncMeta({
      ...existing,
      pinSalt: newSalt,
      pinHash: newHash,
    }) as User,
  );
}

/**
 * Force-set a PIN without knowing the current one.
 * Used only by the owner resetting the cashier's PIN, or by the
 * "Forgot owner PIN" recovery flow (which requires the shop's
 * backup file to be present).
 */
export async function forceSetPin(
  userId: string,
  newPin: string,
): Promise<void> {
  validatePin(newPin);
  const existing = await db.users.get(userId);
  if (!existing || existing.deletedAt !== null) {
    throw new Error("User not found");
  }
  const newSalt = randomSaltHex();
  const newHash = await hashPin(newPin, newSalt);
  await db.users.put(
    touchSyncMeta({
      ...existing,
      pinSalt: newSalt,
      pinHash: newHash,
    }) as User,
  );
}

/**
 * Verify a PIN for a user. Returns the user if valid, undefined otherwise.
 * Constant-time comparison isn't strictly needed here — an attacker
 * with console access to a shop phone has bigger problems — but the
 * hash comparison is done as a single string equality, which is fine
 * because the hash itself is not secret-dependent.
 */
export async function verifyPin(
  userId: string,
  pin: string,
): Promise<User | undefined> {
  const existing = await db.users.get(userId);
  if (!existing || existing.deletedAt !== null) return undefined;
  const hash = await hashPin(pin, existing.pinSalt);
  if (hash !== existing.pinHash) return undefined;
  return existing;
}

/**
 * Verify a PIN by role (used by the sign-in screen: "Owner / Cashier"
 * toggle → enter PIN). Returns the matched user, or undefined.
 */
export async function verifyPinByRole(
  role: UserRole,
  pin: string,
): Promise<User | undefined> {
  const user = await getUserByRole(role);
  if (!user) return undefined;
  return verifyPin(user.id, pin);
}

/**
 * First-run setup: create the default owner + cashier if none exist.
 * Called from the seed on app first launch. Default PINs are shown
 * on the sign-in screen until changed (in the UI, we force a change).
 */
export async function ensureDefaultUsers(): Promise<void> {
  const owner = await getUserByRole("owner");
  const cashier = await getUserByRole("cashier");
  if (!owner) {
    await createUser({ name: "Owner", role: "owner", pin: "1234" });
  }
  if (!cashier) {
    await createUser({ name: "Cashier", role: "cashier", pin: "0000" });
  }
}

// Re-export for convenience
export { newId as newUserId };