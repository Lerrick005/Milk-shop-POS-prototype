// ─────────────────────────────────────────────────────────────
// Canonical domain types for the Milk Shop POS.
// Every repository, UI component, and future sync layer imports
// from this file. Change with care — this is the shared contract.
// ─────────────────────────────────────────────────────────────

export type SyncStatus = "pending" | "synced" | "conflict";

export interface SyncMeta {
  id: string;
  _syncStatus: SyncStatus;
  _lastModified: string;
  _localVersion: number;
  deletedAt: string | null;
}

export type UserRole = "owner" | "cashier";

export interface User extends SyncMeta {
  name: string;
  role: UserRole;
  pinHash: string;
  pinSalt: string;
  createdAt: string;
}

export type ProductUnit = "packet" | "box" | "tub" | "piece" | "bottle";
export type ProductCategory = "milk" | "yoghurt" | "butter" | "cheese" | "other";

export interface Product extends SyncMeta {
  sku: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  price: number;
  cost: number;
  stock: number;
  reorderPoint: number;
  notes?: string;
  createdAt: string;
}

export interface Batch extends SyncMeta {
  productId: string;
  batchNumber: string;
  expiryDate: string;
  receivedAt: string;
  stock: number;
  initialStock: number;
  notes?: string;
  createdAt: string;
}

export type PaymentMethod = "cash" | "mpesa";

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  batchId: string | null;
  productNameSnapshot: string;
  unitSnapshot: ProductUnit;
  unitPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
  _lastModified: string;
  _localVersion: number;
}

export interface Sale extends SyncMeta {
  receiptNumber: string;
  createdAt: string;
  cashierId: string;
  cashierNameSnapshot: string;
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number | null;
  changeGiven: number | null;
  mpesaCode: string | null;
  items: SaleItem[];
}

export type StockMovementType =
  | "sale"
  | "receive"
  | "adjustment"
  | "waste"
  | "return";

export interface StockMovement {
  id: string;
  productId: string;
  batchId: string | null;
  type: StockMovementType;
  qtyDelta: number;
  reason: string | null;
  refId: string | null;
  createdBy: string;
  createdByNameSnapshot: string;
  createdAt: string;
  _lastModified: string;
  _localVersion: number;
}

export type ShiftStatus = "open" | "closed";

export interface Shift extends SyncMeta {
  /** Whether the day is open or has been closed */
  status: ShiftStatus;
  businessDate: string;
  openedAt: string;
  openedBy: string;
  openedByNameSnapshot: string;
  openingCash: number;
  closedAt: string | null;
  closedBy: string | null;
  closedByNameSnapshot: string | null;
  totalCashSales: number | null;
  totalMpesaSales: number | null;
  totalRevenue: number | null;
  expectedCash: number | null;
  countedCash: number | null;
  cashVariance: number | null;
  mpesaCodes: string[];
  notes: string | null;
}

export interface StockReconciliation {
  productId: string;
  productName: string;
  unit: ProductUnit;
  openingStock: number;
  received: number;
  sold: number;
  wasted: number;
  adjusted: number;
  expectedClosing: number;
  actualClosing: number | null;
  variance: number | null;
}