// ─────────────────────────────────────────────────────────────
// First-run seed. Idempotent: if products already exist, does
// nothing. Call `ensureSeedData()` from main.tsx on app launch.
//
// The catalogue reflects a typical Kenyan milk shop — milk in
// packets and boxes, yoghurt, butter, cheese. Prices are KSh,
// whole shillings. Costs are ~75-80% of price, which is realistic
// for dairy retail in Kenya. Batches are dated so the expiry
// dashboard has something to show immediately.
// ─────────────────────────────────────────────────────────────

import { db, nowISO } from "@/db/db";
import { createProduct } from "@/db/repos/products";
import { createBatch } from "@/db/repos/batches";
import { applyStockMovement } from "@/db/repos/stockLedger";
import { ensureDefaultUsers, getUserByRole } from "@/db/repos/users";
import type { ProductCategory, ProductUnit } from "@/types/models";

type SeedProduct = {
  sku: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  price: number;
  cost: number;
  reorderPoint: number;
  /** Units in one delivered batch */
  initialStock: number;
  /** Days from now until this batch expires (can be negative = already expired) */
  expiryOffsetDays: number;
};

const SEED_PRODUCTS: SeedProduct[] = [
  // ── Milk ────────────────────────────────────────────────
  {
    sku: "MILK-500",
    name: "Fresh Milk 500ml",
    category: "milk",
    unit: "packet",
    price: 65,
    cost: 50,
    reorderPoint: 20,
    initialStock: 60,
    expiryOffsetDays: 4,
  },
  {
    sku: "MILK-500-BOX",
    name: "Fresh Milk 500ml Box (12)",
    category: "milk",
    unit: "box",
    price: 750,
    cost: 600,
    reorderPoint: 3,
    initialStock: 6,
    expiryOffsetDays: 4,
  },
  {
    sku: "MILK-1L",
    name: "Fresh Milk 1L",
    category: "milk",
    unit: "packet",
    price: 120,
    cost: 95,
    reorderPoint: 15,
    initialStock: 40,
    expiryOffsetDays: 5,
  },
  {
    sku: "MILK-1L-BOX",
    name: "Fresh Milk 1L Box (12)",
    category: "milk",
    unit: "box",
    price: 1400,
    cost: 1140,
    reorderPoint: 2,
    initialStock: 4,
    expiryOffsetDays: 5,
  },

  // ── Yoghurt ────────────────────────────────────────────
  {
    sku: "YOG-250",
    name: "Plain Yoghurt 250ml",
    category: "yoghurt",
    unit: "tub",
    price: 90,
    cost: 70,
    reorderPoint: 10,
    initialStock: 24,
    expiryOffsetDays: 12,
  },
  {
    sku: "YOG-500",
    name: "Plain Yoghurt 500ml",
    category: "yoghurt",
    unit: "tub",
    price: 160,
    cost: 125,
    reorderPoint: 8,
    initialStock: 18,
    expiryOffsetDays: 12,
  },
  {
    sku: "YOG-STRW-250",
    name: "Strawberry Yoghurt 250ml",
    category: "yoghurt",
    unit: "tub",
    price: 100,
    cost: 78,
    reorderPoint: 10,
    initialStock: 20,
    expiryOffsetDays: 10,
  },

  // ── Butter ─────────────────────────────────────────────
  {
    sku: "BUT-250",
    name: "Salted Butter 250g",
    category: "butter",
    unit: "piece",
    price: 350,
    cost: 285,
    reorderPoint: 5,
    initialStock: 12,
    expiryOffsetDays: 45,
  },
  {
    sku: "BUT-500",
    name: "Salted Butter 500g",
    category: "butter",
    unit: "piece",
    price: 680,
    cost: 550,
    reorderPoint: 4,
    initialStock: 8,
    expiryOffsetDays: 45,
  },

  // ── Cheese ─────────────────────────────────────────────
  {
    sku: "CHS-200",
    name: "Cheddar Cheese 200g",
    category: "cheese",
    unit: "piece",
    price: 480,
    cost: 390,
    reorderPoint: 4,
    initialStock: 10,
    expiryOffsetDays: 30,
  },
  {
    sku: "CHS-400",
    name: "Cheddar Cheese 400g",
    category: "cheese",
    unit: "piece",
    price: 920,
    cost: 750,
    reorderPoint: 3,
    initialStock: 6,
    expiryOffsetDays: 30,
  },

  // ── Other ──────────────────────────────────────────────
  {
    sku: "CREAM-250",
    name: "Fresh Cream 250ml",
    category: "other",
    unit: "packet",
    price: 220,
    cost: 175,
    reorderPoint: 5,
    initialStock: 10,
    expiryOffsetDays: 7,
  },
];

/** YYYY-MM-DD in the device's local timezone, offset by N days. */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Seed the database on first launch. Safe to call every launch:
 *   - If users exist, does nothing to them.
 *   - If products exist, skips catalogue seeding entirely.
 *   - Batches + stock movements only created alongside new products.
 *
 * Returns true if seed ran, false if it was skipped.
 */
export async function ensureSeedData(): Promise<boolean> {
  // Always ensure users exist (idempotent inside ensureDefaultUsers)
  await ensureDefaultUsers();

  const existingProductCount = await db.products
    .filter((p) => p.deletedAt === null)
    .count();
  if (existingProductCount > 0) {
    return false; // already seeded
  }

  const owner = await getUserByRole("owner");
  const seedUser = owner ?? { id: "system", name: "System" };

  // Create products, batches, and initial receive movements.
  for (const seed of SEED_PRODUCTS) {
    const product = await createProduct({
      sku: seed.sku,
      name: seed.name,
      category: seed.category,
      unit: seed.unit,
      price: seed.price,
      cost: seed.cost,
      initialStock: 0, // stock arrives via the ledger below
      reorderPoint: seed.reorderPoint,
    });

    const batch = await createBatch({
      productId: product.id,
      batchNumber: `${seed.sku}-${nowISO().slice(0, 10)}`,
      expiryDate: dateOffset(seed.expiryOffsetDays),
      quantity: seed.initialStock,
    });

    // Record the initial delivery in the ledger so opening stock
    // reconciles correctly from day one.
    await applyStockMovement({
      productId: product.id,
      batchId: batch.id,
      type: "receive",
      qtyDelta: seed.initialStock,
      reason: "Initial seed stock",
      refId: null,
      createdBy: seedUser.id,
      createdByName: seedUser.name,
    });
  }

  return true;
}

/**
 * Wipe all data and re-seed. For demo resets only.
 * NOT exposed in the UI — invoke from the browser console:
 *   const { resetAllData } = await import("/src/db/seed.ts");
 *   await resetAllData();
 */
export async function resetAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.users, db.products, db.batches, db.sales, db.saleItems, db.stockMovements, db.shifts],
    async () => {
      await db.users.clear();
      await db.products.clear();
      await db.batches.clear();
      await db.sales.clear();
      await db.saleItems.clear();
      await db.stockMovements.clear();
      await db.shifts.clear();
    },
  );
  await ensureSeedData();
}