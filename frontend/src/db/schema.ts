// ─────────────────────────────────────────────────────────────
// Dexie schema. One entry per object store. The string is Dexie's
// index declaration syntax:
//
//   ++id          → auto-incrementing primary key (we DON'T use this;
//                    we use our own UUIDs, so the key is just `id`)
//   &foo          → unique index on foo
//   [a+b]         → compound index over a and b
//   *tags         → multi-entry index (array field)
//
// Every record we store has a UUID `id` from SyncMeta. We index by
// id, by _syncStatus (for the future sync layer), and by the fields
// that real queries will filter/sort on.
//
// Changing this file forces a Dexie schema version bump + migration.
// That is intentional — migrations are explicit, never silent.
// ─────────────────────────────────────────────────────────────

export const DB_NAME = "milk-shop-pos";

/**
 * Bump this when `schema` changes. Dexie compares against the last
 * version stored in IndexedDB and runs only the migrations needed.
 */
export const DB_VERSION = 1;

/**
 * Dexie schema — store name → index declaration string.
 *
 * The first segment after ++ (or plain field name) is the primary key.
 * The remaining segments are indexes. Fields NOT listed here are still
 * stored on the record, just not indexed (slow to query, fast to store).
 */
export const schema = {
  // ── Users ─────────────────────────────────────────────────
  // id (PK) | unique role (only 2 users, but explicit) | unique name
  users: "id, &role, &name, deletedAt",

  // ── Products ──────────────────────────────────────────────
  // Search by name, SKU, or category; sort by name.
  products: "id, &sku, name, category, deletedAt, [category+name]",

  // ── Batches ───────────────────────────────────────────────
  // Look up by product; sort by expiry (the critical dairy query:
  // "which batches of milk expire this week?").
  batches: "id, productId, expiryDate, deletedAt, [productId+expiryDate]",

  // ── Sales ─────────────────────────────────────────────────
  // Look up by date (dashboard / EOD), by receipt number (reprint /
  // reference), by cashier (per-cashier EOD), by payment method.
  sales:
    "id, &receiptNumber, createdAt, cashierId, paymentMethod, deletedAt, [createdAt+cashierId], [createdAt+paymentMethod]",

  // ── Sale line items ───────────────────────────────────────
  // Belongs to a sale; query by product (best-seller report).
  saleItems: "id, saleId, productId, [saleId+productId]",

  // ── Stock ledger (append-only) ────────────────────────────
  // Query by product (running balance), by date (EOD report),
  // by type (e.g. "all waste today").
  stockMovements:
    "id, productId, batchId, type, createdAt, [productId+createdAt], [createdAt+type]",

  // ── Daily shifts ──────────────────────────────────────────
  // One per business date — must be unique.
  shifts: "id, &businessDate, deletedAt"
} as const;

/** Union of all store names — used for generic helpers. */
export type StoreName = keyof typeof schema;