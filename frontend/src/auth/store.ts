// ─────────────────────────────────────────────────────────────
// Auth session store. Zustand — tiny, no boilerplate, no
// Provider component needed.
//
// The session is stored in sessionStorage (not localStorage) so:
//   - Closing the browser / restarting the phone signs you out
//   - Sleep / screen-lock does NOT sign you out (storage survives)
//
// This matches the POS mental model: one shift = one sign-in.
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";
import type { UserRole } from "@/types/models";

const SESSION_KEY = "pos.session.v1";

export type Session = {
  userId: string;
  name: string;
  role: UserRole;
  /** When the user signed in — for shift duration displays */
  signedInAt: string;
};

type AuthState = {
  session: Session | null;
  /** True once the initial sessionStorage read has completed */
  ready: boolean;
  /** Load session from sessionStorage (called on app launch) */
  load: () => void;
  /** Called after a successful PIN verify */
  signIn: (session: Session) => void;
  /** Explicit sign-out */
  signOut: () => void;
};

function readPersisted(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (
      typeof parsed?.userId === "string" &&
      typeof parsed?.name === "string" &&
      (parsed?.role === "owner" || parsed?.role === "cashier") &&
      typeof parsed?.signedInAt === "string"
    ) {
      return parsed;
    }
  } catch {
    /* corrupt session — treat as signed out */
  }
  return null;
}

function writePersisted(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* sessionStorage may be disabled — not fatal, just no persistence */
  }
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  ready: false,

  load: () => {
    const persisted = readPersisted();
    set({ session: persisted, ready: true });
  },

  signIn: (session) => {
    writePersisted(session);
    set({ session });
  },

  signOut: () => {
    writePersisted(null);
    set({ session: null });
  },
}));