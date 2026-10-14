import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { DRILL_TEMPLATE_MODELS } from "@/lib/drill-templates/data";
import { Badge, btn, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Drill Templates" };

const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const formatModified = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function DrillTemplatesPage() {
  await requireSession();

  return (
    <>
      <PageHeader
        title="Drill Templates"
        description="Reader drilling specs for every model we've cut a Paper Template Cutouts order for. Current revision is downloadable; older ones are kept for reference."
        actions={
          <Link href="/products" className="text-sm font-medium text-accent hover:underline">
            ← Back to catalog
          </Link>
        }
      />

      <div className="space-y-6">
        {DRILL_TEMPLATE_MODELS.map((model) => {
          const current = model.revisions.filter((r) => r.current);
          const history = model.revisions.filter((r) => !r.current);

          return (
            <Card key={model.slug} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-3">
                <h2 className="font-semibold text-ink">{model.name}</h2>
                <span className="text-xs text-muted">
                  {model.revisions.length} revision{model.revisions.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex flex-wrap items-start gap-4 border-b border-line px-5 py-4 sm:flex-nowrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/drill-templates/preview?slug=${model.slug}`}
                  alt={`${model.name} drill template preview`}
                  className="h-40 w-auto shrink-0 rounded border border-line bg-white object-contain"
                />
                <p className="text-sm text-muted">
                  Preview rendered from the current revision's embedded page thumbnail.
                </p>
              </div>

              {current.map((rev) => (
                <div
                  key={rev.storageKey}
                  className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3"
                >
                  <Badge tone="positive">Current</Badge>
                  <span className="flex-1 font-medium text-ink">{rev.fileName}</span>
                  <span className="text-xs text-muted nums">
                    {formatModified(rev.modifiedAt)} · {formatSize(rev.sizeBytes)}
                  </span>
                  <a
                    href={`/api/drill-templates/download?key=${encodeURIComponent(rev.storageKey)}`}
                    className={btn("primary")}
                  >
                    Download
                  </a>
                </div>
              ))}

              {history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="text-left text-xs text-muted">
                        <th className="px-5 py-2 font-medium">Rev</th>
                        <th className="px-5 py-2 font-medium">File</th>
                        <th className="px-5 py-2 font-medium">Type</th>
                        <th className="px-5 py-2 font-medium">Size</th>
                        <th className="px-5 py-2 font-medium">Date modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((rev, i) => (
                        <tr key={i} className="border-t border-line text-sm">
                          <td className="px-5 py-2 text-muted">{rev.rev}</td>
                          <td className="px-5 py-2">{rev.fileName}</td>
                          <td className="px-5 py-2 text-xs text-muted">{rev.type}</td>
                          <td className="px-5 py-2 text-xs text-muted nums">
                            {formatSize(rev.sizeBytes)}
                          </td>
                          <td className="px-5 py-2 text-xs text-muted nums">
                            {formatModified(rev.modifiedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
