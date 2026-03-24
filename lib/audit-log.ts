import { getSupabaseAdminClient } from "./supabase-admin";

/**
 * Ghi nhật ký thao tác (owner/admin). Lỗi ghi log không làm fail request chính.
 */
export async function logAuditEvent(input: {
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: input.actorId,
      action: input.action,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    console.error("audit_logs insert failed:", e);
  }
}
