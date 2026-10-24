// ─────────────────────────────────────────────────────────────
// The Dexie instance. Single database, single source of truth.
//
// Every read and write in the app goes through this file. There is
// no direct IndexedDB usage anywhere else in the codebase — this is
// the only place that knows about the schema and versioning.
// ─────────────────────────────────────────────────────────────

import Dexie, { type EntityTable } from "dexie";
import { DB_NAME, DB_VERSION, schema } from "./schema";
import type {
  Batch,
  Product,
  Sale,
  SaleItem,
  Shift,
  StockMovement,
  User,
} from "@/types/models";

/**
 * Dexie database class. Each property mirrors an entry in `schema`.
 * The `EntityTable<T, "id">` type tells Dexie that the primary key is
 * the string field `id` on the record — which is what our SyncMeta
 * gives us.
 */
class ShopDB extends Dexie {
  users!: EntityTable<User, "id">;
  products!: EntityTable<Product, "id">;
  batches!: EntityTable<Batch, "id">;
  sales!: EntityTable<Sale, "id">;
  saleItems!: EntityTable<SaleItem, "id">;
  stockMovements!: EntityTable<StockMovement, "id">;
  shifts!: EntityTable<Shift, "id">;

  constructor() {
    super(DB_NAME);
    // Version 1 — the initial schema. Future migrations look like:
    //   this.version(2).stores({ ... }).upgrade(tx => { ... })
    // We do NOT change version numbers without also adding an upgrade.
    this.version(DB_VERSION).stores(schema);
  }
}

export const db = new ShopDB();

// ─────────────────────────────────────────────────────────────
// Small helpers used by every repository
// ─────────────────────────────────────────────────────────────

/**
 * Generate a UUID v4. Prefers the browser-native crypto.randomUUID
 * (available on all modern phones, Chrome 92+, Safari 15.4+).
 * Falls back to a hand-rolled v4 for older browsers.
 */
export function newId(): string {
  const c = crypto as Crypto;
  if (typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // Fallback — RFC 4122 v4
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
  return (
    h.slice(0, 4).join("") +
    "-" +
    h.slice(4, 6).join("") +
    "-" +
    h.slice(6, 8).join("") +
    "-" +
    h.slice(8, 10).join("") +
    "-" +
    h.slice(10, 16).join("")
  );
}

/** Current time as an ISO 8601 string. Used everywhere for timestamps. */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Fill in the sync metadata fields every syncable record carries.
 * Repositories call this before inserting so no record forgets a field.
 *
 * A "new" record starts as:
 *   _syncStatus: "pending"    → will eventually be pushed to server
 *   _localVersion: 1
 *   deletedAt: null           → alive
 */
export function withSyncMeta<T extends object>(
  input: T,
): T & {
  id: string;
  _syncStatus: "pending";
  _lastModified: string;
  _localVersion: number;
  deletedAt: null;
} {
  return {
    ...input,
    id: (input as { id?: string }).id ?? newId(),
    _syncStatus: "pending",
    _lastModified: nowISO(),
    _localVersion: 1,
    deletedAt: null,
  };
}

/**
 * Bump the sync metadata on a record before updating it.
 * Use this whenever you save changes to an existing record.
 */
export function touchSyncMeta<T extends object>(
  record: T,
): T & { _lastModified: string; _localVersion: number } {
  const current = record as { _localVersion?: number };
  return {
    ...record,
    _lastModified: nowISO(),
    _localVersion: (current._localVersion ?? 0) + 1,
  };
}

// ─────────────────────────────────────────────────────────────
// Local-date helpers — the business day is CALENDAR day
// ─────────────────────────────────────────────────────────────

/**
 * Return the local-date string "YYYY-MM-DD" for a given Date.
 * Uses the device's local timezone (a sale at 23:58 local is TODAY).
 * We intentionally do NOT use toISOString() here — that returns UTC,
 * which would shift the business day by 3 hours in Kenya (EAT).
 */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Return the UTC range [start, end) covering the local calendar day
 * of the given date. Used to query sales by business date even though
 * `sales.createdAt` is stored as UTC ISO strings.
 */
export function localDayRange(d: Date = new Date()): { start: string; end: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}