// ─────────────────────────────────────────────────────────────
// Checkout modal. Two tabs: Cash, M-Pesa.
//
// Cash: quick-amount buttons + numeric input, live change-due
//       calculation, Confirm disabled if underpaid.
//
// M-Pesa: 10-char code input, Confirm disabled if too short.
//
// On Confirm: calls completeSale() (atomic in the DB), closes,
// shows the sale result to the parent, resets the cart.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Banknote, Check, Smartphone, X } from "lucide-react";
import { completeSale } from "@/db/repos/sales";
import { useCart } from "./cartStore";
import type { PaymentMethod, Sale } from "@/types/models";

type Props = {
  open: boolean;
  total: number;
  cashierId: string;
  cashierName: string;
  onClose: () => void;
  onComplete: (sale: Sale) => void;
};

const CASH_QUICK = [50, 100, 200, 500, 1000, 2000];

export default function Checkout({
  open,
  total,
  cashierId,
  cashierName,
  onClose,
  onComplete,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState("");
  const [mpesaCode, setMpesaCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const cashRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setCashInput(String(total));
      setMpesaCode("");
      setError(null);
      setBusy(false);
      setTimeout(() => cashRef.current?.select(), 50);
    }
  }, [open, total]);

  if (!open) return null;

  const cashGiven = Number(cashInput) || 0;
  const change = cashGiven - total;
  const cashValid = cashGiven >= total;
  const mpesaValid = /^[A-Z0-9]{6,}$/i.test(mpesaCode.trim());

  const canSubmit =
    !busy && ((method === "cash" && cashValid) || (method === "mpesa" && mpesaValid));

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const sale = await completeSale({
        lines: Object.entries(lines).map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
        paymentMethod: method,
        amountPaid: method === "cash" ? cashGiven : undefined,
        mpesaCode: method === "mpesa" ? mpesaCode.trim().toUpperCase() : undefined,
        cashierId,
        cashierName,
      });
      clear();
      onComplete(sale);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "1rem 1rem calc(1rem + env(safe-area-inset-bottom))",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <span style={{ fontWeight: 700, color: "#0f172a" }}>Payment</span>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              background: "transparent",
              border: "none",
              padding: 6,
              color: "#475569",
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            padding: "0.5rem 0 1rem",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>Total due</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a" }}>
            KSh {total}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 0" }}>
          <MethodTab
            active={method === "cash"}
            onClick={() => setMethod("cash")}
            icon={<Banknote size={16} />}
            label="Cash"
          />
          <MethodTab
            active={method === "mpesa"}
            onClick={() => setMethod("mpesa")}
            icon={<Smartphone size={16} />}
            label="M-Pesa"
          />
        </div>

        {method === "cash" ? (
          <>
            <label style={{ fontSize: "0.8125rem", color: "#475569", fontWeight: 600 }}>
              Cash received
            </label>
            <input
              ref={cashRef}
              type="number"
              inputMode="numeric"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "0.875rem 1rem",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: "1.5rem",
                fontWeight: 700,
                textAlign: "right",
                color: "#0f172a",
              }}
            />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.375rem",
                marginTop: "0.5rem",
              }}
            >
              <QuickBtn label="Exact" onClick={() => setCashInput(String(total))} />
              {CASH_QUICK.map((v) => (
                <QuickBtn
                  key={v}
                  label={`${v}`}
                  onClick={() => setCashInput(String(cashGiven + v))}
                />
              ))}
            </div>

            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.875rem 1rem",
                background: cashValid ? "#ecfdf5" : "#fef2f2",
                borderRadius: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontSize: "0.875rem",
                  color: cashValid ? "#065f46" : "#991b1b",
                  fontWeight: 600,
                }}
              >
                {cashValid ? "Change due" : "Short by"}
              </span>
              <span
                style={{
                  fontSize: "1.375rem",
                  fontWeight: 800,
                  color: cashValid ? "#065f46" : "#991b1b",
                }}
              >
                KSh {Math.abs(change)}
              </span>
            </div>
          </>
        ) : (
          <>
            <label style={{ fontSize: "0.8125rem", color: "#475569", fontWeight: 600 }}>
              M-Pesa transaction code
            </label>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              placeholder="e.g. QGH7XK2LMN"
              value={mpesaCode}
              onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "0.875rem 1rem",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: "1.125rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "#0f172a",
              }}
            />
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 6 }}>
              Read the code from the customer's M-Pesa confirmation SMS.
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.625rem 0.875rem",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              fontSize: "0.8125rem",
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            marginTop: "1rem",
            width: "100%",
            padding: "1rem",
            background: canSubmit ? "#059669" : "#cbd5e1",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: "1rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          <Check size={18} />
          {busy ? "Processing…" : "Confirm sale"}
        </button>
      </div>
    </div>
  );
}

function MethodTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.375rem",
        padding: "0.75rem",
        borderRadius: 10,
        border: "1px solid",
        borderColor: active ? "#0f172a" : "#e2e8f0",
        background: active ? "#0f172a" : "#fff",
        color: active ? "#fff" : "#334155",
        fontWeight: 600,
        fontSize: "0.875rem",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.375rem 0.75rem",
        background: "#f1f5f9",
        border: "none",
        borderRadius: 8,
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: "#334155",
      }}
    >
      {label}
    </button>
  );
}