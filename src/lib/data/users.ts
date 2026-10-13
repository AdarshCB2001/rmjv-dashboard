import { DEMO_MODE, isAllowedEmail } from "@/lib/config";
import { clone, db, demoId } from "@/lib/demo/store";
import { adminSupabase } from "@/lib/supabase/server";
import type { AllowedUser } from "@/lib/types";

/** Admin only — the staff allow-list. */
export async function listAllowedUsers(): Promise<AllowedUser[]> {
  if (DEMO_MODE) {
    return clone(db().allowed_users).sort((a, b) => a.email.localeCompare(b.email));
  }
  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to manage staff.");
  const { data, error } = await supabase.from("allowed_users").select("*").order("email");
  if (error) throw error;
  return (data ?? []) as AllowedUser[];
}

export async function addAllowedUser(input: {
  email: string;
  full_name: string | null;
  is_admin: boolean;
}): Promise<AllowedUser> {
  const email = input.email.trim().toLowerCase();
  if (!isAllowedEmail(email)) {
    throw new Error("Only addresses on the allowed domain can be added.");
  }

  if (DEMO_MODE) {
    const store = db();
    if (store.allowed_users.some((u) => u.email === email)) {
      throw new Error("That address is already on the list.");
    }
    const user: AllowedUser = {
      id: demoId("u"),
      email,
      full_name: input.full_name,
      is_admin: input.is_admin,
      active: true,
      created_at: new Date().toISOString(),
    };
    store.allowed_users.push(user);
    return clone(user);
  }

  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to manage staff.");
  const { data, error } = await supabase
    .from("allowed_users")
    .insert({ email, full_name: input.full_name, is_admin: input.is_admin })
    .select("*")
    .single();
  if (error) throw error;
  return data as AllowedUser;
}

export async function updateAllowedUser(
  id: string,
  patch: { active?: boolean; is_admin?: boolean; full_name?: string | null },
): Promise<void> {
  if (DEMO_MODE) {
    const user = db().allowed_users.find((u) => u.id === id);
    if (!user) throw new Error("Staff member not found.");
    Object.assign(user, patch);
    return;
  }
  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to manage staff.");
  const { error } = await supabase.from("allowed_users").update(patch).eq("id", id);
  if (error) throw error;
}
