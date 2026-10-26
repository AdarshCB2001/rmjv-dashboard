// One-off (re-runnable) import of the PDFs in ../Invoices into the portal's invoice list, so
// older invoices and estimates show up without spending SWIPE API calls. Reads number, date,
// customer and total from each PDF, stores the PDF in the `invoices` bucket and upserts a
// swipe_docs row. Imported rows get an id "import-<number>"; "Refresh from SWIPE" replaces the
// ones SWIPE also has. Every imported document is marked paid (pending 0) — edit in the DB if not.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const DIR = path.resolve("..", "Invoices");
const MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

for (const file of readdirSync(DIR).filter((n) => n.toLowerCase().endsWith(".pdf")).sort()) {
  const bytes = readFileSync(path.join(DIR, file));
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const text = (await (await doc.getPage(1)).getTextContent()).items.map((x) => x.str.trim()).filter(Boolean).join(" | ");
  const get = (re) => re.exec(text)?.[1]?.trim() ?? null;

  const number = get(/(?:Invoice|Estimate|Quotation) ?#: \| ([^|]+)/);
  const [d, m, y] = (get(/(?:Invoice|Estimate|Quotation) Date: \| ([^|]+)/) ?? "").split(" ");
  const total = Number((get(/Amount Payable: \| ₹([\d,.]+)/) ?? get(/Total \| ₹([\d,.]+)/) ?? "").replace(/,/g, ""));
  if (!number || !MONTHS[m] || !(total > 0)) {
    console.log(`SKIP ${file}: could not read number/date/total`);
    continue;
  }

  const id = `import-${number.replace(/[^A-Za-z0-9]+/g, "-")}`;
  const up = await supabase.storage.from("invoices").upload(`${id}.pdf`, bytes, { contentType: "application/pdf", upsert: true });
  const row = await supabase.from("swipe_docs").upsert({
    hash_id: id, number, doc_date: `${y}-${MONTHS[m]}-${d.padStart(2, "0")}`,
    reference: get(/Reference: \| ([^|]+)/)?.replace(/^# /, "") ?? null,
    total, pending: 0, kind: /^EST/i.test(number) ? "estimate" : "invoice",
    customer: get(/Customer Details: \| ([^|]+)/),
  });
  const err = up.error?.message ?? row.error?.message;
  console.log(err ? `FAIL ${file}: ${err}` : `ok   ${number}  ${y}-${MONTHS[m]}-${d}  ₹${total}`);
}
