// ─────────────────────────────────────────────────────────────
// Restore from a JSON backup file. DESTRUCTIVE: wipes the current
// database and replaces it with the backup contents.
//
// The caller (UI) is responsible for confirming with the user.
// This file validates the backup before touching anything, so a
// corrupt file cannot leave the shop half-restored.
// ─────────────────────────────────────────────────────────────

import { db } from "@/db/db";
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  type BackupFile,
} from "@/backup/export";

export type ImportSummary = {
  products: number;
  sales: number;
  batches: number;
  stockMovements: number;
  users: number;
  shifts: number;
};

/**
 * Validate a parsed JSON object as a BackupFile. Throws on any
 * problem — the message is shown to the user as-is.
 */
export function validateBackup(input: unknown): BackupFile {
  if (!input || typeof input !== "object") {
    throw new Error("Backup file is not a JSON object");
  }
  const b = input as Partial<BackupFile>;
  if (b.kind !== BACKUP_KIND) {
    throw new Error("This is not a Milk Shop POS backup file");
  }
  if (typeof b.version !== "number") {
    throw new Error("Backup file has no version");
  }
  if (b.version > BACKUP_VERSION) {
    throw new Error(
      `Backup was created by a newer version (${b.version}). Update the app before restoring.`,
    );
  }
  if (!b.data || typeof b.data !== "object") {
    throw new Error("Backup file has no data section");
  }
  const d = b.data as Record<string, unknown>;
  for (const key of [
    "users",
    "products",
    "batches",
    "sales",
    "saleItems",
    "stockMovements",
    "shifts",
  ]) {
    if (!Array.isArray(d[key])) {
      throw new Error(`Backup file is missing or has invalid "${key}" data`);
    }
  }
  return b as BackupFile;
}

/**
 * Restore from a BackupFile. Wipes the DB and repopulates atomically.
 * If anything fails during population, the whole restore rolls back —
 * the shop is left with the previous (still valid) data.
 */
export async function restoreBackup(
  input: unknown,
): Promise<ImportSummary> {
  const backup = validateBackup(input);

  await db.transaction(
    "rw",
    [
      db.users,
      db.products,
      db.batches,
      db.sales,
      db.saleItems,
      db.stockMovements,
      db.shifts,
    ],
    async () => {
      await db.users.clear();
      await db.products.clear();
      await db.batches.clear();
      await db.sales.clear();
      await db.saleItems.clear();
      await db.stockMovements.clear();
      await db.shifts.clear();

      await db.users.bulkAdd(backup.data.users as never[]);
      await db.products.bulkAdd(backup.data.products as never[]);
      await db.batches.bulkAdd(backup.data.batches as never[]);
      await db.sales.bulkAdd(backup.data.sales as never[]);
      await db.saleItems.bulkAdd(backup.data.saleItems as never[]);
      await db.stockMovements.bulkAdd(backup.data.stockMovements as never[]);
      await db.shifts.bulkAdd(backup.data.shifts as never[]);
    },
  );

  return {
    products: backup.data.products.length,
    sales: backup.data.sales.length,
    batches: backup.data.batches.length,
    stockMovements: backup.data.stockMovements.length,
    users: backup.data.users.length,
    shifts: backup.data.shifts.length,
  };
}

/**
 * Read a File object (from an <input type="file">) as text and
 * restore. Used by the Settings → Restore button.
 */
export async function restoreFromFile(file: File): Promise<ImportSummary> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Backup file is not valid JSON: ${String(err)}`);
  }
  return restoreBackup(parsed);
}