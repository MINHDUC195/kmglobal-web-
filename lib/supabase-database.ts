/**
 * Alias opt-in khi muốn annotate client với schema Postgres đã generate.
 * Chưa gắn `<Database>` vào `createServerSupabaseClient` / `getSupabaseBrowserClient` toàn app
 * vì nhiều chỗ cần chỉnh nullability và Json trước (xem types/README.md).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.generated";

export type { Database } from "../types/database.generated";
export type TypedSupabaseClient = SupabaseClient<Database>;
