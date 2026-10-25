import { DEMO_MODE } from "@/lib/config";
import { clone, db, demoId } from "@/lib/demo/store";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";
import { catalogProductInputs, packSizes } from "@/lib/catalog";
import type { Product } from "@/lib/types";

const withPack = (p: Product, packs = packSizes()): Product => ({
  ...p,
  pack_size: packs.get(p.name) ?? 1,
});

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name);

/** Demo store only: a server that outlived a catalog change picks up new products without a restart. */
function addMissingDemoProducts() {
  const store = db();
  const have = new Set(store.products.map((p) => p.name));
  for (const input of catalogProductInputs()) {
    if (!have.has(input.name)) store.products.push({ id: demoId("p"), created_at: new Date().toISOString(), ...input });
  }
}

export async function listProducts({ includeInactive = false } = {}): Promise<Product[]> {
  const packs = packSizes();
  if (DEMO_MODE) {
    addMissingDemoProducts();
    return clone(db().products.filter((p) => includeInactive || p.active)).map((p) => withPack(p, packs)).sort(byName);
  }

  const supabase = await serverSupabase();
  if (!supabase) return [];

  let query = supabase.from("products").select("*").order("name");
  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Product[]).map((p) => withPack(p, packs));
}

export async function getProduct(id: string): Promise<Product | null> {
  if (DEMO_MODE) {
    const found = clone(db().products.find((p) => p.id === id) ?? null);
    return found && withPack(found);
  }

  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? withPack(data as Product) : null;
}

export type ProductInput = {
  name: string;
  description: string | null;
  base_price: number;
  unit: string | null;
  hsn_code: string | null;
  gst_rate: number;
  image_url: string | null;
  active: boolean;
};

/** Admin only — callers must have gone through `requireAdmin()` first. */
export async function upsertProduct(input: ProductInput, id?: string): Promise<Product> {
  if (DEMO_MODE) {
    const store = db();
    if (id) {
      const existing = store.products.find((p) => p.id === id);
      if (!existing) throw new Error("Product not found");
      Object.assign(existing, input);
      return clone(existing);
    }
    const created: Product = { id: demoId("p"), created_at: new Date().toISOString(), ...input };
    store.products.push(created);
    return clone(created);
  }

  // Writes to the catalog cross user boundaries, so they use the service-role client.
  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to edit the catalog.");

  const { data, error } = id
    ? await supabase.from("products").update(input).eq("id", id).select("*").single()
    : await supabase.from("products").insert(input).select("*").single();

  if (error) throw error;
  return data as Product;
}

/** Admin only. Adds a product row for every folder item that doesn't have one yet. */
export async function syncCatalogProducts(): Promise<number> {
  const existing = new Set((await listProducts({ includeInactive: true })).map((p) => p.name));
  const missing = catalogProductInputs().filter((i) => !existing.has(i.name));
  for (const input of missing) await upsertProduct(input);
  return missing.length;
}
