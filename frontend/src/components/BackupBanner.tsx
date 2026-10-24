// ─────────────────────────────────────────────────────────────
// Backup reminder banner. Shows at the top of the app when:
//   - No backup has been made in > 3 days, OR
//   - Persistent storage was denied, OR
//   - It has never been backed up.
//
// The banner is intentionally non-blocking — the cashier can
// dismiss it for the session, but it comes back next launch until
// a real backup happens.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { AlertTriangle, Download, X } from "lucide-react";
import { downloadBackup, lastBackupAt } from "@/backup/export";
import { checkPersistState, type PersistState } from "@/pwa/persist";

const DISMISS_KEY = "pos.bannerDismissedAt";
const DISMISS_HOURS = 12;

export default function BackupBanner() {
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      setPersist(await checkPersistState());
      setLastAt(lastBackupAt());
      try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (raw) {
          const at = Number(raw);
          if (Date.now() - at < DISMISS_HOURS * 60 * 60 * 1000) {
            setDismissed(true);
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  if (dismissed) return null;

  const daysSince = lastAt
    ? Math.floor((Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const needsBackup =
    lastAt === null || (daysSince !== null && daysSince >= 3);
  const persistenceDenied = persist !== null && !persist.granted;

  if (!needsBackup && !persistenceDenied) return null;

  const message = !lastAt
    ? "You have never backed up. If this phone is lost, all sales are gone."
    : persistenceDenied
    ? `Browser may delete data. Last backup ${daysSince} day${daysSince === 1 ? "" : "s"} ago.`
    : `Last backup was ${daysSince} day${daysSince === 1 ? "" : "s"} ago. Back up now to protect your shop data.`;

  async function onBackup() {
    setWorking(true);
    try {
      await downloadBackup();
      setLastAt(lastBackupAt());
    } finally {
      setWorking(false);
    }
  }

  function onDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.625rem 0.75rem",
        background: "#fef3c7",
        color: "#78350f",
        borderBottom: "1px solid #fcd34d",
        fontSize: "0.875rem",
        lineHeight: 1.3,
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>{message}</div>
      <button
        onClick={onBackup}
        disabled={working}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.375rem 0.625rem",
          background: "#78350f",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: "0.8125rem",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <Download size={14} />
        {working ? "Saving…" : "Back up"}
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          padding: 4,
          color: "#78350f",
          display: "flex",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}