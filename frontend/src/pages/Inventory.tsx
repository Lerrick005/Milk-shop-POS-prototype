// Inventory list — with real category icons.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle, Plus, Search, PackagePlus } from "lucide-react";
import { listProducts } from "@/db/repos/products";
import { useAuth } from "@/auth/store";
import type { Product, ProductCategory } from "@/types/models";
import ExpiryBadge from "@/inventory/ExpiryBadge";
import CategoryIcon, { categoryTint } from "@/components/CategoryIcon";
import { colors, radius, shadow, space } from "@/styles/tokens";

const FILTERS: Array<{ key: ProductCategory | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "milk", label: "Milk" },
  { key: "yoghurt", label: "Yoghurt" },
  { key: "butter", label: "Butter" },
  { key: "cheese", label: "Cheese" },
  { key: "other", label: "Other" },
];

export default function Inventory() {
  const session = useAuth((s) => s.session);
  const isOwner = session?.role === "owner";
  const products = useLiveQuery(() => listProducts(), [], [] as Product[]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProductCategory | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.deletedAt === null)
      .filter((p) => filter === "all" || p.category === filter)
      .filter(
        (p) =>
          q === "" ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      );
  }, [products, query, filter]);

  const lowStockCount = products.filter(
    (p) => p.deletedAt === null && p.stock > 0 && p.stock <= p.reorderPoint,
  ).length;
  const outOfStockCount = products.filter(
    (p) => p.deletedAt === null && p.stock === 0,
  ).length;

  return (
    <div style={{ padding: space[4], background: colors.bg, minHeight: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: space[3],
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.375rem", color: colors.text, fontWeight: 700 }}>
          Inventory
        </h1>
        {isOwner && (
          <Link
            to="/inventory/new"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "0.5rem 0.875rem",
              background: colors.primary,
              color: "#fff",
              borderRadius: radius.md,
              fontSize: "0.8125rem",
              fontWeight: 600,
              boxShadow: shadow.sm,
            }}
          >
            <Plus size={14} /> Add
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: space[2], marginBottom: space[3], flexWrap: "wrap" }}>
        <Chip label={`${products.length} products`} tone="neutral" />
        {lowStockCount > 0 && <Chip label={`${lowStockCount} low stock`} tone="amber" />}
        {outOfStockCount > 0 && <Chip label={`${outOfStockCount} out of stock`} tone="red" />}
      </div>

      <div style={{ position: "relative", marginBottom: space[3] }}>
        <Search
          size={16}
          color={colors.textSubtle}
          style={{ position: "absolute", left: 12, top: 12 }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or SKU"
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem 0.625rem 2.25rem",
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            fontSize: "0.875rem",
            background: colors.surface,
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.375rem",
          marginBottom: space[3],
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "0.375rem 0.75rem",
              borderRadius: radius.full,
              border: "1px solid",
              borderColor: filter === f.key ? colors.primary : colors.border,
              background: filter === f.key ? colors.primary : colors.surface,
              color: filter === f.key ? "#fff" : colors.textMuted,
              fontSize: "0.75rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: colors.textSubtle, padding: `${space[8]} 0`, fontSize: "0.875rem" }}>
            No products match.
          </div>
        )}
        {filtered.map((p) => (
          <ProductRow key={p.id} product={p} isOwner={isOwner} />
        ))}
      </div>
    </div>
  );
}

function ProductRow({ product: p, isOwner }: { product: Product; isOwner: boolean }) {
  const outOfStock = p.stock === 0;
  const lowStock = p.stock > 0 && p.stock <= p.reorderPoint;
  const stockColor = outOfStock ? colors.danger : lowStock ? colors.warning : colors.success;
  const tint = categoryTint(p.category);

  const inner = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space[3],
        padding: space[3],
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        boxShadow: shadow.sm,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.md,
          background: tint.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <CategoryIcon category={p.category} size={28} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: colors.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.name}
        </div>
        <div
          style={{
            display: "flex",
            gap: space[2],
            marginTop: 2,
            fontSize: "0.75rem",
            color: colors.textMuted,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span>KSh {p.price}</span>
          <span style={{ color: colors.borderStrong }}>·</span>
          <span>{p.sku}</span>
          <ExpiryBadge productId={p.id} />
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: stockColor }}>
          {p.stock}
        </div>
        <div style={{ fontSize: "0.6875rem", color: colors.textMuted }}>
          {(outOfStock || lowStock) && (
            <AlertCircle size={10} style={{ verticalAlign: "middle", marginRight: 2 }} />
          )}
          {p.unit}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: space[2] }}>
      <div style={{ flex: 1 }}>
        {isOwner ? (
          <Link to={`/inventory/${p.id}`} style={{ textDecoration: "none" }}>
            {inner}
          </Link>
        ) : (
          inner
        )}
      </div>
      {isOwner && (
        <Link
          to={`/inventory/${p.id}/receive`}
          title="Receive stock"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            color: colors.primary,
            boxShadow: shadow.sm,
          }}
        >
          <PackagePlus size={20} />
        </Link>
      )}
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "neutral" | "amber" | "red" }) {
  const bg = tone === "red" ? colors.dangerBg : tone === "amber" ? colors.warningBg : colors.surfaceMuted;
  const fg = tone === "red" ? "#991b1b" : tone === "amber" ? "#92400e" : colors.textMuted;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.25rem 0.625rem",
        background: bg,
        color: fg,
        borderRadius: radius.full,
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}