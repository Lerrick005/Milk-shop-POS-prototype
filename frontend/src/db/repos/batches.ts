// ─────────────────────────────────────────────────────────────
// Batch repository. A batch is one physical delivery of a product
// with its own expiry date. Dairy products MUST be sold oldest-expiry
// first (FIFO by expiry), otherwise the shop wastes stock every week.
//
// All stock changes for batches go through the stock ledger too, but
// batches also carry their own `stock` counter so the EOD report can
// show "which batch of milk is about to expire with 6 packets left".
// ─────────────────────────────────────────────────────────────

import { db, nowISO, touchSyncMeta, withSyncMeta } from "@/db/db";
import type { Batch } from "@/types/models";

/** Input for receiving a new batch from a supplier. */
export type CreateBatchInput = {
  productId: string;
  batchNumber: string;
  expiryDate: string; // ISO YYYY-MM-DD
  quantity: number; // units received
  notes?: string;
};

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

/**
 * All live batches for one product, sorted by expiry date ascending.
 * This is the list used by the FIFO picker when stock is deducted.
 */
export async function listBatchesForProduct(
  productId: string,
): Promise<Batch[]> {
  const all = await db.batches
    .where("productId")
    .equals(productId)
    .filter((b) => b.deletedAt === null && b.stock > 0)
    .toArray();
  return all.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/** All live batches, sorted by expiry (used by the expiry dashboard). */
export async function listAllBatches(): Promise<Batch[]> {
  const all = await db.batches
    .filter((b) => b.deletedAt === null)
    .toArray();
  return all.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/**
 * Batches expiring within `days` days (default: 7), sorted by expiry.
 * Includes already-expired batches at the top — those are urgent.
 *
 * Used by:
 *   - Dashboard "Expiring soon" count
 *   - Inventory screen expiry badges
 *   - The EOD "what should we check tomorrow" note
 */
export async function listExpiringSoon(days = 7): Promise<Batch[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const cutoffStr = toLocalDateString(cutoff);
  const all = await listAllBatches();
  return all.filter((b) => b.stock > 0 && b.expiryDate <= cutoffStr);
}

/**
 * Pick the batch to decrement for a sale, FIFO by expiry (oldest first).
 * Returns undefined if no batch has enough stock — caller must decide
 * whether to allow "untracked sale" or block the sale.
 *
 * NOTE: this returns just the FIRST batch. If a sale needs more units
 * than the first batch has, the sale repo calls this in a loop.
 */
export async function pickBatchForSale(
  productId: string,
): Promise<Batch | undefined> {
  const batches = await listBatchesForProduct(productId);
  return batches[0];
}

/** Get one batch by id. */
export async function getBatch(id: string): Promise<Batch | undefined> {
  const b = await db.batches.get(id);
  if (!b || b.deletedAt !== null) return undefined;
  return b;
}

// ─────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────

/**
 * Receive a new batch. Creates the batch record with stock = quantity.
 * Does NOT update the product's stock counter — that's the caller's
 * responsibility via stockLedger.applyStockMovement().
 */
export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  const record: Batch = withSyncMeta({
    productId: input.productId,
    batchNumber: input.batchNumber,
    expiryDate: input.expiryDate,
    receivedAt: nowISO().slice(0, 10),
    stock: input.quantity,
    initialStock: input.quantity,
    notes: input.notes,
    createdAt: nowISO(),
  }) as Batch;
  await db.batches.add(record);
  return record;
}

/**
 * Decrement a batch's stock by `qty` units (called by the sale repo).
 * INTERNAL — use applyStockMovement() in stockLedger.ts from the UI.
 * Throws if qty > batch.stock — prevents negative batch stock.
 */
export async function _decrementBatchStockInternal(
  batchId: string,
  qty: number,
): Promise<void> {
  const batch = await db.batches.get(batchId);
  if (!batch) throw new Error(`Batch ${batchId} not found`);
  if (batch.stock < qty) {
    throw new Error(
      `Batch ${batchId} has ${batch.stock} units, cannot decrement ${qty}`,
    );
  }
  await db.batches.put(
    touchSyncMeta({
      ...batch,
      stock: batch.stock - qty,
    }) as Batch,
  );
}

/**
 * Increment a batch's stock by `qty` units (used for customer returns
 * back into the same batch). INTERNAL.
 */
export async function _incrementBatchStockInternal(
  batchId: string,
  qty: number,
): Promise<void> {
  const batch = await db.batches.get(batchId);
  if (!batch) throw new Error(`Batch ${batchId} not found`);
  await db.batches.put(
    touchSyncMeta({
      ...batch,
      stock: batch.stock + qty,
    }) as Batch,
  );
}

/** Soft-delete a batch (e.g., "all spoiled, disposed"). Tombstone. */
export async function softDeleteBatch(id: string): Promise<void> {
  const existing = await db.batches.get(id);
  if (!existing) return;
  await db.batches.put({
    ...existing,
    deletedAt: nowISO(),
    _syncStatus: "pending",
    _lastModified: nowISO(),
    _localVersion: existing._localVersion + 1,
  });
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

/** YYYY-MM-DD in the device's local timezone. */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}