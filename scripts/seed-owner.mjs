/**
 * Seed owner account: admin@kmglobal.net
 * Run: node scripts/seed-owner.mjs
 * Requires: SUPABASE_SERVICE_ROLE_KEY, SEED_OWNER_PASSWORD in env (or .env.local)
 *
 * Windows PowerShell:
 *   $env:SEED_OWNER_PASSWORD="<your-strong-password>"
 *   node scripts/seed-owner.mjs
 *
 * Linux/Mac:
 *   SEED_OWNER_PASSWORD="<your-strong-password>" node scripts/seed-owner.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const path = join(__dirname, "..", ".env.local");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.SEED_OWNER_EMAIL || "admin@kmglobal.net";
const ownerPassword = process.env.SEED_OWNER_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!ownerPassword) {
  console.error("Missing SEED_OWNER_PASSWORD. Set it before running:");
  console.error('  Windows: $env:SEED_OWNER_PASSWORD="<your-strong-password>"');
  console.error('  Linux/Mac: SEED_OWNER_PASSWORD="<your-strong-password>" node scripts/seed-owner.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log("Seeding owner:", ownerEmail);

  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());

  let userId;
  if (found) {
    userId = found.id;
    console.log("User already exists, updating profile to owner...");
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password: ownerPassword });
    if (updateError) {
      console.warn("Could not update password:", updateError.message);
    } else {
      console.log("Password updated.");
    }
  } else {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { full_name: "KM Global Owner" },
    });
    if (createError) {
      console.error("Create user failed:", createError.message);
      console.error("");
      console.error("Nếu lỗi 'User not allowed', hãy tạo user thủ công:");
      console.error("  1. Vào Supabase Dashboard → Authentication → Users → Add user");
      console.error("  2. Email: admin@kmglobal.net, Password: (mật khẩu của bạn)");
      console.error("  3. Chạy migration: supabase/migrations/20250112000003_seed_owner.sql");
      process.exit(1);
    }
    userId = createData.user.id;
    console.log("User created.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: "KM Global Owner",
      email: ownerEmail.toLowerCase(),
      role: "owner",
      security_signed: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Profile upsert failed:", profileError.message);
    process.exit(1);
  }

  console.log("Owner profile set successfully. You can login at /login");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
