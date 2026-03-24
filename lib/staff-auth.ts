import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffRole = "owner" | "admin" | "student" | string | null;

export async function getStaffRole(supabase: SupabaseClient): Promise<{ userId: string; role: StaffRole } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role ?? null;
  return { userId: user.id, role };
}

export function isAdminOnly(role: StaffRole): boolean {
  return role === "admin";
}

export function isOwner(role: StaffRole): boolean {
  return role === "owner";
}

export function isAdminOrOwner(role: StaffRole): boolean {
  return role === "owner" || role === "admin";
}
