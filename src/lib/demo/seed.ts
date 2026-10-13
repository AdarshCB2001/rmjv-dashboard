import type { AllowedUser, Invoice, Order, OrderFile, OrderItem, Product } from "@/lib/types";
import { orderTotals } from "@/lib/money";

export type DemoDb = {
  allowed_users: AllowedUser[];
  products: Product[];
  orders: Order[];
  order_items: OrderItem[];
  order_files: OrderFile[];
  invoices: Invoice[];
  invoiceSeq: number;
  orderSeq: number;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export function buildSeed(): DemoDb {
  const users: AllowedUser[] = [
    {
      id: "u-0001",
      email: "demo@spintly.com",
      full_name: "Demo User (RMJV)",
      is_admin: false,
      active: true,
      created_at: daysAgo(120),
    },
    {
      id: "u-0002",
      email: "procurement@spintly.com",
      full_name: "Priya Nair",
      is_admin: false,
      active: true,
      created_at: daysAgo(110),
    },
    {
      id: "u-0003",
      email: "admin@spintly.com",
      full_name: "FunKustoms Admin",
      is_admin: true,
      active: true,
      created_at: daysAgo(120),
    },
  ];

  const products: Product[] = [
    {
      id: "p-0001",
      name: "Paper Template Cutouts",
      description:
        "Die-cut paper templates for access-reader installation. Printed on 250gsm board, cut to your drilling template.",
      base_price: 850,
      unit: "per 100 pcs",
      hsn_code: "4911",
      gst_rate: 18,
      image_url: null,
      active: true,
      created_at: daysAgo(200),
    },
    {
      id: "p-0002",
      name: "Paper Stickers",
      description: "Matte-laminated paper stickers, kiss-cut on sheets. Indoor use.",
      base_price: 420,
      unit: "per 100 pcs",
      hsn_code: "4821",
      gst_rate: 18,
      image_url: null,
      active: true,
      created_at: daysAgo(200),
    },
    {
      id: "p-0003",
      name: "UV Stickers",
      description:
        "UV-printed vinyl stickers with outdoor-grade adhesive. Weather and scratch resistant, 3-year rating.",
      base_price: 1250,
      unit: "per 100 pcs",
      hsn_code: "3919",
      gst_rate: 18,
      image_url: null,
      active: true,
      created_at: daysAgo(190),
    },
    {
      id: "p-0004",
      name: "T-Shirts (Round Neck)",
      description: "180gsm combed cotton, screen-printed front and back. Sizes S–XXL, mixed.",
      base_price: 380,
      unit: "per piece",
      hsn_code: "6109",
      gst_rate: 5,
      image_url: null,
      active: true,
      created_at: daysAgo(180),
    },
    {
      id: "p-0005",
      name: "Acrylic Signage Plates",
      description: "3mm cast acrylic with UV print and 3M tape backing. Custom sizes.",
      base_price: 2100,
      unit: "per 10 pcs",
      hsn_code: "3926",
      gst_rate: 18,
      image_url: null,
      active: true,
      created_at: daysAgo(90),
    },
    {
      id: "p-0006",
      name: "Visitor Badge Cards",
      description: "PVC cards, full-colour both sides, punched for lanyard.",
      base_price: 990,
      unit: "per 100 pcs",
      hsn_code: "3921",
      gst_rate: 18,
      image_url: null,
      active: true,
      created_at: daysAgo(60),
    },
  ];

  const rawOrders: {
    order: Omit<Order, "subtotal" | "tax_amount" | "total_amount">;
    items: Omit<OrderItem, "gst_rate" | "unit_price">[];
  }[] = [
    {
      order: {
        id: "o-0001",
        order_number: "RMJV-0001",
        user_email: "demo@spintly.com",
        status: "delivered",
        payment_status: "paid",
        payment_id: "pay_DemoQ8x1a2b3c4",
        razorpay_order_id: "order_DemoQ8x1a2b3",
        tracking_number: "DL7789112345",
        courier: "Delhivery",
        notes: null,
        created_at: daysAgo(46),
        updated_at: daysAgo(38),
      },
      items: [
        {
          id: "oi-0001",
          order_id: "o-0001",
          product_id: "p-0001",
          quantity: 5,
          notes: "Same drilling template as last time. Reader model AX-200.",
          file_url: "o-0001/oi-0001/v1-template-ax200.pdf",
          file_name: "template-ax200.pdf",
          file_version: 1,
          created_at: daysAgo(46),
        },
        {
          id: "oi-0002",
          order_id: "o-0001",
          product_id: "p-0002",
          quantity: 10,
          notes: "Blue variant.",
          file_url: "o-0001/oi-0002/v2-stickers-blue.ai",
          file_name: "stickers-blue.ai",
          file_version: 2,
          created_at: daysAgo(46),
        },
      ],
    },
    {
      order: {
        id: "o-0002",
        order_number: "RMJV-0002",
        user_email: "demo@spintly.com",
        status: "shipped",
        payment_status: "paid",
        payment_id: "pay_DemoR9y2b3c4d5",
        razorpay_order_id: "order_DemoR9y2b3c4",
        tracking_number: "SR4432119087",
        courier: "Shiprocket",
        notes: "Ship to the Margao warehouse, not the office.",
        created_at: daysAgo(12),
        updated_at: daysAgo(3),
      },
      items: [
        {
          id: "oi-0003",
          order_id: "o-0002",
          product_id: "p-0003",
          quantity: 8,
          notes: "Outdoor gates — needs the UV grade.",
          file_url: "o-0002/oi-0003/v1-uv-gate-labels.pdf",
          file_name: "uv-gate-labels.pdf",
          file_version: 1,
          created_at: daysAgo(12),
        },
        {
          id: "oi-0004",
          order_id: "o-0002",
          product_id: "p-0004",
          quantity: 40,
          notes: "20 L, 15 XL, 5 XXL. Logo on left chest.",
          file_url: "o-0002/oi-0004/v1-tshirt-logo.eps",
          file_name: "tshirt-logo.eps",
          file_version: 1,
          created_at: daysAgo(12),
        },
      ],
    },
    {
      order: {
        id: "o-0003",
        order_number: "RMJV-0003",
        user_email: "procurement@spintly.com",
        status: "printing",
        payment_status: "paid",
        payment_id: "pay_DemoS1z3c4d5e6",
        razorpay_order_id: "order_DemoS1z3c4d5",
        tracking_number: null,
        courier: null,
        notes: null,
        created_at: daysAgo(5),
        updated_at: daysAgo(4),
      },
      items: [
        {
          id: "oi-0005",
          order_id: "o-0003",
          product_id: "p-0006",
          quantity: 3,
          notes: "New visitor badge design, v3 artwork.",
          file_url: "o-0003/oi-0005/v3-badge-front.pdf",
          file_name: "badge-front.pdf",
          file_version: 3,
          created_at: daysAgo(5),
        },
      ],
    },
    {
      order: {
        id: "o-0004",
        order_number: "RMJV-0004",
        user_email: "demo@spintly.com",
        status: "pending",
        payment_status: "unpaid",
        payment_id: null,
        razorpay_order_id: null,
        tracking_number: null,
        courier: null,
        notes: null,
        created_at: daysAgo(0),
        updated_at: daysAgo(0),
      },
      items: [
        {
          id: "oi-0006",
          order_id: "o-0004",
          product_id: "p-0005",
          quantity: 2,
          notes: "Reception signage, 300x100mm.",
          file_url: null,
          file_name: null,
          file_version: 1,
          created_at: daysAgo(0),
        },
      ],
    },
  ];

  const productById = new Map(products.map((p) => [p.id, p]));

  // Line items are priced at today's catalog price for the seed; real orders snapshot
  // the price at checkout time.
  const order_items: OrderItem[] = rawOrders.flatMap((o) =>
    o.items.map((i) => {
      const p = productById.get(i.product_id)!;
      return { ...i, unit_price: p.base_price, gst_rate: p.gst_rate };
    }),
  );

  const orders: Order[] = rawOrders.map((o) => {
    const totals = orderTotals(order_items.filter((i) => i.order_id === o.order.id));
    return {
      ...o.order,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total_amount: totals.total,
    };
  });

  const order_files: OrderFile[] = order_items
    .filter((i) => i.file_url)
    // Every historical version is kept, so a v3 item implies v1 and v2 exist too.
    .flatMap((i) =>
      Array.from({ length: i.file_version }, (_, idx) => {
        const version = idx + 1;
        const isLatest = version === i.file_version;
        return {
          id: `of-${i.id}-${version}`,
          order_item_id: i.id,
          storage_path: isLatest
            ? i.file_url!
            : i.file_url!.replace(`/v${i.file_version}-`, `/v${version}-`),
          file_name: i.file_name!,
          file_size: 1_200_000 + version * 340_000,
          version,
          uploaded_by: orders.find((o) => o.id === i.order_id)!.user_email,
          created_at: i.created_at,
        };
      }),
    );

  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const invoices: Invoice[] = paidOrders.map((o, idx) => ({
    id: `inv-${idx + 1}`,
    order_id: o.id,
    invoice_number: `FK/25-26/${String(idx + 1).padStart(4, "0")}`,
    pdf_url: null,
    place_of_supply: null,
    issued_at: o.created_at,
  }));

  return {
    allowed_users: users,
    products,
    orders,
    order_items,
    order_files,
    invoices,
    invoiceSeq: invoices.length,
    orderSeq: orders.length,
  };
}
