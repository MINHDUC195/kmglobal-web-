import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "../types/database.generated";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore - Server Components cannot set cookies
        }
      },
    },
  });
}

/**
 * Opt-in typed client cho module đang migrate dần (auth/profile trước).
 * Không đổi hành vi runtime so với createServerSupabaseClient().
 */
export async function createServerSupabaseClientTyped(): Promise<SupabaseClient<Database>> {
  return (await createServerSupabaseClient()) as SupabaseClient<Database>;
}
