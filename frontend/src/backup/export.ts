// ─────────────────────────────────────────────────────────────
// Full-database JSON export. Produces a single file the shopkeeper
// can save to Google Drive, WhatsApp, or email to themselves.
// Restoring that file (import.ts) fully rebuilds the database.
//
// The export includes EVERY object store — nothing is skipped.
// It also stamps a version and creation timestamp so imports can
// reject incompatible files.
// ─────────────────────────────────────────────────────────────

import { db, localDateString, nowISO } from "@/db/db";

export const BACKUP_VERSION = 1;
export const BACKUP_KIND = "milk-shop-pos-backup";

export type BackupFile = {
  kind: typeof BACKUP_KIND;
  version: number;
  createdAt: string;
  /** Free-text label, e.g. "End of day 2026-10-23" */
  label: string;
  data: {
    users: unknown[];
    products: unknown[];
    batches: unknown[];
    sales: unknown[];
    saleItems: unknown[];
    stockMovements: unknown[];
    shifts: unknown[];
  };
};

/**
 * Read every live + tombstoned record and produce a BackupFile object.
 * Includes tombstones — otherwise restore would resurrect deleted
 * products on the next sync (a known sync-layer hazard).
 */
export async function exportDatabase(label?: string): Promise<BackupFile> {
  const [users, products, batches, sales, saleItems, stockMovements, shifts] =
    await Promise.all([
      db.users.toArray(),
      db.products.toArray(),
      db.batches.toArray(),
      db.sales.toArray(),
      db.saleItems.toArray(),
      db.stockMovements.toArray(),
      db.shifts.toArray(),
    ]);

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    createdAt: nowISO(),
    label: label ?? `Backup ${localDateString()}`,
    data: {
      users,
      products,
      batches,
      sales,
      saleItems,
      stockMovements,
      shifts,
    },
  };
}

/** Filename for a backup file, e.g. "pos-backup-2026-10-23-1830.json". */
export function backupFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${localDateString(d)}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `pos-backup-${stamp}.json`;
}

/**
 * Trigger a browser download of the backup. Uses Blob + anchor click,
 * which works on both desktop and Android Chrome. On iOS, this opens
 * the share sheet instead — equally fine, the shopkeeper picks
 * "Save to Files" or "Send via WhatsApp".
 */
export async function downloadBackup(label?: string): Promise<void> {
  const backup = await exportDatabase(label);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before we revoke.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try {
    localStorage.setItem("pos.lastBackupAt", nowISO());
  } catch {
    /* localStorage may be disabled — not fatal */
  }
}

/** Read the last successful backup time, or null if none. */
export function lastBackupAt(): string | null {
  try {
    return localStorage.getItem("pos.lastBackupAt");
  } catch {
    return null;
  }
}

/**
 * Approximate size of the JSON export, in bytes. Used to reassure
 * the shopkeeper that even months of sales are tiny.
 */
export async function estimateBackupSize(): Promise<number> {
  const backup = await exportDatabase();
  return new Blob([JSON.stringify(backup)]).size;
}