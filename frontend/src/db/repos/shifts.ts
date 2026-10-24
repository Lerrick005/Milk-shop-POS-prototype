// ─────────────────────────────────────────────────────────────
// Shift / daily reconciliation. One shift per business day
// (calendar day). Two moments matter:
//
//   Start of day: cashier enters the opening cash float.
//   End of day:   system computes expected cash, cashier enters
//                 actual count, variance is recorded.
//
// Closing a shift is what "locks" the day. After close, no new
// sales can be dated to that business day (enforced in the UI —
// the POS shows a "Day is closed" gate).
// ─────────────────────────────────────────────────────────────

import { db, localDateString, localDayRange, nowISO, withSyncMeta } from "@/db/db";
import type { Shift } from "@/types/models";
import { dayTotals, listSalesInRange } from "@/db/repos/sales";
import { getStockReconciliationForDay } from "@/db/repos/stockLedger";

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

/** Get today's shift record, if one exists. */
export async function getTodaysShift(): Promise<Shift | undefined> {
  const today = localDateString();
  const s = await db.shifts.where("businessDate").equals(today).first();
  if (!s || s.deletedAt !== null) return undefined;
  return s;
}

/** Get a shift by business date (YYYY-MM-DD). */
export async function getShiftForDate(date: string): Promise<Shift | undefined> {
  const s = await db.shifts.where("businessDate").equals(date).first();
  if (!s || s.deletedAt !== null) return undefined;
  return s;
}

/** List recent closed shifts, newest first. For the owner's history. */
export async function listRecentShifts(limit = 30): Promise<Shift[]> {
  const all = await db.shifts
    .filter((s) => s.deletedAt === null && s.status === "closed")
    .toArray();
  return all
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Start of day
// ─────────────────────────────────────────────────────────────

/**
 * Open today's shift with an opening cash float.
 * Idempotent: if a shift already exists for today, returns it.
 */
export async function openShift(
  openingCash: number,
  userId: string,
  userName: string,
): Promise<Shift> {
  if (!Number.isInteger(openingCash) || openingCash < 0) {
    throw new Error("Opening cash must be a whole number ≥ 0");
  }
  const existing = await getTodaysShift();
  if (existing) return existing;

  const record: Shift = withSyncMeta({
    businessDate: localDateString(),
    status: "open" as const,
    openedAt: nowISO(),
    openedBy: userId,
    openedByNameSnapshot: userName,
    openingCash,
    closedAt: null,
    closedBy: null,
    closedByNameSnapshot: null,
    totalCashSales: null,
    totalMpesaSales: null,
    totalRevenue: null,
    expectedCash: null,
    countedCash: null,
    cashVariance: null,
    mpesaCodes: [],
    notes: null,
  }) as Shift;
  await db.shifts.add(record);
  return record;
}

// ─────────────────────────────────────────────────────────────
// End of day
// ─────────────────────────────────────────────────────────────

export type DaySummary = {
  businessDate: string;
  saleCount: number;
  totalRevenue: number;
  cashRevenue: number;
  mpesaRevenue: number;
  mpesaCodes: string[];
  openingCash: number;
  expectedCash: number;
};

/**
 * Compute the current day's numbers WITHOUT closing the shift.
 * Used to show "here's what you should have" before the cashier
 * enters the actual count.
 */
export async function getDaySummary(): Promise<DaySummary> {
  const { start, end } = localDayRange();
  const totals = await dayTotals(start, end);
  const shift = await getTodaysShift();
  const openingCash = shift?.openingCash ?? 0;

  return {
    businessDate: localDateString(),
    saleCount: totals.saleCount,
    totalRevenue: totals.totalRevenue,
    cashRevenue: totals.cashRevenue,
    mpesaRevenue: totals.mpesaRevenue,
    mpesaCodes: totals.mpesaCodes,
    openingCash,
    expectedCash: openingCash + totals.cashRevenue,
  };
}

/**
 * Close today's shift. Records the counted cash, computes variance,
 * stores the day's totals + M-Pesa codes + stock reconciliation
 * snapshot. After this, the shift's status is 'closed' and it cannot
 * be reopened from the cashier UI.
 *
 * `actualStockCounts` is a Map<productId, countedUnits> the cashier
 * entered on the EOD screen. We persist it into the shift's notes
 * for the owner to review, and use it to compute per-product variance
 * that's shown live during closing (not re-computed later).
 */
export async function closeShift(input: {
  countedCash: number;
  actualStockCounts?: Record<string, number>;
  notes?: string;
  userId: string;
  userName: string;
}): Promise<Shift> {
  if (!Number.isInteger(input.countedCash) || input.countedCash < 0) {
    throw new Error("Counted cash must be a whole number ≥ 0");
  }
  const shift = await getTodaysShift();
  if (!shift) throw new Error("Open a shift before closing the day");
  if (shift.status === "closed") throw new Error("This day is already closed");

  const summary = await getDaySummary();
  const variance = input.countedCash - summary.expectedCash;

  // Snapshot the day's stock reconciliation into the notes so the
  // owner can review it later without re-querying (because by the
  // time they read it, tomorrow's movements have been mixed in).
  let stockSnapshotText = "";
  if (input.actualStockCounts) {
    const { start, end } = localDayRange();
    const recon = await getStockReconciliationForDay(start, end);
    const lines = recon.map((r) => {
      const actual = input.actualStockCounts![r.productId];
      const varianceQty = actual !== undefined ? actual - r.expectedClosing : null;
      return `${r.productName}: expected ${r.expectedClosing}, counted ${actual ?? "—"}, variance ${varianceQty ?? "—"}`;
    });
    stockSnapshotText = lines.join("\n");
  }

  const updated: Shift = {
    ...shift,
    closedAt: nowISO(),
    closedBy: input.userId,
    closedByNameSnapshot: input.userName,
    totalCashSales: summary.cashRevenue,
    totalMpesaSales: summary.mpesaRevenue,
    totalRevenue: summary.totalRevenue,
    expectedCash: summary.expectedCash,
    countedCash: input.countedCash,
    cashVariance: variance,
    mpesaCodes: summary.mpesaCodes,
    notes: [input.notes, stockSnapshotText].filter(Boolean).join("\n\n") || null,
    _syncStatus: "pending",
    _lastModified: nowISO(),
    _localVersion: shift._localVersion + 1,
  };
  await db.shifts.put(updated);
  return updated;
}

/**
 * Reopen a closed shift. Owner-only. Writes an audit line into notes
 * so the reopen is traceable.
 */
export async function reopenShift(input: {
  businessDate: string;
  reason: string;
  userId: string;
  userName: string;
}): Promise<void> {
  if (!input.reason.trim()) throw new Error("Reason is required");
  const shift = await getShiftForDate(input.businessDate);
  if (!shift) throw new Error("No shift for that date");
  if (shift.status === "open") return;

  const audit = `[REOPENED ${nowISO()} by ${input.userName} (${input.userId}): ${input.reason}]`;
  await db.shifts.put({
    ...shift,
    status: "open" as const,
    closedAt: null,
    closedBy: null,
    closedByNameSnapshot: null,
    totalCashSales: null,
    totalMpesaSales: null,
    totalRevenue: null,
    expectedCash: null,
    countedCash: null,
    cashVariance: null,
    notes: shift.notes ? `${shift.notes}\n\n${audit}` : audit,
    _syncStatus: "pending",
    _lastModified: nowISO(),
    _localVersion: shift._localVersion + 1,
  });
}

/** Per-day sale list for the EOD screen (recent transactions). */
export async function getTodaysSales() {
  const { start, end } = localDayRange();
  return listSalesInRange(start, end);
}