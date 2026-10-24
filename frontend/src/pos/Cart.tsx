// ─────────────────────────────────────────────────────────────
// Cart panel. Shows the current sale's line items, quantity
// controls, subtotal, and the Charge button.
//
// Uses useLiveQuery to read product details for each cart line,
// so prices shown are always current.
// ─────────────────────────────────────────────────────────────

import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { db } from "@/db/db";
import type { Product } from "@/types/models";
import { useCart } from "./cartStore";

export default function Cart({ onCharge }: { onCharge: () => void }) {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);

  const productIds = Object.keys(lines);

  const products = useLiveQuery(
    async () => {
      if (productIds.length === 0) return [] as Product[];
      const rows = await db.products.bulkGet(productIds);
      return rows.filter((p): p is Product => p !== undefined && p.deletedAt === null);
    },
    [productIds.join(",")],
    [] as Product[],
  );

  const items = products
    .map((p) => ({ product: p, qty: lines[p.id] ?? 0 }))
    .filter((x) => x.qty > 0);

  const subtotal = items.reduce((s, x) => s + x.product.price * x.qty, 0);
  const unitCount = items.reduce((s, x) => s + x.qty, 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderLeft: "1px solid #e2e8f0",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.875rem 1rem",
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShoppingCart size={18} color="#0f172a" />
          <span style={{ fontWeight: 700, color: "#0f172a" }}>Cart</span>
          <span style={{ color: "#64748b", fontSize: "0.8125rem" }}>
            {unitCount} item{unitCount === 1 ? "" : "s"}
          </span>
        </div>
        {items.length > 0 && (
          <button
            onClick={clear}
            style={{
              background: "transparent",
              border: "none",
              color: "#dc2626",
              fontSize: "0.8125rem",
              fontWeight: 600,
              padding: 4,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Lines */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {items.length === 0 && (
          <div
            style={{
              padding: "3rem 1rem",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: "0.875rem",
            }}
          >
            Cart is empty.
            <br />
            Tap a product to add it.
          </div>
        )}

        {items.map(({ product, qty }) => (
          <div
            key={product.id}
            style={{
              display: "flex",
              gap: "0.625rem",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #f1f5f9",
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {product.name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                KSh {product.price} × {qty} = KSh {product.price * qty}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <QtyBtn
                onClick={() => setQty(product.id, qty - 1)}
                aria="Decrease"
                icon={<Minus size={14} />}
              />
              <span
                style={{
                  minWidth: 24,
                  textAlign: "center",
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {qty}
              </span>
              <QtyBtn
                onClick={() => setQty(product.id, qty + 1)}
                aria="Increase"
                icon={<Plus size={14} />}
                disabled={qty >= product.stock}
              />
              <button
                aria-label="Remove"
                onClick={() => remove(product.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  marginLeft: 4,
                  background: "transparent",
                  border: "none",
                  color: "#dc2626",
                  borderRadius: 6,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #e2e8f0",
          padding: "0.875rem 1rem",
          background: "#fff",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ color: "#64748b", fontSize: "0.875rem" }}>Total</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
            KSh {subtotal}
          </span>
        </div>
        <button
          onClick={onCharge}
          disabled={items.length === 0}
          style={{
            width: "100%",
            padding: "0.875rem",
            background: items.length === 0 ? "#cbd5e1" : "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: "1rem",
            fontWeight: 700,
          }}
        >
          Charge KSh {subtotal}
        </button>
      </div>
    </div>
  );
}

function QtyBtn({
  onClick,
  disabled,
  aria,
  icon,
}: {
  onClick: () => void;
  disabled?: boolean;
  aria: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      aria-label={aria}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        background: disabled ? "#f8fafc" : "#fff",
        color: disabled ? "#cbd5e1" : "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}