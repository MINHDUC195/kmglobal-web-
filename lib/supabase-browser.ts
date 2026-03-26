import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.generated";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function isConfigValid(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http"));
}

declare global {
  var __kmglobal_supabase_browser__: ReturnType<typeof createBrowserClient> | undefined;
}

export function getSupabaseBrowserClient() {
  if (!globalThis.__kmglobal_supabase_browser__) {
    if (!isConfigValid()) {
      console.warn(
        "[KM Global] Supabase chưa cấu hình. Kiểm tra NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local"
      );
    }
    globalThis.__kmglobal_supabase_browser__ = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return globalThis.__kmglobal_supabase_browser__;
}

/**
 * Opt-in typed client cho module đang migrate dần.
 * Vẫn dùng singleton hiện tại để tránh thay đổi runtime.
 */
export function getSupabaseBrowserClientTyped(): SupabaseClient<Database> {
  return getSupabaseBrowserClient() as SupabaseClient<Database>;
}
