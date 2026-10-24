// Dashboard. Owner-only summary screen — the "wow" screen.
//
// Sections (top → bottom):
//   1. Hero: today's revenue + sale count + payment split
//   2. Action cards: low stock / expiring soon / day status
//   3. Best sellers (rank medals)
//   4. Recent sales (last 5 with method badge)
//   5. Quick actions (EOD, sales history)

import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  TrendingUp, Banknote, Smartphone, AlertTriangle, Clock,
  ChevronRight, Trophy, Crown, Lock, LockOpen, Package,
} from "lucide-react";
import { dayTotals, bestSellers, listSalesInRange } from "@/db/repos/sales";
import { listLowStockProducts } from "@/db/repos/products";
import { listExpiringSoon } from "@/db/repos/batches";
import { getTodaysShift } from "@/db/repos/shifts";
import { localDayRange } from "@/db/db";
import { colors, radius, shadow, space, font } from "@/styles/tokens";
import type { Sale } from "@/types/models";

export default function Dashboard() {
  const navigate = useNavigate();
  const { start, end } = localDayRange();

  const totals = useLiveQuery(() => dayTotals(start, end), [start, end], undefined);
  const best = useLiveQuery(() => bestSellers(start, end, 5), [start, end], []);
  const low = useLiveQuery(() => listLowStockProducts(), [], []);
  const expiring = useLiveQuery(() => listExpiringSoon(7), [], []);
  const shift = useLiveQuery(() => getTodaysShift(), [], undefined);
  const recent = useLiveQuery(
    async () => {
      const s = await listSalesInRange(start, end);
      return s.slice(0, 5);
    },
    [start, end],
    [] as Sale[],
  );

  const mpesaShare =
    totals && totals.totalRevenue > 0
      ? Math.round((totals.mpesaRevenue / totals.totalRevenue) * 100)
      : 0;

  return (
    <div
      style={{
        padding: space[4],
        background: colors.bg,
        minHeight: "100%",
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
      }}
    >
      {/* Top greeting */}
      <div style={{ marginBottom: space[4] }}>
        <div style={{ fontSize: font.sm, color: colors.textMuted, fontWeight: 600 }}>
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <h1 style={{ margin: "2px 0 0", fontSize: "1.375rem", fontWeight: 800, color: colors.text }}>
          Today at a glance
        </h1>
      </div>

      {/* ── HERO: revenue card ──────────────────────────────── */}
      <div
        style={{
          padding: space[5],
          background: `linear-gradient(135deg, ${colors.primary} 0%, #1e293b 100%)`,
          borderRadius: radius.xl,
          color: "#fff",
          boxShadow: shadow.lg,
          marginBottom: space[3],
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circle */}
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: font.sm, color: "#cbd5e1", marginBottom: 6 }}>
          <TrendingUp size={14} />
          <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>Total sales today</span>
        </div>

        <div style={{ fontSize: "2.25rem", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          KSh {(totals?.totalRevenue ?? 0).toLocaleString()}
        </div>

        <div style={{ display: "flex", gap: space[4], marginTop: space[3], position: "relative" }}>
          <HeroStat
            icon={<Banknote size={14} />}
            label="Cash"
            value={`KSh ${(totals?.cashRevenue ?? 0).toLocaleString()}`}
          />
          <HeroStat
            icon={<Smartphone size={14} />}
            label="M-Pesa"
            value={`KSh ${(totals?.mpesaRevenue ?? 0).toLocaleString()}`}
          />
          <HeroStat
            icon={<Package size={14} />}
            label="Sales"
            value={String(totals?.saleCount ?? 0)}
          />
        </div>

        {/* Cash vs M-Pesa bar */}
        {totals && totals.totalRevenue > 0 && (
          <div style={{ marginTop: space[3] }}>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "rgba(255,255,255,0.15)",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div
                style={{
                  width: `${100 - mpesaShare}%`,
                  background: "#a7f3d0",
                  transition: "width 0.4s ease",
                }}
              />
              <div
                style={{
                  width: `${mpesaShare}%`,
                  background: "#fbbf24",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: font.xs, color: "#cbd5e1" }}>
              <span>{100 - mpesaShare}% cash</span>
              <span>{mpesaShare}% M-Pesa</span>
            </div>
          </div>
        )}
      </div>

      {/* ── ACTION CARDS ─────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: space[2],
          marginBottom: space[4],
        }}
      >
        <ActionCard
          icon={<AlertTriangle size={18} />}
          label="Low stock"
          value={low.length}
          tone={low.length > 0 ? "warning" : "neutral"}
          onClick={() => navigate("/inventory")}
        />
        <ActionCard
          icon={<Clock size={18} />}
          label="Expiring"
          value={expiring.length}
          tone={expiring.length > 0 ? "warning" : "neutral"}
          onClick={() => navigate("/inventory")}
        />
        <ActionCard
          icon={shift?.status === "closed" ? <Lock size={18} /> : <LockOpen size={18} />}
          label="Day status"
          value={shift?.status === "closed" ? "Closed" : "Open"}
          tone="neutral"
          onClick={() => navigate("/end-of-day")}
        />
      </div>

      {/* ── BEST SELLERS ─────────────────────────────────────── */}
      <Section title="Best sellers today">
        {best.length === 0 ? (
          <Empty>No sales yet today.</Empty>
        ) : (
          best.map((b, i) => (
            <div
              key={b.productId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: space[3],
                padding: `${space[3]} ${space[4]}`,
                borderBottom: i < best.length - 1 ? `1px solid ${colors.surfaceMuted}` : "none",
              }}
            >
              <RankBadge rank={i + 1} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: colors.text }}>
                  {b.name}
                </div>
                <div style={{ fontSize: font.xs, color: colors.textMuted }}>
                  {b.units} unit{b.units === 1 ? "" : "s"} sold
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: colors.text }}>
                  KSh {b.revenue.toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* ── RECENT SALES ─────────────────────────────────────── */}
      <Section title="Recent sales" action={{ label: "View all", onClick: () => navigate("/sales-history") }}>
        {recent.length === 0 ? (
          <Empty>Nothing sold yet today.</Empty>
        ) : (
          recent.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: space[3],
                padding: `${space[3]} ${space[4]}`,
                borderBottom: i < recent.length - 1 ? `1px solid ${colors.surfaceMuted}` : "none",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  background: s.paymentMethod === "cash" ? "#ecfdf5" : "#fef3c7",
                  color: s.paymentMethod === "cash" ? colors.success : colors.warning,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {s.paymentMethod === "cash" ? <Banknote size={16} /> : <Smartphone size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: colors.text }}>
                  #{s.receiptNumber}
                </div>
                <div style={{ fontSize: font.xs, color: colors.textMuted }}>
                  {new Date(s.createdAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {s.paymentMethod === "mpesa" && s.mpesaCode ? ` · ${s.mpesaCode}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: colors.text }}>
                  KSh {s.total.toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* ── QUICK ACTIONS ────────────────────────────────────── */}
      <button
        onClick={() => navigate("/end-of-day")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: space[3],
          width: "100%",
          padding: space[4],
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          boxShadow: shadow.sm,
          textAlign: "left",
          marginTop: space[3],
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            background: shift?.status === "closed" ? "#f1f5f9" : colors.primary,
            color: shift?.status === "closed" ? colors.textMuted : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {shift?.status === "closed" ? <Lock size={20} /> : <LockOpen size={20} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: colors.text, fontSize: "0.9375rem" }}>
            {shift?.status === "closed" ? "Day closed" : "End of day"}
          </div>
          <div style={{ fontSize: font.sm, color: colors.textMuted }}>
            {shift?.status === "closed"
              ? "Review today's reconciliation"
              : "Reconcile cash, count stock, close the day"}
          </div>
        </div>
        <ChevronRight size={18} color={colors.textSubtle} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function HeroStat({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8", fontSize: font.xs, fontWeight: 600, marginBottom: 2 }}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#fff" }}>{value}</div>
    </div>
  );
}

function ActionCard({
  icon, label, value, tone, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "warning" | "neutral";
  onClick: () => void;
}) {
  const bg = tone === "warning" ? colors.warningBg : colors.surface;
  const fg = tone === "warning" ? "#92400e" : colors.text;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
        padding: space[3],
        background: bg,
        border: `1px solid ${tone === "warning" ? "#fde68a" : colors.border}`,
        borderRadius: radius.lg,
        textAlign: "left",
        boxShadow: shadow.sm,
      }}
    >
      <div style={{ color: tone === "warning" ? colors.warning : colors.textMuted }}>{icon}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: fg, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: font.xs, color: tone === "warning" ? "#92400e" : colors.textMuted, fontWeight: 600 }}>
        {label}
      </div>
    </button>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div
        style={{
          width: 28, height: 28, borderRadius: radius.full,
          background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Crown size={16} />
      </div>
    );
  if (rank <= 3)
    return (
      <div
        style={{
          width: 28, height: 28, borderRadius: radius.full,
          background: "#fef3c7", color: colors.warning,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Trophy size={14} />
      </div>
    );
  return (
    <div
      style={{
        width: 28, height: 28, borderRadius: radius.full,
        background: colors.surfaceMuted, color: colors.textMuted,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.75rem", fontWeight: 700,
      }}
    >
      {rank}
    </div>
  );
}

function Section({
  title, action, children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: space[3] }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: space[2],
        }}
      >
        <span style={{ fontSize: font.sm, color: colors.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {title}
        </span>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              background: "transparent",
              border: "none",
              color: colors.primary,
              fontSize: font.sm,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: 4,
            }}
          >
            {action.label} <ChevronRight size={14} />
          </button>
        )}
      </div>
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          overflow: "hidden",
          boxShadow: shadow.sm,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: space[5],
        color: colors.textSubtle,
        fontSize: font.sm,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}