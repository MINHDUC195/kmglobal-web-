/**
 * Khóa abuse (Owner mở) và tự tạm khóa 3 ngày — chỉ cập nhật qua admin client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileLockState = {
  accountAbuseLocked: boolean;
  selfTempLockUntil: string | null;
};

export async function getProfileLockState(
  admin: SupabaseClient,
  userId: string
): Promise<ProfileLockState> {
  const { data } = await admin
    .from("profiles")
    .select("account_abuse_locked, self_temp_lock_until")
    .eq("id", userId)
    .single();

  const row = data as {
    account_abuse_locked?: boolean | null;
    self_temp_lock_until?: string | null;
  } | null;

  return {
    accountAbuseLocked: Boolean(row?.account_abuse_locked),
    selfTempLockUntil: row?.self_temp_lock_until ?? null,
  };
}

/** Gọi từ layout server: hết hạn thì xóa self_temp_lock_until */
export async function clearExpiredSelfTempLockIfNeeded(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<ProfileLockState> {
  const state = await getProfileLockState(admin, userId);
  if (!state.selfTempLockUntil) return state;

  const until = new Date(state.selfTempLockUntil);
  if (until > now) return state;

  await admin
    .from("profiles")
    .update({ self_temp_lock_until: null })
    .eq("id", userId);

  return { ...state, selfTempLockUntil: null };
}

export function isSelfTempLocked(lockUntilIso: string | null, now: Date = new Date()): boolean {
  if (!lockUntilIso) return false;
  return new Date(lockUntilIso) > now;
}
