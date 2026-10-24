// ─────────────────────────────────────────────────────────────
// Sign-in screen. The first thing the cashier sees when they
// open the app. Deliberately: two large role tiles, then a big
// PIN pad. No keyboard, no text input — thumb-friendly at the
// counter.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Delete, Lock, ShieldCheck, ShoppingCart } from "lucide-react";
import { useAuth } from "@/auth/store";
import {
  attemptsRemaining,
  cooldownRemainingMs,
  recordFailure,
  recordSuccess,
} from "@/auth/pin";
import { verifyPinByRole } from "@/db/repos/users";
import type { UserRole } from "@/types/models";

type Step = "choose-role" | "enter-pin";

export default function SignIn() {
  const navigate = useNavigate();
  const signIn = useAuth((s) => s.signIn);

  const [step, setStep] = useState<Step>("choose-role");
  const [role, setRole] = useState<UserRole | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [busy, setBusy] = useState(false);

  // Tick the cooldown timer if active
  useEffect(() => {
    if (!role) return;
    const id = setInterval(() => {
      setCooldownMs(cooldownRemainingMs(role));
    }, 500);
    setCooldownMs(cooldownRemainingMs(role));
    return () => clearInterval(id);
  }, [role]);

  function chooseRole(r: UserRole) {
    setRole(r);
    setStep("enter-pin");
    setPin("");
    setError(null);
    setCooldownMs(cooldownRemainingMs(r));
  }

  function back() {
    setStep("choose-role");
    setRole(null);
    setPin("");
    setError(null);
  }

  function pressDigit(d: string) {
    if (busy) return;
    if (cooldownMs > 0) return;
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError(null);
    // Auto-submit at 4 digits (the common PIN length)
    if (next.length === 4) submit(next);
  }

  function pressBackspace() {
    if (busy) return;
    setPin(pin.slice(0, -1));
    setError(null);
  }

  async function submit(candidate: string) {
    if (!role) return;
    setBusy(true);
    try {
      const user = await verifyPinByRole(role, candidate);
      if (!user) {
        recordFailure(role);
        const left = attemptsRemaining(role);
        const cd = cooldownRemainingMs(role);
        setCooldownMs(cd);
        setPin("");
        if (cd > 0) {
          setError(
            `Too many attempts. Wait ${Math.ceil(cd / 1000)}s before trying again.`,
          );
        } else {
          setError(
            `Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} remaining.`,
          );
        }
        return;
      }
      recordSuccess(role);
      signIn({
        userId: user.id,
        name: user.name,
        role: user.role,
        signedInAt: new Date().toISOString(),
      });
      navigate("/pos", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f8fafc",
        padding: "1rem",
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {step === "choose-role" ? (
        <RolePicker onChoose={chooseRole} />
      ) : (
        <PinPad
          role={role!}
          pin={pin}
          onDigit={pressDigit}
          onBackspace={pressBackspace}
          onBack={back}
          error={error}
          cooldownMs={cooldownMs}
          busy={busy}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Role picker
// ─────────────────────────────────────────────────────────────

function RolePicker({ onChoose }: { onChoose: (r: UserRole) => void }) {
  return (
    <>
      <div style={{ textAlign: "center", padding: "2rem 0 1.5rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🥛</div>
        <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>
          Milk Shop POS
        </h1>
        <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.9375rem" }}>
          Who is signing in?
        </p>
      </div>

      <div style={{ flex: 1, display: "grid", gap: "1rem", alignContent: "center" }}>
        <RoleButton
          role="owner"
          title="Owner"
          subtitle="Full access — dashboard, inventory, prices"
          icon={<ShieldCheck size={28} />}
          onClick={() => onChoose("owner")}
        />
        <RoleButton
          role="cashier"
          title="Cashier"
          subtitle="Sell products, take payment"
          icon={<ShoppingCart size={28} />}
          onClick={() => onChoose("cashier")}
        />
      </div>

      <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.75rem" }}>
        Default PINs on first launch: Owner 1234 · Cashier 0000
      </div>
    </>
  );
}

function RoleButton({
  title,
  subtitle,
  icon,
  onClick,
}: {
  role: UserRole;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "1.25rem",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        textAlign: "left",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0f172a",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "1.0625rem", fontWeight: 600, color: "#0f172a" }}>
          {title}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// PIN pad
// ─────────────────────────────────────────────────────────────

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

function PinPad({
  role,
  pin,
  onDigit,
  onBackspace,
  onBack,
  error,
  cooldownMs,
  busy,
}: {
  role: UserRole;
  pin: string;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onBack: () => void;
  error: string | null;
  cooldownMs: number;
  busy: boolean;
}) {
  const locked = cooldownMs > 0;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "1rem" }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
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

      <div style={{ textAlign: "center", paddingBottom: "0.5rem" }}>
        <div
          style={{
            display: "inline-flex",
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "#0f172a",
            color: "#fff",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "0.5rem",
          }}
        >
          <Lock size={24} />
        </div>
        <h2 style={{ margin: 0, fontSize: "1.125rem", color: "#0f172a" }}>
          Enter {role === "owner" ? "Owner" : "Cashier"} PIN
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.25rem 0",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: i < pin.length ? "#0f172a" : "#e2e8f0",
              transition: "background 0.15s",
            }}
          />
        ))}
      </div>

      <div
        style={{
          minHeight: 24,
          textAlign: "center",
          color: error ? "#dc2626" : "#64748b",
          fontSize: "0.875rem",
          paddingBottom: "0.75rem",
        }}
      >
        {locked
          ? `Locked for ${Math.ceil(cooldownMs / 1000)}s`
          : error ?? (busy ? "Checking…" : "")}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
          maxWidth: 360,
          margin: "0 auto",
          flex: 1,
        }}
      >
        {DIGITS.map((d, i) =>
          d === "" ? (
            <div key={i} />
          ) : d === "back" ? (
            <KeyButton key={i} onClick={onBackspace} disabled={locked || busy} aria="Backspace">
              <Delete size={24} />
            </KeyButton>
          ) : (
            <KeyButton
              key={i}
              onClick={() => onDigit(d)}
              disabled={locked || busy}
              aria={`Digit ${d}`}
            >
              {d}
            </KeyButton>
          )
        )}
      </div>
    </>
  );
}

function KeyButton({
  children,
  onClick,
  disabled,
  aria,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  aria: string;
}) {
  return (
    <button
      aria-label={aria}
      onClick={onClick}
      disabled={disabled}
      style={{
        aspectRatio: "1 / 1",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        fontSize: "1.5rem",
        fontWeight: 500,
        color: disabled ? "#cbd5e1" : "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </button>
  );
}