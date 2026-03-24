/**
 * GET /api/admin/whoami — role hiện tại (admin/owner)
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getStaffRole, isAdminOrOwner } from "../../../../lib/staff-auth";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff || !isAdminOrOwner(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ role: staff.role });
}
