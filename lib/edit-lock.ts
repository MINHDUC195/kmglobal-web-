/**
 * Client helpers cho pessimistic locking (lesson/chapter)
 */

const BASE = "/api/admin/edit-locks";

export type LockResourceType = "lesson" | "chapter";

export type AcquireResult =
  | { ok: true; expiresAt: string }
  | { ok: false; lockedBy: string; expiresAt: string };

export async function acquireLock(
  type: LockResourceType,
  id: string
): Promise<AcquireResult> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource_type: type, resource_id: id }),
    credentials: "include",
  });

  if (res.status === 409) {
    const data = (await res.json()) as {
      locked_by_name?: string;
      expires_at?: string;
    };
    return {
      ok: false,
      lockedBy: data.locked_by_name ?? "Người khác",
      expiresAt: data.expires_at ?? "",
    };
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Lỗi lấy khóa chỉnh sửa");
  }

  const data = (await res.json()) as { expires_at?: string };
  return { ok: true, expiresAt: data.expires_at ?? "" };
}

export async function extendLock(type: LockResourceType, id: string): Promise<boolean> {
  const res = await fetch(BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource_type: type, resource_id: id }),
    credentials: "include",
  });
  return res.ok;
}

export async function releaseLock(type: LockResourceType, id: string): Promise<void> {
  const body = JSON.stringify({ resource_type: type, resource_id: id });
  await fetch(BASE, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "include",
    keepalive: true,
  });
}
