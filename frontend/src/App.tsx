import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BackupBanner from "@/components/BackupBanner";
import AppNav from "@/components/AppNav";
import SignIn from "@/pages/SignIn";
import POS from "@/pages/POS";
import Inventory from "@/pages/Inventory";
import ProductEditor from "@/pages/ProductEditor";
import ReceiveStock from "@/pages/ReceiveStock";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import { useAuth } from "@/auth/store";
import { requestPersist } from "@/pwa/persist";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

const NO_NAV_PATHS = ["/signin"];

export default function App() {
  const load = useAuth((s) => s.load);
  const ready = useAuth((s) => s.ready);
  const session = useAuth((s) => s.session);
  const location = useLocation();

  useEffect(() => {
    load();
    requestPersist().catch(() => {});
  }, [load]);

  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", color: "#64748b",
      }}>
        Loading…
      </div>
    );
  }

  const showNav = session && !NO_NAV_PATHS.includes(location.pathname);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <BackupBanner />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Routes>
          <Route path="/signin" element={session ? <Navigate to="/pos" replace /> : <SignIn />} />
          <Route path="/pos" element={<RequireAuth><POS /></RequireAuth>} />
          <Route path="/inventory" element={<RequireAuth><Inventory /></RequireAuth>} />
          <Route path="/inventory/new" element={<RequireAuth><ProductEditor /></RequireAuth>} />
          <Route path="/inventory/:id" element={<RequireAuth><ProductEditor /></RequireAuth>} />
          <Route path="/inventory/:id/receive" element={<RequireAuth><ReceiveStock /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/" element={<Navigate to={session ? "/pos" : "/signin"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {showNav && <AppNav />}
    </div>
  );
}