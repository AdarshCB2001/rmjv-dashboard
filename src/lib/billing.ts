/**
 * Invoice header details.
 *
 * These are deliberately env-driven with obvious placeholders rather than
 * hardcoded values: a GST invoice carrying a made-up GSTIN is a fake statutory
 * record. Until the real values are set, `isBillingConfigured` is false and every
 * generated PDF is stamped DRAFT / NOT A VALID TAX INVOICE.
 */

const PLACEHOLDER = "NOT SET";

const val = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

export type Party = {
  name: string;
  addressLines: string[];
  gstin: string;
  state: string;
  stateCode: string;
  email?: string;
  phone?: string;
};

export const SELLER: Party = {
  name: val(process.env.SELLER_NAME) ?? "FunKustoms",
  addressLines: (val(process.env.SELLER_ADDRESS) ?? PLACEHOLDER).split("|").map((s) => s.trim()),
  gstin: val(process.env.SELLER_GSTIN) ?? PLACEHOLDER,
  state: val(process.env.SELLER_STATE) ?? PLACEHOLDER,
  stateCode: val(process.env.SELLER_STATE_CODE) ?? PLACEHOLDER,
  email: val(process.env.SELLER_EMAIL),
  phone: val(process.env.SELLER_PHONE),
};

export const BUYER: Party = {
  name: val(process.env.BUYER_NAME) ?? "RMJV",
  addressLines: (val(process.env.BUYER_ADDRESS) ?? PLACEHOLDER).split("|").map((s) => s.trim()),
  gstin: val(process.env.BUYER_GSTIN) ?? PLACEHOLDER,
  state: val(process.env.BUYER_STATE) ?? PLACEHOLDER,
  stateCode: val(process.env.BUYER_STATE_CODE) ?? PLACEHOLDER,
};

export const BANK_DETAILS = val(process.env.SELLER_BANK_DETAILS);

/** Every field that legally has to be on the invoice is present. */
export const isBillingConfigured =
  SELLER.gstin !== PLACEHOLDER &&
  BUYER.gstin !== PLACEHOLDER &&
  SELLER.state !== PLACEHOLDER &&
  BUYER.state !== PLACEHOLDER;

/**
 * Intra-state supply is CGST + SGST; inter-state is IGST. Compared on state code
 * because two states can share a name prefix but never a code.
 */
export const isIntraState = () =>
  SELLER.stateCode !== PLACEHOLDER && SELLER.stateCode === BUYER.stateCode;
