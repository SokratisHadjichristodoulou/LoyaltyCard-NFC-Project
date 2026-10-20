"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountFormState = { ok?: boolean; error?: string; value?: string };

export async function updateName(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent("/account")}`);
  const typed = String(formData.get("display_name") ?? "");
  const name = typed.trim().replace(/\s+/g, " ");
  if (name.length > 80) return { error: "tooLong", value: typed };

  // As the customer: RLS and column grants allow only their own name and language.
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: name || null }).eq("id", profile.id);
  if (error) return { error: "failed", value: typed };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Deletes the signed-in customer's sign-in account. The database removes
 * their profile, card, stamps and coupons with it (on delete cascade).
 */
export async function deleteAccount(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent("/account")}`);
  if (profile.role !== "customer") return { error: "staff" };
  if (formData.get("confirm") !== "on") return { error: "mustConfirm" };

  const { error } = await createAdminClient().auth.admin.deleteUser(profile.id);
  if (error) return { error: "failed" };

  // Clear this browser's session cookies; the server session is already gone.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
