// ─────────────────────────────────────────────────────────────
// Sales repository. The single most critical transaction in the
// app — a sale is atomic. Either everything commits (sale record,
// line items, stock deduction, ledger entries) or nothing does.
// Kill the phone mid-sale → no phantom sale, no orphan stock.
// ─────────────────────────────────────────────────────────────

import { db, localDateString, newId, nowISO, withSyncMeta } from "@/db/db";
import type {
  PaymentMethod,
  Product,
  Sale,
  SaleItem,
} from "@/types/models";
import { getProduct } from "@/db/repos/products";
import {
  listBatchesForProduct,
  _decrementBatchStockInternal,
} from "@/db/repos/batches";
import { _setStockInternal } from "@/db/repos/products";

// ─────────────────────────────────────────────────────────────
// Input types
// ─────────────────────────────────────────────────────────────

export type CartLine = {
  productId: string;
  quantity: number; // whole number, >= 1
};

export type CompleteSaleInput = {
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  /** Cash only — amount the customer handed over. */
  amountPaid?: number;
  /** M-Pesa only — Safaricom transaction code. */
  mpesaCode?: string;
  /** Who rang the sale. */
  cashierId: string;
  cashierName: string;
};

// ─────────────────────────────────────────────────────────────
// Complete a sale — atomic
// ─────────────────────────────────────────────────────────────

/**
 * Complete a sale. This is the ONLY way a sale enters the database.
 *
 * Guarantees:
 *   - Atomic: sale + items + stock deductions + ledger rows all commit
 *     together, or none of them do.
 *   - Stock-safe: refuses to oversell (throws before touching anything).
 *   - FIFO by expiry: each unit comes from the oldest-expiring batch.
 *   - Unique receipt number: enforced by schema's &receiptNumber index.
 *   - Snapshots product name + price + unit, so future price changes
 *     don't rewrite history.
 */
