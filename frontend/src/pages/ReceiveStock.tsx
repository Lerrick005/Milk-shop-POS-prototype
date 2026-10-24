// Receive stock — record a new delivery of an existing product.
// Creates a new batch (with expiry), writes a `receive` stock
// movement, and updates the product counter. Atomic in the DB.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import { getProduct } from "@/db/repos/products";
import { createBatch } from "@/db/repos/batches";
import { applyStockMovement } from "@/db/repos/stockLedger";
import { useAuth } from "@/auth/store";
import type { Product } from "@/types/models";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReceiveStock() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);

  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batchNumber, setBatchNumber] = useState("");
  const [expiry, setExpiry] = useState(todayPlus(30));
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) {
        setLoaded(true);
        return;
      }
      const p = await getProduct(id);
      if (!p) {
        setError("Product not found");
        setLoaded(true);
        return;
      }
      setProduct(p);
      setBatchNumber(`${p.sku}-${todayPlus(0)}`);
      setLoaded(true);
    })();
  }, [id]);

  if (!session) return null;
  const user = session; // non-null alias for use inside closures

  if (!loaded) {
    return <div style={{ padding: "2rem", color: "#64748b" }}>Loading…</div>;
  }

  async function onSubmit() {
    setError(null);
    if (!product) return;
    const q = Number(quantity);
    if (!Number.isInteger(q) || q <= 0) {
      setError("Quantity must be a whole number greater than 0");
      return;
    }
    if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      setError("Expiry date is required (YYYY-MM-DD)");
      return;
    }

    setBusy(true);
    try {
      const batch = await createBatch({
        productId: product.id,
        batchNumber: batchNumber.trim() || `${product.sku}-${expiry}`,
        expiryDate: expiry,
        quantity: q,
        notes: notes.trim() || undefined,
      });
      await applyStockMovement({
        productId: product.id,
        batchId: batch.id,
        type: "receive",
        qtyDelta: q,
        reason: notes.trim() || "Stock received",
        refId: batch.id,
        createdBy: user.userId,
        createdByName: user.name,
      });
      navigate("/inventory", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "1rem", background: "#f8fafc", minHeight: "100%" }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0.5rem 0",
          background: "transparent",
          border: "none",
          color: "#475569",
          fontSize: "0.875rem",
          marginBottom: "0.5rem",
        }}
      >
        <ArrowLeft size={18} /> Back
      </button>

      <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", color: "#0f172a" }}>
        Receive stock
      </h1>
      {product && (
        <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: "0.875rem" }}>
          {product.name} · current stock {product.stock} {product.unit}
        </p>
      )}

      <Field label="Quantity received">
        <input
          type="number"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="e.g. 24"
          autoFocus
          style={inputStyle}
        />
      </Field>

      <Field label="Expiry date">
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Batch number">
        <input
          value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
          style={inputStyle}
          placeholder="e.g. BROOK-2026-10-23"
        />
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
          placeholder="e.g. delivery from Brookside"
        />
      </Field>

      {error && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            padding: "0.625rem 0.875rem",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 10,
            fontSize: "0.8125rem",
            marginBottom: "0.75rem",
          }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={busy}
        style={{
          width: "100%",
          padding: "0.875rem",
          background: busy ? "#cbd5e1" : "#0f172a",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: "1rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Check size={16} /> {busy ? "Saving…" : "Record receipt"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  fontSize: "0.9375rem",
  background: "#fff",
  outline: "none",
  color: "#0f172a",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.875rem" }}>
      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}