/**
 * POST /api/owner/whitelist-cohorts/[id]/import
 * Body: { csv: string }
 * Dòng đầu: email,password,student_code,full_name
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateOrigin } from "@/lib/csrf";
import { validatePasswordStrength } from "@/lib/password-policy";
import { logAuditEvent } from "@/lib/audit-log";
import { applyWhitelistAfterMemberAdded } from "@/lib/whitelist-reconcile";

async function ensureOwner() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, userId: "" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") return { ok: false as const, userId: "" };
  return { ok: true as const, userId: user.id };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const auth = await ensureOwner();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: cohortId } = await context.params;
  let body: { csv?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const csv = body.csv?.trim();
  if (!csv) {
    return NextResponse.json({ error: "Thiếu nội dung CSV" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: cohort } = await admin.from("whitelist_cohorts").select("id, name").eq("id", cohortId).maybeSingle();
  if (!cohort) {
    return NextResponse.json({ error: "Không tìm thấy đợt" }, { status: 404 });
  }

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "Cần ít nhất dòng tiêu đề và một dòng dữ liệu" }, { status: 400 });
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/^\ufeff/, ""));
  const emailIdx = header.indexOf("email");
  const passIdx = header.indexOf("password");
  const codeIdx = header.indexOf("student_code");
  const nameIdx = header.indexOf("full_name");
  if (emailIdx < 0 || passIdx < 0) {
    return NextResponse.json(
      { error: "Dòng đầu cần có cột email và password (student_code, full_name tùy chọn)" },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    new URL(request.url).origin;
  const redirectTo = `${baseUrl.replace(/\/$/, "")}/auth/agree-terms?to=${encodeURIComponent("/student")}`;

  const okRows: number[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = parseCsvLine(lines[i]);
    const emailRaw = cells[emailIdx]?.trim();
    const password = cells[passIdx] ?? "";
    const studentCode = codeIdx >= 0 ? (cells[codeIdx]?.trim() || "") : "";
    const fullName = nameIdx >= 0 ? (cells[nameIdx]?.trim() || "") : "";

    if (!emailRaw) {
      errors.push({ line: lineNum, message: "Thiếu email" });
      continue;
    }
    const emailLower = emailRaw.toLowerCase();

    const { data: existingMember } = await admin
      .from("whitelist_members")
      .select("id")
      .eq("cohort_id", cohortId)
      .eq("email", emailLower)
      .maybeSingle();
    if (existingMember) {
      errors.push({ line: lineNum, message: "Email đã có trong đợt này" });
      continue;
    }

    const { data: profileByEmail } = await admin
      .from("profiles")
      .select("id, role")
      .eq("email", emailLower)
      .maybeSingle();

    let userId: string | null = (profileByEmail as { id: string } | null)?.id ?? null;

    if (!userId) {
      const pw = validatePasswordStrength(password);
      if (!pw.ok) {
        errors.push({ line: lineNum, message: pw.message ?? "Mật khẩu không hợp lệ" });
        continue;
      }

      const createUserAttrs = Object.assign(
        {
          email: emailLower,
          password,
          email_confirm: true as const,
          user_metadata: {
            full_name: fullName || emailLower,
            role: "student",
          },
        },
        { email_redirect_to: redirectTo }
      );

      const { data: newUser, error: authError } = await admin.auth.admin.createUser(
        createUserAttrs as Parameters<typeof admin.auth.admin.createUser>[0]
      );

      if (authError || !newUser.user?.id) {
        const msg = authError?.message ?? "Không tạo được tài khoản";
        errors.push({ line: lineNum, message: msg.includes("already") ? "Email đã đăng ký" : msg });
        continue;
      }
      userId = newUser.user.id;

      const patch: Record<string, unknown> = {};
      if (fullName) patch.full_name = fullName;
      if (studentCode) patch.student_code = studentCode;
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await admin.from("profiles").update(patch).eq("id", userId);
        if (upErr) {
          if (String(upErr.code) === "23505") {
            await admin.from("profiles").update({ full_name: fullName || null }).eq("id", userId);
          } else {
            console.error("profile update import:", upErr);
          }
        }
      }
    } else {
      if (password && validatePasswordStrength(password).ok) {
        await admin.auth.admin.updateUserById(userId, { password });
      }
      if (fullName || studentCode) {
        const patch: Record<string, unknown> = {};
        if (fullName) patch.full_name = fullName;
        if (studentCode) patch.student_code = studentCode;
        const { error: upErr } = await admin.from("profiles").update(patch).eq("id", userId);
        if (upErr && String(upErr.code) === "23505" && studentCode) {
          await admin.from("profiles").update({ full_name: fullName || null }).eq("id", userId);
        }
      }
    }

    const { error: memErr } = await admin.from("whitelist_members").insert({
      cohort_id: cohortId,
      user_id: userId,
      email: emailLower,
      student_code: studentCode || null,
      full_name: fullName || null,
    });

    if (memErr) {
      if (String(memErr.code) === "23505") {
        errors.push({ line: lineNum, message: "Trùng thành viên trong đợt" });
      } else {
        errors.push({ line: lineNum, message: memErr.message });
      }
      continue;
    }
    if (userId) {
      try {
        await applyWhitelistAfterMemberAdded(admin, userId, cohortId);
      } catch (e) {
        console.error("whitelist reconcile after import:", e);
      }
    }
    okRows.push(lineNum);
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.whitelist_cohort.import",
    resourceType: "whitelist_cohort",
    resourceId: cohortId,
    metadata: { imported: okRows.length, errors: errors.length },
  });

  return NextResponse.json({
    ok: okRows.length,
    failed: errors.length,
    errors,
  });
}
