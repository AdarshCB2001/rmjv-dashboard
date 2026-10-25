/** Where customers pay once an order is delivered. Shown on the order page; also printed on invoices. */
export const BANK = {
  accountName: "Funkustoms",
  accountNumber: "15760200004523",
  ifsc: "FDRL0001576",
} as const;

/** UPI QR (cropped from the FunKustoms payment screen) — served from /public. */
export const PAYMENT_QR = "/payment-qr.png";
