// Product editor. Create new product (route: /inventory/new) or
// edit existing (route: /inventory/:id). Owner-only.
//
// This is where prices get changed. Editing does NOT touch stock —
// stock changes only happen through the ledger. Editing a price
// also does not rewrite past sales (sales carry their own price
// snapshot).

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2, AlertCircle } from "lucide-react";
import {
  createProduct,
  getProduct,
  softDeleteProduct,
  updateProduct,
} from "@/db/repos/products";
import { useAuth } from "@/auth/store";
import type { Product, ProductCategory, ProductUnit } from "@/types/models";

const CATEGORIES: ProductCategory[] = ["milk", "yoghurt", "butter", "cheese", "other"];
const UNITS: ProductUnit[] = ["packet", "box", "tub", "piece", "bottle"];

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);

  const [loaded, setLoaded] = useState(false);
  const [existing, setExisting] = useState<Product | null>(null);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("milk");
  const [unit, setUnit] = useState<ProductUnit>("packet");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [reorderPoint, setReorderPoint] = useState("0");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    (async () => {
      if (isNew) {
        setLoaded(true);
        return;
      }
      const p = await getProduct(id!);
      if (!p) {
        setError("Product not found");
        setLoaded(true);
        return;
      }
      setExisting(p);
      setSku(p.sku);
      setName(p.name);
      setCategory(p.category);
      setUnit(p.unit);
      setPrice(String(p.price));
      setCost(String(p.cost));
      setReorderPoint(String(p.reorderPoint));
      setNotes(p.notes ?? "");
      setLoaded(true);
    })();
  }, [id, isNew]);

  if (!session || session.role !== "owner") {
    return <GateDenied />;
  }

  async function onSave() {
    setError(null);
    const priceNum = Number(price);
    const costNum = Number(cost);
    const reorderNum = Number(reorderPoint);

    if (!name.trim()) return setError("Name is required");
    if (!isNew && !sku.trim()) return setError("SKU is required");
    if (!Number.isInteger(priceNum) || priceNum < 0)
      return setError("Price must be a whole number ≥ 0");
    if (!Number.isInteger(costNum) || costNum < 0)
      return setError("Cost must be a whole number ≥ 0");
    if (!Number.isInteger(reorderNum) || reorderNum < 0)
      return setError("Reorder point must be a whole number ≥ 0");

    setSaving(true);
    try {
      if (isNew) {
        if (!sku.trim()) {
          setSaving(false);
          return setError("SKU is required");
        }
        const created = await createProduct({
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          category,
          unit,
          price: priceNum,
          cost: costNum,
          reorderPoint: reorderNum,
          notes: notes.trim() || undefined,
          initialStock: 0,
        });
        navigate(`/inventory/${created.id}`, { replace: true });
      } else {
        await updateProduct({
          id: id!,
          name: name.trim(),
          category,
          unit,
          price: priceNum,
          cost: costNum,
          reorderPoint: reorderNum,
          notes: notes.trim() || undefined,
        });
        navigate("/inventory", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!existing) return;
    setSaving(true);
    try {
      await softDeleteProduct(existing.id);
      navigate("/inventory", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  if (!loaded) {
    return <div style={{ padding: "2rem", color: "#64748b" }}>Loading…</div>;
  }

  return (
    <div style={{ padding: "1rem", background: "#f8fafc", minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "0.5rem",
            background: "transparent",
            border: "none",
            color: "#475569",
            fontSize: "0.875rem",
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <h1 style={{ margin: "0 0 1rem", fontSize: "1.25rem", color: "#0f172a" }}>
        {isNew ? "New product" : `Edit ${existing?.name ?? ""}`}
      </h1>

      {existing && (
        <div
          style={{
            padding: "0.625rem 0.875rem",
            background: "#f1f5f9",
            borderRadius: 10,
            marginBottom: "1rem",
            fontSize: "0.8125rem",
            color: "#475569",
          }}
        >
          Current stock: <b>{existing.stock}</b> {existing.unit}s · SKU {existing.sku}
        </div>
      )}

      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Fresh Milk 500ml" />
      </Field>

      <Field label="SKU">
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value.toUpperCase())}
          disabled={!isNew}
          style={{ ...inputStyle, background: !isNew ? "#f8fafc" : "#fff" }}
          placeholder="e.g. MILK-500"
        />
        {!isNew && (
          <div style={{ fontSize: "0.6875rem", color: "#94a3b8", marginTop: 4 }}>
            SKU cannot be changed after creation.
          </div>
        )}
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)} style={inputStyle}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)} style={inputStyle}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <Field label="Selling price (KSh)">
          <input
            type="number"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={inputStyle}
            placeholder="0"
          />
        </Field>
        <Field label="Cost (KSh)">
          <input
            type="number"
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            style={inputStyle}
            placeholder="0"
          />
        </Field>
      </div>

      <Field label="Reorder point (warn when stock ≤ this)">
        <input
          type="number"
          inputMode="numeric"
          value={reorderPoint}
          onChange={(e) => setReorderPoint(e.target.value)}
          style={inputStyle}
          placeholder="0"
        />
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
          placeholder="e.g. Only order from Brookside"
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
        onClick={onSave}
        disabled={saving}
        style={{
          width: "100%",
          padding: "0.875rem",
          background: saving ? "#cbd5e1" : "#0f172a",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: "1rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginBottom: "0.75rem",
        }}
      >
        <Save size={16} /> {saving ? "Saving…" : isNew ? "Create product" : "Save changes"}
      </button>

      {existing && !confirmingDelete && (
        <button
          onClick={() => setConfirmingDelete(true)}
          style={{
            width: "100%",
            padding: "0.75rem",
            background: "#fff",
            color: "#dc2626",
            border: "1px solid #fecaca",
            borderRadius: 10,
            fontSize: "0.875rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Trash2 size={14} /> Delete product
        </button>
      )}

      {existing && confirmingDelete && (
        <div
          style={{
            padding: "0.875rem",
            background: "#fef2f2",
            borderRadius: 10,
            border: "1px solid #fecaca",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "#991b1b", marginBottom: "0.75rem" }}>
            Delete <b>{existing.name}</b>? Past sales referencing it are not affected. This can be undone from a backup restore.
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setConfirmingDelete(false)}
              style={{
                flex: 1,
                padding: "0.625rem",
                background: "#fff",
                color: "#0f172a",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              disabled={saving}
              style={{
                flex: 1,
                padding: "0.625rem",
                background: "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 600,
              }}
            >
              {saving ? "Deleting…" : "Confirm delete"}
            </button>
          </div>
        </div>
      )}
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

function GateDenied() {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
      Only the owner can edit products.
    </div>
  );
}