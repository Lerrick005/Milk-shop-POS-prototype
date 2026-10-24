// ─────────────────────────────────────────────────────────────
// Stock ledger. Append-only. The single source of truth for
// "how did this product's stock end up at N units?".
//
// Rule: EVERY stock change in the whole app goes through
// applyStockMovement(). If you want to change stock from anywhere
// else, you're creating a data-integrity bug that the EOD report
// will surface as a mysterious variance. Don't do it.
//
// This file is what makes the EOD "expected closing stock" line
// match reality: opening (sum of all movements before today) +
// today's movements = closing. Always reconciles by construction.
// ─────────────────────────────────────────────────────────────

import { db, newId, nowISO } from "@/db/db";
import type {
  StockMovement,
  StockMovementType,
  StockReconciliation,
} from "@/types/models";
import {
  _setStockInternal,
  getProduct,
  listProducts,
} from "@/db/repos/products";
import {
  _decrementBatchStockInternal,
  _incrementBatchStockInternal,
  getBatch,
} from "@/db/repos/batches";

export type ApplyMovementInput = {
  productId: string;
  batchId?: string | null;
  type: StockMovementType;
  /** Signed: negative decreases stock, positive increases. */
  qtyDelta: number;
  /** Free-text explanation. Required for adjust/waste/return. */
  reason?: string | null;
  /** The sale id, receive id, etc. that triggered this change. */
  refId?: string | null;
  /** Which user performed the change. */
  createdBy: string;
  /** Snapshot of user name at time of change (survives renames). */
  createdByName: string;
};

/**
 * Apply one stock movement atomically:
 *   1. Read the product (throws if missing)
 *   2. Compute new product stock
 *   3. Update the product's stock counter
 *   4. If batchId given, adjust that batch's stock too
 *   5. Append a row to the ledger
 *
 * Wrapped in a Dexie transaction so an app kill mid-write can't leave
 * the product counter and the ledger out of sync.
 *
 * Returns the movement row (with id and timestamps filled in).
 */
export async function applyStockMovement(
  input: ApplyMovementInput,
): Promise<StockMovement> {
  // Validation: reason is required for adjust/waste/return
  if (
    (input.type === "adjustment" ||
      input.type === "waste" ||
      input.type === "return") &&
    (!input.reason || input.reason.trim() === "")
  ) {
    throw new Error(`Reason is required for ${input.type} movements`);
  }
  if (!Number.isInteger(input.qtyDelta)) {
    throw new Error(`qtyDelta must be an integer (got ${input.qtyDelta})`);
  }
  if (input.qtyDelta === 0) {
    throw new Error("qtyDelta must be non-zero");
  }

  const product = await getProduct(input.productId);
  if (!product) throw new Error(`Product ${input.productId} not found`);

  const newStock = product.stock + input.qtyDelta;
  if (newStock < 0) {
    throw new Error(
      `Insufficient stock for "${product.name}": has ${product.stock}, ` +
        `would go to ${newStock}`,
    );
  }

  const movement: StockMovement = {
    id: newId(),
    productId: input.productId,
    batchId: input.batchId ?? null,
    type: input.type,
    qtyDelta: input.qtyDelta,
    reason: input.reason ?? null,
    refId: input.refId ?? null,
    createdBy: input.createdBy,
    createdByNameSnapshot: input.createdByName,
    createdAt: nowISO(),
    _lastModified: nowISO(),
    _localVersion: 1,
  };

  // Atomic write: product counter + batch counter + ledger row
  await db.transaction(
    "rw",
    db.products,
    db.batches,
    db.stockMovements,
    async () => {
      // 1) Product counter
      await _setStockInternal(input.productId, newStock);

      // 2) Batch counter (only if a batch was specified)
      if (input.batchId) {
        const batch = await getBatch(input.batchId);
        if (!batch) throw new Error(`Batch ${input.batchId} not found`);
        if (input.qtyDelta < 0) {
          await _decrementBatchStockInternal(input.batchId, -input.qtyDelta);
        } else {
          await _incrementBatchStockInternal(input.batchId, input.qtyDelta);
        }
      }

      // 3) Ledger row
      await db.stockMovements.add(movement);
    },
  );

  return movement;
}

