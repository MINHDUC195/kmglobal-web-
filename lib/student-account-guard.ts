/**
 * Chặn học viên khi bị khóa abuse hoặc tự tạm khóa (server).
 */

import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "./supabase-admin";
import {
  clearExpiredSelfTempLockIfNeeded,
  isSelfTempLocked,
} from "./profile-account-locks";

export async function guardStudentAccountOrRedirect(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const state = await clearExpiredSelfTempLockIfNeeded(admin, userId);

  if (state.accountAbuseLocked) {
    redirect("/account-locked");
  }
  if (isSelfTempLocked(state.selfTempLockUntil)) {
    redirect("/account-temp-locked");
  }
}
