import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BANK_DETAILS, BUYER, SELLER, isBillingConfigured, isIntraState } from "./billing";
import { lineTotals, orderTotals, round2 } from "./money";
import type { Invoice, Order } from "./types";

/* ------------------------------------------------------- amount in words */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const rest = n % 10;
  return TENS[Math.floor(n / 10)] + (rest ? ` ${ONES[rest]}` : "");
}

/** Indian numbering: crore, lakh, thousand, hundred. */
function inWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const units: [number, string][] = [
    [10_000_000, "Crore"],
    [100_000, "Lakh"],
    [1_000, "Thousand"],
    [100, "Hundred"],
  ];
  let remaining = n;
  for (const [value, name] of units) {
    const count = Math.floor(remaining / value);
    if (count > 0) {
      parts.push(`${twoDigits(count)} ${name}`);
      remaining %= value;
    }
  }
  if (remaining > 0) parts.push(twoDigits(remaining));
  return parts.join(" ");
}

export function amountInWords(rupees: number): string {
  const whole = Math.floor(rupees);
  const paise = Math.round((rupees - whole) * 100);
  const main = `${inWords(whole)} Rupees`;
  return paise > 0 ? `${main} and ${inWords(paise)} Paise only` : `${main} only`;
}

/* -------------------------------------------------------------- styling */

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#1f2937", fontFamily: "Helvetica" },
  watermark: {
    position: "absolute",
    top: 320,
    left: 60,
    right: 60,
    textAlign: "center",
    fontSize: 30,
    color: "#f0b4b0",
    fontFamily: "Helvetica-Bold",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#111827" },
  subtitle: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginVertical: 12 },
  partyRow: { flexDirection: "row", gap: 18 },
  partyBox: { flex: 1 },
  partyLabel: {
    fontSize: 7,
    color: "#6b7280",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111827" },
  line: { marginTop: 1.5, lineHeight: 1.4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  metaLabel: { color: "#6b7280" },
  metaValue: { fontFamily: "Helvetica-Bold" },

  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  cDesc: { flex: 3.2 },
  cHsn: { flex: 0.9 },
  cQty: { flex: 0.7, textAlign: "right" },
  cRate: { flex: 1.1, textAlign: "right" },
  cTaxable: { flex: 1.2, textAlign: "right" },
  cGst: { flex: 1.3, textAlign: "right" },
  cTotal: { flex: 1.3, textAlign: "right" },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  totalsBox: { width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#9ca3af",
    marginTop: 4,
    paddingTop: 5,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  words: { marginTop: 14, fontSize: 8.5 },
  footer: { marginTop: "auto", borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 10, fontSize: 7.5, color: "#6b7280" },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 26 },
  notes: { marginTop: 10, fontSize: 7.5, color: "#6b7280", lineHeight: 1.5 },
});

const money = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/* ------------------------------------------------------------- document */

