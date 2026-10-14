export type DrillTemplateRevision = {
  rev: string;
  fileName: string;
  type: "CDR" | "PDF" | "ZIP";
  sizeBytes: number;
  modifiedAt: string;
  /** Relative path under src/lib/drill-templates/files/, used by the download route. */
  storageKey: string;
  /**
   * True for every file that represents the latest revision. Usually just the last
   * entry, but FR 031's current revision ships as both a CDR and a PDF, so more than
   * one entry can be current at once.
   */
  current: boolean;
};

export type DrillTemplateModel = {
  slug: string;
  name: string;
  /** Matches the catalog product this reference material supports. */
  productId: string;
  revisions: DrillTemplateRevision[];
};

/**
 * Hardcoded from the Date-modified metadata on F:\Customers\Spintly\Drill Templates
 * (2026-10-14). Only current-revision files are stored under files/ and downloadable —
 * older revisions are listed for history but aren't bundled into the app.
 */
export const DRILL_TEMPLATE_MODELS: DrillTemplateModel[] = [
  {
    slug: "gateway",
    name: "Access Lite Gateway",
    productId: "p-0001",
    revisions: [
      {
        rev: "A",
        fileName: "Gateway Drill temp 20Feb2024 v17.cdr",
        type: "CDR",
        sizeBytes: 2_518_051,
        modifiedAt: "2025-09-19T08:02:00",
        storageKey: "",
        current: false,
      },
      {
        rev: "B",
        fileName: "Gateway Drill temp 12March 2024 v24.pdf",
        type: "PDF",
        sizeBytes: 1_384_638,
        modifiedAt: "2026-06-29T12:33:00",
        storageKey: "",
        current: false,
      },
      {
        rev: "C",
        fileName: "Gateway Drill temp 12March 2024 v17.cdr.zip",
        type: "ZIP",
        sizeBytes: 2_518_012,
        modifiedAt: "2026-06-29T12:42:00",
        storageKey: "",
        current: false,
      },
      {
        rev: "D",
        fileName: "Gateway-Drill-Template-12Mar2024-v17.cdr",
        type: "CDR",
        sizeBytes: 2_519_047,
        modifiedAt: "2026-06-29T12:44:00",
        storageKey: "gateway/Gateway-Drill-Template-12Mar2024-v17.cdr",
        current: true,
      },
    ],
  },
  {
    slug: "uno",
    name: "UNO",
    productId: "p-0001",
    revisions: [
      {
        rev: "A",
        fileName: "UNO Drill template 29APR2024 v17 (1).cdr",
        type: "CDR",
        sizeBytes: 1_161_059,
        modifiedAt: "2025-12-27T14:44:00",
        storageKey: "",
        current: false,
      },
      {
        rev: "B",
        fileName: "UNO-Template-Final-35-copies.cdr",
        type: "CDR",
        sizeBytes: 1_335_065,
        modifiedAt: "2025-12-27T14:58:00",
        storageKey: "uno/UNO-Template-Final-35-copies.cdr",
        current: true,
      },
    ],
  },
  {
    slug: "zeon",
    name: "ZEON",
    productId: "p-0001",
    revisions: [
      {
        rev: "A",
        fileName: "ZEON Drill template 22 April 2024 v17 12X18INCH (1) (1).cdr",
        type: "CDR",
        sizeBytes: 1_661_986,
        modifiedAt: "2025-12-27T14:44:00",
        storageKey: "",
        current: false,
      },
      {
        rev: "B",
        fileName: "ZEON-Template-Final-42-copies.cdr",
        type: "CDR",
        sizeBytes: 1_662_094,
        modifiedAt: "2025-12-27T14:53:00",
        storageKey: "zeon/ZEON-Template-Final-42-copies.cdr",
        current: true,
      },
    ],
  },
  {
    slug: "fr-031",
    name: "FR 031 (G96)",
    productId: "p-0001",
    revisions: [
      {
        rev: "A",
        fileName: "FR-031-Drill-Template-V17-G96.cdr",
        type: "CDR",
        sizeBytes: 621_035,
        modifiedAt: "2026-08-26T15:48:00",
        storageKey: "fr-031/FR-031-Drill-Template-V17-G96.cdr",
        current: true,
      },
      {
        rev: "A",
        fileName: "FR-031-Drill-Template-G96.pdf",
        type: "PDF",
        sizeBytes: 402_811,
        modifiedAt: "2026-08-26T15:48:00",
        storageKey: "fr-031/FR-031-Drill-Template-G96.pdf",
        current: true,
      },
    ],
  },
];

export const findDrillTemplateModel = (slug: string) =>
  DRILL_TEMPLATE_MODELS.find((m) => m.slug === slug) ?? null;

export const findRevisionByStorageKey = (storageKey: string) => {
  for (const model of DRILL_TEMPLATE_MODELS) {
    const revision = model.revisions.find((r) => r.storageKey === storageKey);
    if (revision) return revision;
  }
  return null;
};