export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  // ── Validate input before doing ANY work ────────────────────
  if (input.lines.length === 0) {
    throw new Error("Cannot complete a sale with an empty cart");
  }
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Invalid quantity: ${line.quantity}`);
    }
  }

  if (input.paymentMethod === "cash") {
    if (input.amountPaid === undefined || input.amountPaid < 0) {
      throw new Error("Cash payment requires amountPaid >= 0");
    }
  }
  if (input.paymentMethod === "mpesa") {
    if (!input.mpesaCode || input.mpesaCode.trim().length < 6) {
      throw new Error("M-Pesa payment requires a transaction code");
    }
  }

  // ── Load products and validate stock BEFORE the transaction ─
  // Doing this outside the tx means a stock error fails fast
  // without any partial writes.
  const productsById = new Map<string, Product>();
  for (const line of input.lines) {
    const p = await getProduct(line.productId);
    if (!p) throw new Error(`Product ${line.productId} not found`);
    if (p.stock < line.quantity) {
      throw new Error(
        `Not enough stock for "${p.name}": have ${p.stock}, need ${line.quantity}`,
      );
    }
    productsById.set(line.productId, p);
  }

  // ── Compute totals ──────────────────────────────────────────
  const saleId = newId();
  const createdAt = nowISO();
  const receiptNumber = await nextReceiptNumber();

  const items: SaleItem[] = [];
  let subtotal = 0;

  for (const line of input.lines) {
    const p = productsById.get(line.productId)!;
    const lineTotal = p.price * line.quantity;
    subtotal += lineTotal;

    items.push({
      id: newId(),
      saleId,
      productId: p.id,
      batchId: null, // filled in during the tx (FIFO pick)
      productNameSnapshot: p.name,
      unitSnapshot: p.unit,
      unitPriceSnapshot: p.price,
      quantity: line.quantity,
      lineTotal,
      _lastModified: createdAt,
      _localVersion: 1,
    });
  }

  const total = subtotal;
  let amountPaid: number | null = null;
  let changeGiven: number | null = null;
  let mpesaCode: string | null = null;

  if (input.paymentMethod === "cash") {
    amountPaid = input.amountPaid!;
    if (amountPaid < total) {
      throw new Error(
        `Cash paid (${amountPaid}) is less than total (${total})`,
      );
    }
    changeGiven = amountPaid - total;
  } else {
    mpesaCode = input.mpesaCode!.trim().toUpperCase();
  }

  const sale: Sale = withSyncMeta({
    receiptNumber,
    createdAt,
    cashierId: input.cashierId,
    cashierNameSnapshot: input.cashierName,
    subtotal,
    total,
    paymentMethod: input.paymentMethod,
    amountPaid,
    changeGiven,
    mpesaCode,
    items,
  }) as Sale;

  // ── The atomic transaction ──────────────────────────────────
  // Everything below happens inside ONE Dexie transaction. If any
  // step throws (e.g. batch stock went stale, disk full), Dexie
  // rolls back everything. No phantom sales, no orphan deductions.
  await db.transaction(
    "rw",
    db.sales,
    db.saleItems,
    db.products,
    db.batches,
    db.stockMovements,
    async () => {
      // 1) Persist the sale
      await db.sales.add(sale);

      // 2) For each line, deduct from oldest-expiring batches (FIFO)
      //    and write a sale ledger row per batch consumed.
      for (const item of items) {
        const p = productsById.get(item.productId)!;
        let remaining = item.quantity;
        let firstBatchId: string | null = null;

        const batches = await listBatchesForProduct(item.productId);

        for (const batch of batches) {
          if (remaining <= 0) break;
          if (batch.stock <= 0) continue;

          const take = Math.min(batch.stock, remaining);
          await _decrementBatchStockInternal(batch.id, take);

          // First batch consumed becomes the item's primary batchId
          // (for reference in the receipt and best-seller reports).
          if (firstBatchId === null) firstBatchId = batch.id;

          // Write a ledger row for this batch consumption
          await db.stockMovements.add({
            id: newId(),
            productId: item.productId,
            batchId: batch.id,
            type: "sale",
            qtyDelta: -take,
            reason: null,
            refId: sale.id,
            createdBy: input.cashierId,
            createdByNameSnapshot: input.cashierName,
            createdAt,
            _lastModified: createdAt,
            _localVersion: 1,
          });

          remaining -= take;
        }

        // If batches didn't cover the whole quantity, the remainder
        // comes from untracked stock (products without batch tracking).
        // Deduct from the product counter via a single ledger row.
        if (remaining > 0) {
          await _setStockInternal(item.productId, p.stock - item.quantity);
          if (firstBatchId === null) {
            // No batch at all — write a ledger row with null batchId
            await db.stockMovements.add({
              id: newId(),
              productId: item.productId,
              batchId: null,
              type: "sale",
              qtyDelta: -item.quantity,
              reason: null,
              refId: sale.id,
              createdBy: input.cashierId,
              createdByNameSnapshot: input.cashierName,
              createdAt,
              _lastModified: createdAt,
              _localVersion: 1,
            });
          }
        } else {
          // All units came from batches — also update the product counter
          // to match the total deducted. (Batch deductions alone don't
          // touch the product counter — that's the ledger's job.)
          await _setStockInternal(item.productId, p.stock - item.quantity);
        }

        // Stamp the item with its primary batch reference
        item.batchId = firstBatchId;
      }

      // 3) Persist line items (with batchId now filled in)
      await db.saleItems.bulkAdd(items);
    },
  );

  return sale;
}

// ─────────────────────────────────────────────────────────────
// Receipt numbering
// ─────────────────────────────────────────────────────────────

/**
 * Generate the next receipt number for today.
 * Format: YYYYMMDD-NNNN, e.g. "20261023-0042".
 * Resets each business day, so the cashier says "receipt 42" —
 * not "receipt 1847".
 *
 * Relies on the schema's &receiptNumber unique index as the final
 * guarantee against collision — if two sales race (impossible on a
 * single phone, but the constraint is there), the second throws.
 */
async function nextReceiptNumber(): Promise<string> {
  const today = localDateString();
  const prefix = today.replace(/-/g, ""); // "20261023"
  const todays = await db.sales
    .filter((s) => s.receiptNumber.startsWith(prefix))
    .toArray();
  const nextSeq = todays.length + 1;
  return `${prefix}-${String(nextSeq).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Reads — used by dashboard, history, EOD
// ─────────────────────────────────────────────────────────────

/** All live sales in a UTC time range, newest first. */
export async function listSalesInRange(
  startISO: string,
  endISO: string,
): Promise<Sale[]> {
  const rows = await db.sales
    .where("createdAt")
    .between(startISO, endISO, true, false)
    .filter((s) => s.deletedAt === null)
    .toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Sales for a specific cashier in a time range. */
export async function listSalesByCashier(
  cashierId: string,
  startISO: string,
  endISO: string,
): Promise<Sale[]> {
  const rows = await db.sales
    .where("[createdAt+cashierId]")
    .between([startISO, cashierId], [endISO, cashierId], true, false)
    .filter((s) => s.deletedAt === null)
    .toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Look up a sale by its receipt number (e.g. customer dispute). */
export async function getSaleByReceipt(
  receiptNumber: string,
): Promise<Sale | undefined> {
  const s = await db.sales.where("receiptNumber").equals(receiptNumber).first();
  if (!s || s.deletedAt !== null) return undefined;
  return s;
}

/** Look up a sale by id. */
export async function getSale(id: string): Promise<Sale | undefined> {
  const s = await db.sales.get(id);
  if (!s || s.deletedAt !== null) return undefined;
  return s;
}

/** Best-selling products in a time range, descending by units sold. */
export async function bestSellers(
  startISO: string,
  endISO: string,
  limit = 10,
): Promise<Array<{ productId: string; name: string; units: number; revenue: number }>> {
  const sales = await listSalesInRange(startISO, endISO);
  const map = new Map<string, { name: string; units: number; revenue: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const cur = map.get(item.productId) ?? {
        name: item.productNameSnapshot,
        units: 0,
        revenue: 0,
      };
      cur.units += item.quantity;
      cur.revenue += item.lineTotal;
      map.set(item.productId, cur);
    }
  }
  return [...map.entries()]
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
}

/**
 * Aggregate totals for a business day. This is what the dashboard and
 * the EOD report both consume.
 */
export async function dayTotals(
  startISO: string,
  endISO: string,
): Promise<{
  saleCount: number;
  totalRevenue: number;
  cashRevenue: number;
  mpesaRevenue: number;
  mpesaCodes: string[];
}> {
  const sales = await listSalesInRange(startISO, endISO);
  let cashRevenue = 0;
  let mpesaRevenue = 0;
  const mpesaCodes: string[] = [];
  for (const s of sales) {
    if (s.paymentMethod === "cash") cashRevenue += s.total;
    else if (s.paymentMethod === "mpesa") {
      mpesaRevenue += s.total;
      if (s.mpesaCode) mpesaCodes.push(s.mpesaCode);
    }
  }
  return {
    saleCount: sales.length,
    totalRevenue: cashRevenue + mpesaRevenue,
    cashRevenue,
    mpesaRevenue,
    mpesaCodes: [...new Set(mpesaCodes)], // dedupe in case of retry
  };
}

/** Soft-delete a sale (owner correcting a mistake). Tombstone. */
export async function voidSale(id: string, reason: string): Promise<void> {
  if (!reason || reason.trim() === "") {
    throw new Error("Void reason is required");
  }
  const existing = await db.sales.get(id);
  if (!existing) return;
  await db.sales.put({
    ...existing,
    deletedAt: nowISO(),
    _syncStatus: "pending",
    _lastModified: nowISO(),
    _localVersion: existing._localVersion + 1,
  });
  // Note: stock is NOT auto-restored on void. That's deliberate —
  // restoring stock requires knowing which batches to push back to,
  // which is a bigger feature. For v1, the cashier manually adjusts.
}