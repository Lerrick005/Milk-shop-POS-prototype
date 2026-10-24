// Expiry badge for a product. Reads the earliest-expiring live batch
// and shows a small label:
//   expired      → red  "expired 3d ago"
//   expiring <7d → amber "3d left"
//   expiring <14d → slate "12d left"
//   otherwise    → nothing
// Renders nothing while loading or if no live batches exist.

import { useLiveQuery } from "dexie-react-hooks";
import { listBatchesForProduct } from "@/db/repos/batches";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ExpiryBadge({ productId }: { productId: string }) {
  const batches = useLiveQuery(
    () => listBatchesForProduct(productId),
    [productId],
    undefined,
  );

  if (!batches || batches.length === 0) return null;

  const earliest = batches[0]; // sorted oldest first by repo
  const days = daysUntil(earliest.expiryDate);

  let label: string;
  let bg: string;
  let fg: string;

  if (days < 0) {
    label = `expired ${-days}d ago`;
    bg = "#fef2f2";
    fg = "#991b1b";
  } else if (days <= 7) {
    label = `${days}d left`;
    bg = "#fffbeb";
    fg = "#92400e";
  } else if (days <= 14) {
    label = `${days}d left`;
    bg = "#f1f5f9";
    fg = "#475569";
  } else {
    return null;
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: "0.625rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}