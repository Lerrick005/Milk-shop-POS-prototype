// Design tokens. Centralised so every screen feels coherent.
// Changing one value here changes the whole app.

export const colors = {
  // Brand
  primary: "#0f172a",         // dark slate — headers, CTAs
  primaryHover: "#1e293b",

  // Surfaces
  bg: "#f8fafc",              // page background
  surface: "#ffffff",         // cards
  surfaceMuted: "#f1f5f9",    // subtle panels

  // Text
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",

  // Borders
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",

  // Status
  success: "#059669",
  successBg: "#ecfdf5",
  warning: "#d97706",
  warningBg: "#fffbeb",
  danger: "#dc2626",
  dangerBg: "#fef2f2",

  // Category tints (used for product tiles + badges)
  milk: "#dbeafe",        // soft blue
  milkFg: "#1e40af",
  yoghurt: "#fce7f3",     // soft pink
  yoghurtFg: "#9d174d",
  butter: "#fef3c7",      // soft amber
  butterFg: "#92400e",
  cheese: "#fef9c3",      // soft yellow
  cheeseFg: "#854d0e",
  other: "#e0e7ff",       // soft indigo
  otherFg: "#3730a3",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const space = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
} as const;

export const shadow = {
  sm: "0 1px 2px rgba(15,23,42,0.04)",
  md: "0 2px 8px rgba(15,23,42,0.06)",
  lg: "0 8px 24px rgba(15,23,42,0.10)",
  xl: "0 16px 40px rgba(15,23,42,0.14)",
} as const;

export const font = {
  xs: "0.6875rem",   // 11px
  sm: "0.8125rem",   // 13px
  base: "0.9375rem", // 15px
  lg: "1.0625rem",   // 17px
  xl: "1.25rem",     // 20px
  "2xl": "1.5rem",   // 24px
  "3xl": "2rem",     // 32px
} as const;