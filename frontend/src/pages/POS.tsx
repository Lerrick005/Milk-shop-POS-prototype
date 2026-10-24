// POS screen — header now shows live today's revenue.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { LogOut, Milk, Check, Banknote, Smartphone } from "lucide-react";
import ProductGrid from "@/pos/ProductGrid";
import Cart from "@/pos/Cart";
import Checkout from "@/pos/Checkout";
import { useCart } from "@/pos/cartStore";
import { useAuth } from "@/auth/store";
import { db, localDayRange } from "@/db/db";
import { dayTotals } from "@/db/repos/sales";
import { colors, radius, shadow, space } from "@/styles/tokens";
import type { Product, Sale } from "@/types/models";

export default function POS() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);
  const lines = useCart((s) => s.lines);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

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
  const total = products.reduce((sum, p) => sum + p.price * (lines[p.id] ?? 0), 0);

  const { start, end } = localDayRange();
  const totals = useLiveQuery(() => dayTotals(start, end), [start, end], undefined);

  if (!session) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: colors.bg,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${space[3]} ${space[4]}`,
          paddingTop: `max(${space[3]}, env(safe-area-inset-top))`,
          background: colors.primary,
          color: "#fff",
          flexShrink: 0,
          gap: space[3],
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: space[2], flexShrink: 0 }}>
          <Milk size={20} />
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", lineHeight: 1.1 }}>
              ShopPOS
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#94a3b8", marginTop: 2 }}>
              {session.name} · {session.role}
            </div>
          </div>
        </div>

        {/* Live ticker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: space[3],
            padding: "6px 10px",
            background: "rgba(255,255,255,0.08)",
            borderRadius: radius.md,
            flex: 1,
            justifyContent: "flex-end",
            maxWidth: 260,
          }}
        >
          <div style={{ textAlign: "right", lineHeight: 1.1 }}>
            <div style={{ fontSize: "0.625rem", color: "#94a3b8", fontWeight: 600, letterSpacing: "0.04em" }}>
              TODAY
            </div>
            <div style={{ fontWeight: 800, fontSize: "0.875rem", color: "#fff" }}>
              KSh {(totals?.totalRevenue ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.625rem", color: "#a7f3d0" }}>
              <Banknote size={9} />
              <span>{(totals?.cashRevenue ?? 0).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.625rem", color: "#fbbf24" }}>
              <Smartphone size={9} />
              <span>{(totals?.mpesaRevenue ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            signOut();
            navigate("/signin", { replace: true });
          }}
          aria-label="Sign out"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "none",
            borderRadius: radius.md,
            flexShrink: 0,
          }}
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Grid + Cart */}
      <div
        className="pos-body"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gridTemplateRows: "minmax(0, 1fr) minmax(280px, 42vh)",
          minHeight: 0,
        }}
      >
        <style>{`
          @media (min-width: 840px) {
            .pos-body {
              grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr) !important;
              grid-template-rows: minmax(0, 1fr) !important;
            }
          }
        `}</style>
        <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <ProductGrid />
        </div>
        <div style={{ minHeight: 0 }}>
          <Cart onCharge={() => setCheckoutOpen(true)} />
        </div>
      </div>

      <Checkout
        open={checkoutOpen}
        total={total}
        cashierId={session.userId}
        cashierName={session.name}
        onClose={() => setCheckoutOpen(false)}
        onComplete={(sale) => {
          setLastSale(sale);
          setCheckoutOpen(false);
        }}
      />

      {lastSale && (
        <SaleToast sale={lastSale} onDismiss={() => setLastSale(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sale confirmation toast — with bounce-in, count-up animation,
// and haptic vibration on Android.
// ─────────────────────────────────────────────────────────────

function SaleToast({ sale, onDismiss }: { sale: Sale; onDismiss: () => void }) {
  const [visibleAmount, setVisibleAmount] = useState(0);

  // Count up from 0 to sale.total in 500ms
  useState(() => {
    const duration = 500;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setVisibleAmount(Math.round(sale.total * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // Haptic on Android (harmless no-op on iOS)
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([30, 30, 60]);
      } catch {
        /* ignore */
      }
    }
  });

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: "calc(1rem + env(safe-area-inset-bottom))",
        left: 16,
        right: 16,
        background: "#065f46",
        color: "#fff",
        padding: "1rem",
        borderRadius: radius.lg,
        display: "flex",
        alignItems: "center",
        gap: space[3],
        boxShadow: shadow.xl,
        zIndex: 60,
        maxWidth: 480,
        margin: "0 auto",
        animation: "slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#ecfdf5",
          color: "#065f46",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          animation: "popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both",
        }}
      >
        <Check size={26} strokeWidth={3} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.6875rem", color: "#bbf7d0", fontWeight: 600, letterSpacing: "0.04em" }}>
          SALE COMPLETE · #{sale.receiptNumber}
        </div>
        <div style={{ fontSize: "1.375rem", fontWeight: 800, marginTop: 2, lineHeight: 1.1 }}>
          KSh {visibleAmount.toLocaleString()}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#bbf7d0", marginTop: 2 }}>
          {sale.paymentMethod === "cash"
            ? `Cash · change KSh ${sale.changeGiven}`
            : `M-Pesa · ${sale.mpesaCode}`}
        </div>
      </div>
    </div>
  );
}