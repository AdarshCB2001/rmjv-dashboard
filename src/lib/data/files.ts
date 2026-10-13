import {
  DEMO_MODE,
  MAX_FILE_BYTES,
  ORDER_FILES_BUCKET,
  isAllowedFileName,
} from "@/lib/config";
import { clone, db, demoId } from "@/lib/demo/store";
import { adminSupabase } from "@/lib/supabase/server";
import type { OrderFile } from "@/lib/types";

/** Strips anything that could escape the intended prefix or confuse the storage key. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120);
}

export type ValidationError = { error: string };

/** Server-side re-validation of the client's upload constraints. */
export function validateUpload(fileName: string, fileSize: number): ValidationError | null {
  if (!isAllowedFileName(fileName)) {
    return { error: "Only .ai, .pdf, .png and .eps files are accepted." };
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { error: "File size is missing or invalid." };
  }
  if (fileSize > MAX_FILE_BYTES) {
    return { error: "Files must be 50MB or smaller." };
  }
  return null;
}

export async function listFiles(orderItemId: string): Promise<OrderFile[]> {
  if (DEMO_MODE) {
    return clone(db().order_files.filter((f) => f.order_item_id === orderItemId)).sort(
      (a, b) => b.version - a.version,
    );
  }

  const supabase = adminSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("order_files")
    .select("*")
    .eq("order_item_id", orderItemId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderFile[];
}

/** Files for every item on an order, grouped by item id. */
export async function listFilesForOrder(
  orderItemIds: string[],
): Promise<Map<string, OrderFile[]>> {
  const grouped = new Map<string, OrderFile[]>();
  if (orderItemIds.length === 0) return grouped;

  const rows = DEMO_MODE
    ? clone(db().order_files.filter((f) => orderItemIds.includes(f.order_item_id)))
    : await (async () => {
        const supabase = adminSupabase();
        if (!supabase) return [] as OrderFile[];
        const { data, error } = await supabase
          .from("order_files")
          .select("*")
          .in("order_item_id", orderItemIds);
        if (error) throw error;
        return (data ?? []) as OrderFile[];
      })();

  for (const row of rows) {
    const list = grouped.get(row.order_item_id) ?? [];
    list.push(row);
    grouped.set(row.order_item_id, list);
  }
  for (const list of grouped.values()) list.sort((a, b) => b.version - a.version);
  return grouped;
}

async function nextVersion(orderItemId: string): Promise<number> {
  const existing = await listFiles(orderItemId);
  return existing.reduce((max, f) => Math.max(max, f.version), 0) + 1;
}

export type UploadTarget = {
  path: string;
  version: number;
  /** Null in demo mode, where no bytes are actually stored. */
  signedUrl: string | null;
  token: string | null;
};

/**
 * Prepares a direct-to-storage upload.
 *
 * The browser uploads straight to Supabase Storage with a short-lived signed URL
 * rather than POSTing 50MB through a route handler. The path is chosen server-side so
 * the client can't write outside its own order prefix.
 */
export async function createUploadTarget(
  orderId: string,
  orderItemId: string,
  fileName: string,
): Promise<UploadTarget> {
  const clean = safeFileName(fileName);
  const version = await nextVersion(orderItemId);
  const path = `${orderId}/${orderItemId}/v${version}-${clean}`;

  if (DEMO_MODE) return { path, version, signedUrl: null, token: null };

  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for uploads.");
  const { data, error } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw error;
  return { path, version, signedUrl: data.signedUrl, token: data.token };
}

/**
 * Records an uploaded file against the order item.
 *
 * Old versions are never overwritten or deleted — `order_files` keeps every version
 * and `order_items.file_version` just points at the latest.
 */
export async function commitUpload(args: {
  orderItemId: string;
  path: string;
  fileName: string;
  fileSize: number;
  version: number;
  uploadedBy: string;
}): Promise<OrderFile> {
  const clean = safeFileName(args.fileName);

  if (DEMO_MODE) {
    const store = db();
    const record: OrderFile = {
      id: demoId("of"),
      order_item_id: args.orderItemId,
      storage_path: args.path,
      file_name: clean,
      file_size: args.fileSize,
      version: args.version,
      uploaded_by: args.uploadedBy,
      created_at: new Date().toISOString(),
    };
    store.order_files.push(record);
    const item = store.order_items.find((i) => i.id === args.orderItemId);
    if (item) {
      item.file_url = args.path;
      item.file_name = clean;
      item.file_version = args.version;
    }
    return clone(record);
  }

  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for uploads.");

  const { data, error } = await supabase
    .from("order_files")
    .insert({
      order_item_id: args.orderItemId,
      storage_path: args.path,
      file_name: clean,
      file_size: args.fileSize,
      version: args.version,
      uploaded_by: args.uploadedBy,
    })
    .select("*")
    .single();
  if (error) throw error;

  await supabase
    .from("order_items")
    .update({ file_url: args.path, file_name: clean, file_version: args.version })
    .eq("id", args.orderItemId);

  return data as OrderFile;
}

/** Short-lived signed download URL. Order files are never publicly readable. */
export async function signedDownloadUrl(
  path: string,
  bucket: string = ORDER_FILES_BUCKET,
  expiresIn = 120,
): Promise<string | null> {
  if (DEMO_MODE) return null;
  const supabase = adminSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
