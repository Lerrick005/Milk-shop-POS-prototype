// Product grid — with real category icons, category tints, and a
// visible "+ Add" affordance on each tile.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle, Plus } from "lucide-react";
import { listProducts } from "@/db/repos/products";
import type { Product, ProductCategory } from "@/types/models";
import { useCart } from "./cartStore";
import CategoryIcon, { categoryTint } from "@/components/CategoryIcon";
import { colors, radius, shadow, space } from "@/styles/tokens";

const CATEGORIES: Array<{ key: ProductCategory | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "milk", label: "Milk" },
  { key: "yoghurt", label: "Yoghurt" },
  { key: "butter", label: "Butter" },
  { key: "cheese", label: "Cheese" },
  { key: "other", label: "Other" },
];

export default function ProductGrid() {
  const [category, setCategory] = useState<ProductCategory | "all">("milk");
  const products = useLiveQuery(() => listProducts(), [], [] as Product[]);
  const addToCart = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);

  const filtered = useMemo(() => {
    const live = products.filter((p) => p.deletedAt === null);
    if (category === "all") return live;
    return live.filter((p) => p.category === category);
  }, [products, category]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div
        style={{
          display: "flex",
          gap: space[2],
          padding: space[3],
          overflowX: "auto",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          flexShrink: 0,
        }}
      >
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            style={{
              padding: "0.5rem 0.875rem",
              borderRadius: radius.full,
              border: "1px solid",
              borderColor: category === c.key ? colors.primary : colors.border,
              background: category === c.key ? colors.primary : colors.surface,
              color: category === c.key ? "#fff" : colors.textMuted,
              fontSize: "0.8125rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: space[3],
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: space[3],
          alignContent: "start",
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: colors.textSubtle,
              padding: `${space[8]} 0`,
              fontSize: "0.875rem",
            }}
          >
            No products in this category.
          </div>
        )}

        {filtered.map((p) => {
          const inCart = lines[p.id] ?? 0;
          const outOfStock = p.stock <= 0;
          const lowStock = !outOfStock && p.stock <= p.reorderPoint;
          const tint = categoryTint(p.category);

          return (
            <button
              key={p.id}
              onClick={() => !outOfStock && addToCart(p.id)}
              disabled={outOfStock}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: space[2],
                padding: space[3],
                background: outOfStock ? colors.surfaceMuted : colors.surface,
                border: `1px solid ${inCart > 0 ? colors.primary : colors.border}`,
                borderRadius: radius.lg,
                textAlign: "left",
                opacity: outOfStock ? 0.5 : 1,
                boxShadow: shadow.sm,
                minHeight: 150,
                transition: "transform 0.1s, box-shadow 0.15s, border-color 0.15s",
              }}
              onTouchStart={(e) => {
                if (!outOfStock) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
              }}
              onTouchEnd={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              {/* Icon chip */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  background: tint.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CategoryIcon category={p.category} size={30} />
              </div>

              {/* Cart badge */}
              {inCart > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: colors.primary,
                    color: "#fff",
                    borderRadius: radius.full,
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    minWidth: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 6px",
                    boxShadow: shadow.md,
                  }}
                >
                  {inCart}
                </span>
              )}

              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: colors.text,
                  lineHeight: 1.3,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  minHeight: "2.4em",
                }}
              >
                {p.name}
              </div>

              <div
                style={{
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: space[1],
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: colors.text }}>
                    KSh {p.price}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: outOfStock
                        ? colors.danger
                        : lowStock
                        ? colors.warning
                        : colors.textSubtle,
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    {(outOfStock || lowStock) && <AlertCircle size={9} />}
                    {outOfStock ? "Out" : `${p.stock} left`}
                  </span>
                </div>

                {/* Add pill */}
                {!outOfStock && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      padding: "4px 8px",
                      background: colors.primary,
                      color: "#fff",
                      borderRadius: radius.full,
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      boxShadow: shadow.sm,
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={11} strokeWidth={3} /> Add
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}