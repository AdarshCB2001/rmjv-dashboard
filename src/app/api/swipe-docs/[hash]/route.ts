import { getSession } from "@/lib/auth";
import { getInvoicePdf, listCustomerDocs } from "@/lib/swipe";

/** PDF of an RMJV invoice/estimate for any signed-in portal user (the portal serves a single customer). `?dl=1` downloads instead of previewing. */
export async function GET(request: Request, { params }: { params: Promise<{ hash: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  const { hash } = await params;
  try {
    // Only documents of the RMJV customer are served, never other SWIPE customers'.
    const doc = (await listCustomerDocs()).find((d) => d.hashId === hash);
    if (!doc) return Response.json({ error: "Not found." }, { status: 404 });

    const pdf = await getInvoicePdf(hash);
    const download = new URL(request.url).searchParams.has("dl");
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.number.replace(/[^\w.-]+/g, "-")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[swipe-docs] pdf failed", error);
    return Response.json({ error: "Could not fetch the document." }, { status: 502 });
  }
}
