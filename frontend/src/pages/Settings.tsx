// Settings. PIN change, backup/restore, upsell, sign out.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download, Upload, Lock, LogOut, MessageCircle,
  ShieldCheck, AlertCircle, Check,
} from "lucide-react";
import { useAuth } from "@/auth/store";
import { changePin } from "@/db/repos/users";
import { downloadBackup, lastBackupAt, estimateBackupSize } from "@/backup/export";
import { restoreFromFile } from "@/backup/import";

type Section = "menu" | "changePin" | "restore" | "backupDone";

export default function Settings() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);
  const [section, setSection] = useState<Section>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!session) return null;

  async function onBackup() {
    setBusy(true);
    setError(null);
    try {
      await downloadBackup();
      setSection("backupDone");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(file: File) {
    if (!confirm("Restore from backup? This REPLACES all current data on this phone.")) return;
    setBusy(true);
    setError(null);
    try {
      const summary = await restoreFromFile(file);
      setInfo(
        `Restored: ${summary.products} products, ${summary.sales} sales, ` +
        `${summary.batches} batches, ${summary.users} users.`,
      );
      setSection("menu");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "1rem", background: "#f8fafc", minHeight: "100%" }}>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.25rem", color: "#0f172a" }}>
        Settings
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            width: 40, height: 40, borderRadius: "50%", background: "#0f172a",
            color: "#fff", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "1rem", fontWeight: 700,
          }}
        >
          {session.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{session.name}</div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "capitalize" }}>
            {session.role}
          </div>
        </div>
      </div>

      {info && (
        <div
          style={{
            display: "flex", gap: "0.5rem", alignItems: "center",
            padding: "0.625rem 0.875rem", background: "#ecfdf5",
            color: "#065f46", borderRadius: 10, fontSize: "0.8125rem",
            marginBottom: "0.75rem",
          }}
        >
          <Check size={14} /> {info}
        </div>
      )}

      {section === "menu" && (
        <MenuSection
          onBackup={onBackup}
          onRestore={(f) => onRestore(f)}
          onChangePin={() => setSection("changePin")}
          busy={busy}
          error={error}
        />
      )}

      {section === "changePin" && (
        <ChangePinSection
          userId={session.userId}
          onDone={() => {
            setSection("menu");
            setInfo("PIN changed.");
          }}
          onCancel={() => setSection("menu")}
        />
      )}

      {section === "backupDone" && (
        <div
          style={{
            padding: "1rem", background: "#ecfdf5", color: "#065f46",
            borderRadius: 12, fontSize: "0.875rem", marginBottom: "1rem",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Backup saved.</div>
          The JSON file was downloaded to your phone. Move it to Google Drive,
          WhatsApp yourself, or email it — anything outside this phone.
          <div style={{ marginTop: "0.75rem" }}>
            <button
              onClick={() => setSection("menu")}
              style={{
                padding: "0.5rem 0.875rem", background: "#065f46", color: "#fff",
                border: "none", borderRadius: 8, fontSize: "0.8125rem",
                fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Upsell */}
      <UpsellCard />

      {/* Sign out */}
      <button
        onClick={() => {
          signOut();
          navigate("/signin", { replace: true });
        }}
        style={{
          marginTop: "1rem", width: "100%", padding: "0.75rem",
          background: "#fff", color: "#dc2626",
          border: "1px solid #fecaca", borderRadius: 10,
          fontSize: "0.875rem", fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function MenuSection({
  onBackup, onRestore, onChangePin, busy, error,
}: {
  onBackup: () => void;
  onRestore: (file: File) => void;
  onChangePin: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [size, setSize] = useState<number | null>(null);
  const last = lastBackupAt();
  const daysAgo = last
    ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
    : null;

  useState(() => {
    estimateBackupSize().then(setSize).catch(() => {});
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Card title="Change PIN" icon={<Lock size={16} />} onClick={onChangePin} />

      <Card
        title="Back up now"
        subtitle={
          last
            ? `Last backup: ${daysAgo}d ago${size ? ` · ${(size / 1024).toFixed(1)} KB` : ""}`
            : "Never backed up"
        }
        icon={<Download size={16} />}
        onClick={onBackup}
        disabled={busy}
      />

      <label
        style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.875rem", background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 12, cursor: "pointer",
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "#f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#0f172a",
        }}>
          <Upload size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9375rem" }}>
            Restore from backup
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
            Replaces all data on this phone
          </div>
        </div>
        <input
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onRestore(f);
            e.target.value = "";
          }}
          disabled={busy}
        />
      </label>

      {error && (
        <div
          style={{
            display: "flex", gap: "0.5rem", alignItems: "center",
            padding: "0.625rem 0.875rem", background: "#fef2f2",
            color: "#991b1b", borderRadius: 10, fontSize: "0.8125rem",
          }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  );
}

function Card({
  title, subtitle, icon, onClick, disabled,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.875rem", background: "#fff",
        border: "1px solid #e2e8f0", borderRadius: 12,
        textAlign: "left", width: "100%", opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: "#f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#0f172a",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9375rem" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{subtitle}</div>
        )}
      </div>
    </button>
  );
}

function ChangePinSection({
  userId, onDone, onCancel,
}: {
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (next !== confirm) return setError("New PINs do not match");
    if (!/^\d{4,6}$/.test(next)) return setError("New PIN must be 4-6 digits");
    setBusy(true);
    try {
      await changePin(userId, current, next);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: "1rem", background: "#fff",
        border: "1px solid #e2e8f0", borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.75rem" }}>
        <ShieldCheck size={16} color="#0f172a" />
        <span style={{ fontWeight: 700, color: "#0f172a" }}>Change PIN</span>
      </div>

      <Field label="Current PIN">
        <input
          type="password" inputMode="numeric" value={current}
          onChange={(e) => setCurrent(e.target.value)}
          maxLength={6} style={pinInput} autoFocus
        />
      </Field>
      <Field label="New PIN (4-6 digits)">
        <input
          type="password" inputMode="numeric" value={next}
          onChange={(e) => setNext(e.target.value)}
          maxLength={6} style={pinInput}
        />
      </Field>
      <Field label="Confirm new PIN">
        <input
          type="password" inputMode="numeric" value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          maxLength={6} style={pinInput}
        />
      </Field>

      {error && (
        <div style={{ color: "#dc2626", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            flex: 1, padding: "0.625rem", background: "#fff",
            color: "#0f172a", border: "1px solid #e2e8f0",
            borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600,
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            flex: 1, padding: "0.625rem",
            background: busy ? "#cbd5e1" : "#0f172a",
            color: "#fff", border: "none", borderRadius: 8,
            fontSize: "0.8125rem", fontWeight: 600,
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function UpsellCard() {
  return (
    <div
      style={{
        marginTop: "1.25rem", padding: "1rem",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderRadius: 12, color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.5rem" }}>
        <MessageCircle size={16} />
        <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>
          Want the full version?
        </span>
      </div>
      <div style={{ fontSize: "0.8125rem", color: "#cbd5e1", lineHeight: 1.4, marginBottom: "0.75rem" }}>
        This local version keeps all data on this phone. The full version adds
        multi-phone sync, owner dashboard from anywhere, and automatic cloud
        backups.
      </div>
      <a
        href="https://wa.me/254111240296?text=Hi%2C%20I%20just%20tried%20the%20ShopPOS%20demo%20and%20want%20to%20know%20about%20the%20full%20version."
        target="_blank" rel="noopener noreferrer"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "0.5rem 0.875rem", background: "#fff", color: "#0f172a",
          borderRadius: 8, fontSize: "0.8125rem", fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Contact us on WhatsApp →
      </a>
    </div>
  );
}

const pinInput: React.CSSProperties = {
  width: "100%", padding: "0.625rem 0.75rem",
  border: "1px solid #e2e8f0", borderRadius: 10,
  fontSize: "1.125rem", letterSpacing: "0.15em",
  textAlign: "center", background: "#fff", outline: "none",
  color: "#0f172a", fontWeight: 700,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.625rem" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}