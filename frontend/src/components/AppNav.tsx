// Bottom navigation. Four tabs, but the Cashier role only sees
// POS + Settings. Layout is thumb-friendly — safe-area aware,
// big icons, active state in slate-900.

import { NavLink } from "react-router-dom";
import { ShoppingCart, Package, BarChart3, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/auth/store";
import type { UserRole } from "@/types/models";

type Tab = {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Which roles can see this tab. Omit for "everyone". */
  roles?: UserRole[];
};

const TABS: Tab[] = [
  { to: "/pos", label: "POS", icon: <ShoppingCart size={22} /> },
  { to: "/inventory", label: "Inventory", icon: <Package size={22} /> },
  { to: "/dashboard", label: "Dashboard", icon: <BarChart3 size={22} />, roles: ["owner"] },
  { to: "/settings", label: "Settings", icon: <SettingsIcon size={22} /> },
];

export default function AppNav() {
  const session = useAuth((s) => s.session);
  const role = session?.role;

  const visible = TABS.filter((t) => !t.roles || (role && t.roles.includes(role)));

  return (
    <nav
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${visible.length}, 1fr)`,
        background: "#fff",
        borderTop: "1px solid #e2e8f0",
        paddingBottom: "env(safe-area-inset-bottom)",
        flexShrink: 0,
      }}
    >
      {visible.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "0.625rem 0.25rem",
            color: isActive ? "#0f172a" : "#64748b",
            fontSize: "0.6875rem",
            fontWeight: isActive ? 700 : 600,
            textDecoration: "none",
            position: "relative",
          })}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "20%",
                    right: "20%",
                    height: 2,
                    background: "#0f172a",
                    borderRadius: 2,
                  }}
                />
              )}
              {t.icon}
              {t.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}