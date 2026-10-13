import { DEMO_MODE } from "@/lib/config";
import { clone, db, demoId } from "@/lib/demo/store";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name);

export async function listProducts({ includeInactive = false } = {}): Promise<Product[]> {
  if (DEMO_MODE) {
    return clone(db().products.filter((p) => includeInactive || p.active)).sort(byName);
  }

  const supabase = await serverSupabase();
  if (!supabase) return [];

  let query = supabase.from("products").select("*").order("name");
  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function getProduct(id: string): Promise<Product | null> {
  if (DEMO_MODE) return clone(db().products.find((p) => p.id === id) ?? null);

  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Product | null) ?? null;
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
