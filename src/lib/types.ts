export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "printing",
  "shipped",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number] | "cancelled";

export const PAYMENT_STATUSES = ["unpaid", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type AllowedUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  unit: string | null;
  hsn_code: string | null;
  gst_rate: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
  /** Computed from the catalog, not stored: minimum order quantity and its step. */
  pack_size?: number;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  notes: string | null;
  file_url: string | null;
  file_name: string | null;
  file_version: number;
  created_at: string;
  /** Joined for display. */
  product?: Product | null;
};

export type OrderFile = {
  id: string;
  order_item_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  version: number;
  uploaded_by: string;
  created_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  user_email: string;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_id: string | null;
  razorpay_order_id: string | null;
  tracking_number: string | null;
  courier: string | null;
  /** Id of the linked task in the project management app, once confirmed. */
  pm_task_id?: string | null;
  /** The GST invoice issued on SWIPE, once the order is Completed. */
  swipe_hash_id?: string | null;
  swipe_invoice_number?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Joined for display. */
  items?: OrderItem[];
  invoice?: Invoice | null;
};

export type Invoice = {
  id: string;
  order_id: string;
  invoice_number: string;
  pdf_url: string | null;
  place_of_supply: string | null;
  issued_at: string;
};

/** A single line the user is about to order. Lives in the client-side cart. */
export type CartLine = {
  productId: string;
  quantity: number;
  notes: string;
};

/** What the checkout action needs to create an order. */
export type DraftLine = {
  product_id: string;
  quantity: number;
  notes: string | null;
};

export type Session = {
  email: string;
  fullName: string | null;
  isAdmin: boolean;
};
