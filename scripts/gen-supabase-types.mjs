/**
 * Sinh types/database.generated.ts từ API Supabase (public schema).
 * Thứ tự: SUPABASE_PROJECT_ID env → supabase/.temp/project-ref (nếu có).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "types", "database.generated.ts");

function resolveProjectId() {
  const fromEnv = process.env.SUPABASE_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  const refPath = join(root, "supabase", ".temp", "project-ref");
  if (existsSync(refPath)) {
    return readFileSync(refPath, "utf8").trim();
  }
  throw new Error(
    "Thiếu project id: đặt SUPABASE_PROJECT_ID hoặc chạy `supabase link` để tạo supabase/.temp/project-ref."
  );
}

const projectId = resolveProjectId();
if (!/^[a-z0-9_-]+$/i.test(projectId)) {
  throw new Error("SUPABASE_PROJECT_ID không hợp lệ.");
}
const out = execSync(
  `npx supabase gen types typescript --project-id "${projectId}" --schema public`,
  { encoding: "utf8", cwd: root, maxBuffer: 20 * 1024 * 1024 }
);

writeFileSync(outPath, out, "utf8");
console.log("Wrote", outPath);