function InvoiceDocument({ order, invoice }: { order: Order; invoice: Invoice }) {
  const items = order.items ?? [];
  const totals = orderTotals(items);
  const intra = isIntraState();

  return (
    <Document
      title={`Invoice ${invoice.invoice_number}`}
      author={SELLER.name}
      subject={`Invoice for order ${order.order_number}`}
    >
      <Page size="A4" style={styles.page}>
        {!isBillingConfigured ? (
          <Text style={styles.watermark} fixed>
            DRAFT — NOT A VALID TAX INVOICE
          </Text>
        ) : null}

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>TAX INVOICE</Text>
            <Text style={styles.subtitle}>
              {isBillingConfigured
                ? "Issued under the Central Goods and Services Tax Act, 2017"
                : "Billing details are not configured — this document is a draft."}
            </Text>
          </View>
          <View style={{ width: 190 }}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice no.</Text>
              <Text style={styles.metaValue}>{invoice.invoice_number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice date</Text>
              <Text style={styles.metaValue}>{fmtDate(invoice.issued_at)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Order ref.</Text>
              <Text style={styles.metaValue}>{order.order_number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Place of supply</Text>
              <Text style={styles.metaValue}>
                {invoice.place_of_supply ?? BUYER.state}
                {BUYER.stateCode ? ` (${BUYER.stateCode})` : ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.partyRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>SUPPLIER</Text>
            <Text style={styles.partyName}>{SELLER.name}</Text>
            {SELLER.addressLines.map((l, i) => (
              <Text key={i} style={styles.line}>
                {l}
              </Text>
            ))}
            <Text style={styles.line}>GSTIN: {SELLER.gstin}</Text>
            <Text style={styles.line}>
              State: {SELLER.state} {SELLER.stateCode ? `(${SELLER.stateCode})` : ""}
            </Text>
            {SELLER.email ? <Text style={styles.line}>{SELLER.email}</Text> : null}
            {SELLER.phone ? <Text style={styles.line}>{SELLER.phone}</Text> : null}
          </View>

          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>BILLED TO</Text>
            <Text style={styles.partyName}>{BUYER.name}</Text>
            {BUYER.addressLines.map((l, i) => (
              <Text key={i} style={styles.line}>
                {l}
              </Text>
            ))}
            <Text style={styles.line}>GSTIN: {BUYER.gstin}</Text>
            <Text style={styles.line}>
              State: {BUYER.state} {BUYER.stateCode ? `(${BUYER.stateCode})` : ""}
            </Text>
            <Text style={styles.line}>Ordered by: {order.user_email}</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={styles.tableHead}>
            <Text style={styles.cDesc}>Description</Text>
            <Text style={styles.cHsn}>HSN</Text>
            <Text style={styles.cQty}>Qty</Text>
            <Text style={styles.cRate}>Rate</Text>
            <Text style={styles.cTaxable}>Taxable</Text>
            <Text style={styles.cGst}>{intra ? "CGST+SGST" : "IGST"}</Text>
            <Text style={styles.cTotal}>Amount</Text>
          </View>

          {items.map((item) => {
            const line = lineTotals(item.unit_price, item.quantity, item.gst_rate);
            return (
              <View key={item.id} style={styles.row} wrap={false}>
                <View style={styles.cDesc}>
                  <Text>{item.product?.name ?? "Item"}</Text>
                  {item.notes ? (
                    <Text style={{ fontSize: 7.5, color: "#6b7280", marginTop: 1.5 }}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.cHsn}>{item.product?.hsn_code ?? "—"}</Text>
                <Text style={styles.cQty}>{item.quantity}</Text>
                <Text style={styles.cRate}>{money(item.unit_price)}</Text>
                <Text style={styles.cTaxable}>{money(line.taxable)}</Text>
                <Text style={styles.cGst}>
                  {intra
                    ? `${money(line.taxAmount / 2)} + ${money(line.taxAmount / 2)}`
                    : money(line.taxAmount)}
                  {`\n${item.gst_rate}%`}
                </Text>
                <Text style={styles.cTotal}>{money(line.total)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Taxable value</Text>
              <Text>{money(totals.subtotal)}</Text>
            </View>

            {totals.byRate.map((slab) =>
              intra ? (
                <View key={slab.rate}>
                  <View style={styles.totalRow}>
                    <Text>CGST @ {slab.rate / 2}%</Text>
                    <Text>{money(round2(slab.taxAmount / 2))}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text>SGST @ {slab.rate / 2}%</Text>
                    <Text>{money(round2(slab.taxAmount / 2))}</Text>
                  </View>
                </View>
              ) : (
                <View key={slab.rate} style={styles.totalRow}>
                  <Text>IGST @ {slab.rate}%</Text>
                  <Text>{money(slab.taxAmount)}</Text>
                </View>
              ),
            )}

            <View style={styles.grandRow}>
              <Text>Total</Text>
              <Text>INR {money(totals.total)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.words}>
          <Text style={{ color: "#6b7280" }}>Amount in words: </Text>
          {amountInWords(totals.total)}
        </Text>

        {BANK_DETAILS ? (
          <Text style={styles.notes}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Payment details: </Text>
            {BANK_DETAILS}
          </Text>
        ) : null}

        <Text style={styles.notes}>
          {order.payment_status === "paid"
            ? `Payment received${order.payment_id ? ` · reference ${order.payment_id}` : ""}.`
            : "Payment due on delivery."}{" "}
          This is a computer-generated invoice.
        </Text>

        <View style={styles.signRow}>
          <Text style={{ color: "#6b7280" }} />
          <Text>For {SELLER.name} — Authorised signatory</Text>
        </View>

        <View style={styles.footer}>
          <Text>
            {SELLER.name} · GSTIN {SELLER.gstin} · Invoice {invoice.invoice_number} · Order{" "}
            {order.order_number}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(order: Order, invoice: Invoice): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument order={order} invoice={invoice} />);
}
