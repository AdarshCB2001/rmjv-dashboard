import { getSession } from "@/lib/auth";
import { fetchInvoicePdf, listCustomerDocs } from "@/lib/swipe";

/** Admin-only PDF of an RMJV invoice/estimate on SWIPE. `?dl=1` downloads instead of previewing. */
export async function GET(request: Request, { params }: { params: Promise<{ hash: string }> }) {
  const session = await getSession();
  if (!session?.isAdmin) return Response.json({ error: "Not allowed." }, { status: 403 });

  const { hash } = await params;
  try {
    // Only documents of the RMJV customer are served, never other SWIPE customers'.
    const doc = (await listCustomerDocs()).find((d) => d.hashId === hash);
    if (!doc) return Response.json({ error: "Not found." }, { status: 404 });

    const pdf = await fetchInvoicePdf(hash);
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