// ─────────────────────────────────────────────────────────────
// Reads — used by dashboard, EOD report, per-product history
// ─────────────────────────────────────────────────────────────

/** All movements for a product, sorted newest first. */
export async function listMovementsForProduct(
  productId: string,
): Promise<StockMovement[]> {
  const rows = await db.stockMovements
    .where("productId")
    .equals(productId)
    .toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Movements within a UTC time range. Used by the EOD report:
 *   const { start, end } = localDayRange();
 *   const todaysMovements = await listMovementsInRange(start, end);
 */
export async function listMovementsInRange(
  startISO: string,
  endISO: string,
): Promise<StockMovement[]> {
  return db.stockMovements
    .where("createdAt")
    .between(startISO, endISO, true, false)
    .toArray();
}

/**
 * Net delta of one movement type for a product in a time range.
 * E.g. sumDeltaForProduct(productId, "receive", start, end) → total units received.
 */
export async function sumDeltaForProduct(
  productId: string,
  type: StockMovementType,
  startISO: string,
  endISO: string,
): Promise<number> {
  const rows = await db.stockMovements
    .where("[productId+createdAt]")
    .between([productId, startISO], [productId, endISO], true, false)
    .filter((m) => m.type === type)
    .toArray();
  return rows.reduce((sum, m) => sum + m.qtyDelta, 0);
}

/**
 * Opening stock for a product on the given business day:
 * the sum of all movements strictly BEFORE the start of that day,
 * starting from 0 (products are created with stock = 0, and every
 * subsequent stock change goes through the ledger).
 */
export async function getOpeningStockForDay(
  productId: string,
  dayStartISO: string,
): Promise<number> {
  const rows = await db.stockMovements
    .where("[productId+createdAt]")
    .between([productId, "0000-01-01T00:00:00Z"], [productId, dayStartISO], true, false)
    .toArray();
  return rows.reduce((sum, m) => sum + m.qtyDelta, 0);
}

/**
 * Compute the full stock reconciliation for a business day:
 * per product — opening, received, sold, wasted, adjusted, expected closing.
 *
 * The arithmetic is guaranteed to reconcile:
 *   expectedClosing = opening + received + returns − sold − wasted + adjustments
 *
 * The UI compares `expectedClosing` against what the cashier counted
 * (`actualClosing`) and shows the variance.
 */
export async function getStockReconciliationForDay(
  startISO: string,
  endISO: string,
): Promise<StockReconciliation[]> {
  const products = await listProducts();
  const result: StockReconciliation[] = [];

  for (const product of products) {
    const opening = await getOpeningStockForDay(product.id, startISO);

    const dayMovements = await listMovementsInRange(startISO, endISO);
    const mine = dayMovements.filter((m) => m.productId === product.id);

    let received = 0;
    let sold = 0;
    let wasted = 0;
    let adjusted = 0;

    for (const m of mine) {
      switch (m.type) {
        case "receive":
          received += m.qtyDelta;
          break;
        case "sale":
          sold += -m.qtyDelta; // qtyDelta is negative for sales
          break;
        case "waste":
          wasted += -m.qtyDelta;
          break;
        case "return":
          received += m.qtyDelta;
          break;
        case "adjustment":
          adjusted += m.qtyDelta;
          break;
      }
    }

    const expectedClosing = opening + received - sold - wasted + adjusted;

    result.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      openingStock: opening,
      received,
      sold,
      wasted,
      adjusted,
      expectedClosing,
      actualClosing: null, // filled in by the EOD UI
      variance: null,
    });
  }

  return result;
}