// ─────────────────────────────────────────────────────────────
// Product repository. Every product read/write in the app goes
// through this file. The pattern here (functions, not a class) is
// what the other 4 repos (batches, sales, stockLedger, users) use.
// ─────────────────────────────────────────────────────────────

import { db, newId, nowISO, touchSyncMeta, withSyncMeta } from "@/db/db";
import type { Product, ProductCategory } from "@/types/models";

/** Input shape for creating a product — id & sync fields filled in by repo. */
export type CreateProductInput = {
  sku: string;
  name: string;
  category: ProductCategory;
  unit: Product["unit"];
  price: number;
  cost: number;
  initialStock?: number;
  reorderPoint?: number;
  notes?: string;
};

/** Input shape for updating — everything optional except id. */
export type UpdateProductInput = Partial<Omit<CreateProductInput, "sku">> & {
  id: string;
};

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

/**
 * Return all live (non-deleted) products, sorted alphabetically.
 * Used by the POS grid and the Inventory screen.
 */
export async function listProducts(): Promise<Product[]> {
  const all = await db.products
    .filter((p) => p.deletedAt === null)
    .toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

/** Return products in one category, sorted alphabetically. */
export async function listProductsByCategory(
  category: ProductCategory,
): Promise<Product[]> {
  const all = await db.products
    .where("category")
    .equals(category)
    .filter((p) => p.deletedAt === null)
    .toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

/** Get a single live product by id. Returns undefined if missing/deleted. */
export async function getProduct(id: string): Promise<Product | undefined> {
  const p = await db.products.get(id);
  if (!p || p.deletedAt !== null) return undefined;
  return p;
}

/** Find a live product by exact SKU. Used for scan/manual-entry speed. */
export async function getProductBySku(
  sku: string,
): Promise<Product | undefined> {
  const p = await db.products.where("sku").equals(sku).first();
  if (!p || p.deletedAt !== null) return undefined;
  return p;
}

/**
 * Case-insensitive search across product name and SKU.
 * Used by the POS search bar as the cashier types.
 * Kept intentionally simple — a dozen products fit in memory.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (q === "") return listProducts();
  const all = await listProducts();
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
  );
}

/**
 * Products whose stock has dropped to or below their reorder point.
 * Used by the Dashboard "Low stock" card and by the Inventory screen
 * to highlight rows in amber.
 */
export async function listLowStockProducts(): Promise<Product[]> {
  const all = await listProducts();
  return all.filter((p) => p.stock <= p.reorderPoint);
}

// ─────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────

/**
 * Create a new product. Returns the fully-formed record (with id).
 * Throws if the SKU already exists — that's a schema guarantee.
 */
export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const existing = await db.products.where("sku").equals(input.sku).first();
  if (existing && existing.deletedAt === null) {
    throw new Error(`SKU "${input.sku}" already exists`);
  }
  const record: Product = withSyncMeta({
    sku: input.sku,
    name: input.name,
    category: input.category,
    unit: input.unit,
    price: input.price,
    cost: input.cost,
    stock: input.initialStock ?? 0,
    reorderPoint: input.reorderPoint ?? 0,
    notes: input.notes,
    createdAt: nowISO(),
  }) as Product;
  await db.products.add(record);
  return record;
}

/**
 * Update a product's editable fields. Bumps _localVersion, refreshes
 * _lastModified. Throws if the product doesn't exist or is deleted.
 *
 * NOTE: this does NOT touch stock. Stock changes always go through the
 * stock ledger (see stockLedger repo) so every change is auditable.
 */
export async function updateProduct(
  input: UpdateProductInput,
): Promise<Product> {
  const existing = await db.products.get(input.id);
  if (!existing || existing.deletedAt !== null) {
    throw new Error(`Product ${input.id} not found`);
  }
  const updated: Product = touchSyncMeta({
    ...existing,
    name: input.name ?? existing.name,
    category: input.category ?? existing.category,
    unit: input.unit ?? existing.unit,
    price: input.price ?? existing.price,
    cost: input.cost ?? existing.cost,
    reorderPoint: input.reorderPoint ?? existing.reorderPoint,
    notes: input.notes !== undefined ? input.notes : existing.notes,
  }) as Product;
  await db.products.put(updated);
  return updated;
}

/**
 * Soft-delete a product (tombstone). Never hard-delete — old sale
 * records still reference this product by snapshot, and the tombstone
 * preserves referential context for reports.
 */
export async function softDeleteProduct(id: string): Promise<void> {
  const existing = await db.products.get(id);
  if (!existing) return;
  const tombstoned: Product = {
    ...existing,
    deletedAt: nowISO(),
    _syncStatus: "pending",
    _lastModified: nowISO(),
    _localVersion: existing._localVersion + 1,
  };
  await db.products.put(tombstoned);
}

/**
 * Set a product's stock counter to an absolute value.
 * INTERNAL — should only be called by the stock ledger when applying a
 * movement. If you want to change stock from the UI, call
 * `applyStockMovement` in stockLedger.ts, not this function.
 */
export async function _setStockInternal(
  productId: string,
  newStock: number,
): Promise<void> {
  const existing = await db.products.get(productId);
  if (!existing) throw new Error(`Product ${productId} not found`);
  await db.products.put({
    ...existing,
    stock: newStock,
    _syncStatus: "pending",
    _lastModified: nowISO(),
    _localVersion: existing._localVersion + 1,
  });
}

// Re-export newId so other repos don't need to import from db.ts directly
export { newId as newProductId };