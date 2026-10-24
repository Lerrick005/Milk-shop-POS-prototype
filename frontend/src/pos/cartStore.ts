// ─────────────────────────────────────────────────────────────
// Cart state. Lives only in memory (zustand) during a sale.
// When the cashier taps Confirm, the cart is passed to
// completeSale() and the DB is the source of truth from then on.
//
// The cart is a Map<productId, quantity> for O(1) lookup on add.
// Product details (name, price, unit) are read from the DB at
// checkout time, not cached here — that way a price change
// mid-shift is respected.
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";

type CartState = {
  /** productId → quantity */
  lines: Record<string, number>;
  /** Called from the product grid */
  add: (productId: string, qty?: number) => void;
  /** Called from the cart +/− controls */
  setQty: (productId: string, qty: number) => void;
  /** Called from cart remove button */
  remove: (productId: string) => void;
  /** Clear after a completed sale */
  clear: () => void;
  /** How many total units are in the cart */
  totalUnits: () => number;
  /** How many distinct products */
  totalLines: () => number;
};

export const useCart = create<CartState>((set, get) => ({
  lines: {},

  add: (productId, qty = 1) =>
    set((state) => {
      const current = state.lines[productId] ?? 0;
      return { lines: { ...state.lines, [productId]: current + qty } };
    }),

  setQty: (productId, qty) =>
    set((state) => {
      const next = { ...state.lines };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return { lines: next };
    }),

  remove: (productId) =>
    set((state) => {
      const next = { ...state.lines };
      delete next[productId];
      return { lines: next };
    }),

  clear: () => set({ lines: {} }),

  totalUnits: () => Object.values(get().lines).reduce((s, q) => s + q, 0),
  totalLines: () => Object.keys(get().lines).length,
}));