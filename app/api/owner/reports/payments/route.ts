/**
 * GET /api/owner/reports/payments
 * Danh sách giao dịch thanh toán cho Owner — không lặp dòng; join enrollment, khóa, chương trình.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { getSalePriceCents } from "../../../../../lib/course-price";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return (profile as { role?: string } | null)?.role === "owner";
}

type EnrollmentRow = {
  id: string;
  user_id: string;
  regular_course_id: string;
  payment_id: string | null;
  enrolled_at: string | null;
};

type CourseRow = {
  id: string;
  name: string;
  program_id: string | null;
  price_cents?: number | null;
  discount_percent?: number | null;
};

type PaymentReportRowInternal = {
  id: string;
  program_name: string;
  course_name: string;
  /** Ngày hiển thị: enrollment hoặc (khi chưa có bản ghi enrollment) ngày tạo giao dịch */
  enrolled_at: string | null;
  enrolled_at_display: string;
  management_code: string;
  student_name: string;
  student_code: string;
  status: string;
  payment_status: string;
  payment_completed_at: string | null;
  payment_date_display: string;
  amount_cents: number;
  amount_display: string;
  /** Giao dịch hoàn tất 0đ theo đợt whitelist (metadata.source = whitelist) */
  is_whitelist: boolean;
  invoice_exported_at: string | null;
  enrollment_only: boolean;
  _user_id: string | null;
  _created_at: string;
  _course_key: string;
  /** Có bản ghi enrollment gắn payment (khác null khi đã đăng ký qua hệ thống sau thanh toán / đã có enrollment) */
  _enrollment_at: string | null;
};

type PaymentReportPublicRow = Omit<
  PaymentReportRowInternal,
  "_user_id" | "_created_at" | "_course_key" | "_enrollment_at"
> & {
  /** Có dấu mốc xuất hóa đơn ở giao dịch chưa completed (dữ liệu lệch cần rà soát) */
  invoice_export_inconsistent: boolean;
  /** Giao dịch payment không còn user trong Auth */
  orphan_payment?: boolean;
};

type InvoiceState =
  | "not_applicable"
  | "not_eligible"
  | "pending_export"
  | "exported"
  | "needs_review";

type PaymentReportResponseRow = PaymentReportPublicRow & {
  invoice_state: InvoiceState;
  invoice_status_label: string;
  invoice_action_label: string;
  can_export_invoice: boolean;
};

export async function GET(request: Request) {
  const startedAt = Date.now();
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const reqUrl = new URL(request.url);
  const limitRaw = Number.parseInt(reqUrl.searchParams.get("limit") ?? "100", 10);
  const offsetRaw = Number.parseInt(reqUrl.searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  const includeEnrollmentOnly = reqUrl.searchParams.get("includeEnrollmentOnly") !== "0";
  const paymentStatus = reqUrl.searchParams.get("paymentStatus");
  const allowedStatuses = new Set(["pending", "completed", "failed", "refunded", "cancelled"]);
  const statusFilter =
    paymentStatus && allowedStatuses.has(paymentStatus) ? paymentStatus : null;
  const pullLimit = Math.min(Math.max(limit * 5, 500), 2000);

  let paymentsQuery = admin
    .from("payments")
    .select("id, user_id, amount_cents, status, gateway_transaction_id, invoice_exported_at, created_at, updated_at, metadata")
    .order("created_at", { ascending: false })
    .limit(pullLimit);
  if (statusFilter) {
    paymentsQuery = paymentsQuery.eq("status", statusFilter);
  }
  const { data: paymentsRaw } = await paymentsQuery;
  const payments = paymentsRaw ?? [];
  const paymentIds = payments.map((p) => p.id);

  /** Giao dịch gắn suất whitelist (kể cả metadata cũ không có source=whitelist) */
  let whitelistPaymentIds = new Set<string>();
  if (paymentIds.length > 0) {
    const { data: grantRows } = await admin
      .from("whitelist_free_grants")
      .select("payment_id")
      .in("payment_id", paymentIds);
    whitelistPaymentIds = new Set(
      (grantRows ?? [])
        .map((g) => (g as { payment_id: string | null }).payment_id)
        .filter((id): id is string => Boolean(id))
    );
  }

  const profileMap = new Map<
    string,
    { id: string; full_name?: string | null; email?: string | null; student_code?: string | null }
  >();
  let enrollments: {
    id: string;
    user_id: string;
    regular_course_id: string;
    payment_id: string | null;
    enrolled_at: string | null;
  }[] = [];

  if (paymentIds.length > 0) {
    const userIds = [...new Set(payments.map((p) => p.user_id).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, email, student_code")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, p);
      }
    }

    const { data: enRows } = await admin
      .from("enrollments")
      .select("id, user_id, regular_course_id, payment_id, enrolled_at")
      .in("payment_id", paymentIds);
    enrollments = (enRows ?? []) as typeof enrollments;
  }

  const byPayment = new Map<string, EnrollmentRow[]>();
  for (const e of enrollments ?? []) {
    if (!e.payment_id) continue;
    const list = byPayment.get(e.payment_id) ?? [];
    list.push(e as EnrollmentRow);
    byPayment.set(e.payment_id, list);
  }

  const courseIdsFromEn = [...new Set((enrollments ?? []).map((e) => e.regular_course_id).filter(Boolean))] as string[];
  const metaCourseIds = payments
    .map((p) => (p.metadata as { course_id?: string } | null)?.course_id)
    .filter(Boolean) as string[];
  const allCourseIds = [...new Set([...courseIdsFromEn, ...metaCourseIds])];

  const { data: courses } = allCourseIds.length > 0
    ? await admin
        .from("regular_courses")
        .select("id, name, program_id, price_cents, discount_percent")
        .in("id", allCourseIds)
    : { data: [] as CourseRow[] };

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c as CourseRow]));

  const programIds = [...new Set((courses ?? []).map((c) => c.program_id).filter(Boolean))] as string[];
  const { data: programs } = programIds.length > 0
    ? await admin.from("programs").select("id, name").in("id", programIds)
    : { data: [] as { id: string; name: string }[] };
  const programMap = new Map((programs ?? []).map((p) => [p.id, p.name]));

  const rows: PaymentReportRowInternal[] = payments.map((p) => {
    const ens = byPayment.get(p.id) ?? [];
    const sorted = [...ens].sort(
      (a, b) =>
        new Date(a.enrolled_at ?? 0).getTime() - new Date(b.enrolled_at ?? 0).getTime()
    );
    const earliestEnrolled = sorted[0]?.enrolled_at ?? null;

    const courseIdFromMeta = (p.metadata as { course_id?: string } | null)?.course_id;
    const courseIdsForRow = [
      ...new Set(
        [
          ...sorted.map((e) => e.regular_course_id),
          ...(courseIdFromMeta ? [courseIdFromMeta] : []),
        ].filter(Boolean)
      ),
    ] as string[];

    const course_key =
      courseIdsForRow.length > 0 ? [...courseIdsForRow].sort().join(",") : "—";

    const courseNames = courseIdsForRow
      .map((cid) => courseMap.get(cid)?.name)
      .filter((n): n is string => Boolean(n));
    const courseDisplay = courseNames.length ? [...new Set(courseNames)].join(", ") : "—";

    const programNames = new Set<string>();
    for (const cid of courseIdsForRow) {
      const c = courseMap.get(cid);
      const pid = c?.program_id;
      if (pid) {
        const pn = programMap.get(pid);
        if (pn) programNames.add(pn);
      }
    }
    const programDisplay = programNames.size ? [...programNames].join(", ") : "—";

    const profile = p.user_id ? profileMap.get(p.user_id) : null;
    const studentCodeDisplay =
      (profile as { student_code?: string | null } | undefined)?.student_code?.trim() || "—";

    const statusRaw = (p.status as string) || "pending";
    const statusLabel = paymentStatusLabel(statusRaw);

    const paymentCompletedAt =
      statusRaw === "completed" ? (p as { updated_at?: string }).updated_at ?? null : null;

    const createdAt = (p as { created_at?: string }).created_at ?? new Date(0).toISOString();

    const effectiveEnrolledAt = earliestEnrolled ?? createdAt;

    const payMeta = (p.metadata as { source?: string } | null) ?? {};
    const isWhitelist =
      payMeta.source === "whitelist" || whitelistPaymentIds.has(p.id);

    return {
      id: p.id,
      program_name: programDisplay,
      course_name: courseDisplay,
      enrolled_at: effectiveEnrolledAt,
      enrolled_at_display: formatDateVi(effectiveEnrolledAt),
      management_code: p.gateway_transaction_id || p.id.slice(0, 8),
      student_name: profile?.full_name || profile?.email || "—",
      student_code: studentCodeDisplay,
      status: statusLabel,
      payment_status: statusRaw,
      payment_completed_at: paymentCompletedAt,
      payment_date_display: paymentCompletedAt ? formatDateVi(paymentCompletedAt) : "—",
      amount_cents: p.amount_cents,
      amount_display: formatVnd(Number(p.amount_cents)),
      is_whitelist: isWhitelist,
      invoice_exported_at: p.invoice_exported_at,
      enrollment_only: false,
      _user_id: p.user_id ?? null,
      _created_at: createdAt,
      _course_key: course_key,
      _enrollment_at: earliestEnrolled,
    };
  });

  const paymentItems = dedupePaymentRows(rows);

  const { data: enrollmentsWithoutPayment } = includeEnrollmentOnly
    ? await admin
        .from("enrollments")
        .select("id, user_id, regular_course_id, enrolled_at, status")
        .is("payment_id", null)
        .eq("status", "active")
        .order("enrolled_at", { ascending: false })
        .limit(pullLimit)
    : { data: [] as { id: string; user_id: string; regular_course_id: string; enrolled_at: string | null; status: string }[] };

  const enrollmentOnlyRows = await buildEnrollmentWithoutPaymentRows(
    admin,
    enrollmentsWithoutPayment ?? [],
    profileMap,
    courseMap,
    programMap
  );

  const merged = mergeAndSortReportRows(paymentItems, enrollmentOnlyRows).map(attachInvoiceMeta);
  const total = merged.length;
  const items = merged.slice(offset, offset + limit);
  const hasMore = offset + items.length < total;

  const elapsed = Date.now() - startedAt;
  if (elapsed > 1200) {
    console.warn("[owner/reports/payments] slow request", {
      elapsed_ms: elapsed,
      total,
      returned: items.length,
      limit,
      offset,
      includeEnrollmentOnly,
      statusFilter,
    });
  }

  return NextResponse.json({
    items,
    meta: { total, limit, offset, hasMore },
  });
}

/**
 * Gộp các giao dịch trùng (cùng học viên + cùng khóa): nhiều lần tạo checkout chờ sẽ chỉ hiện một dòng.
 * Không gộp khi thiếu user_id (mỗi giao dịch một dòng).
 * Ưu tiên: đã thanh toán > chờ > các trạng thái khác; cùng mức → bản đã có enrollment > bản tạo mới nhất.
 */
function dedupePaymentRows(rows: PaymentReportRowInternal[]): PaymentReportPublicRow[] {
  const keyOf = (r: PaymentReportRowInternal) =>
    r._user_id != null ? `${r._user_id}|${r._course_key}` : r.id;

  const grouped = new Map<string, PaymentReportRowInternal[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const list = grouped.get(k) ?? [];
    list.push(r);
    grouped.set(k, list);
  }

  const list = [...grouped.values()]
    .map((group) => {
      const best = group.reduce((currentBest, row) =>
        pickBetterPaymentRow(currentBest, row)
      );
      const {
        completedExportedAt,
        hasInconsistentExport,
      } = summarizeInvoiceExportState(group);
      const {
        _user_id,
        _created_at,
        _course_key,
        _enrollment_at,
        ...pub
      } = best;
      void _created_at;
      void _course_key;
      void _enrollment_at;
      return {
        ...pub,
        invoice_exported_at: completedExportedAt,
        invoice_export_inconsistent: hasInconsistentExport,
        orphan_payment: _user_id == null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.enrolled_at ?? 0).getTime() - new Date(a.enrolled_at ?? 0).getTime()
    );

  return list;
}

function pickBetterPaymentRow(a: PaymentReportRowInternal, b: PaymentReportRowInternal): PaymentReportRowInternal {
  const ra = paymentStatusRank(a.payment_status);
  const rb = paymentStatusRank(b.payment_status);
  if (rb !== ra) return rb > ra ? b : a;
  const aHas = a._enrollment_at != null;
  const bHas = b._enrollment_at != null;
  if (aHas !== bHas) return aHas ? a : b;
  const ta = new Date(a._created_at).getTime();
  const tb = new Date(b._created_at).getTime();
  return tb >= ta ? b : a;
}

function summarizeInvoiceExportState(
  rows: PaymentReportRowInternal[]
): { completedExportedAt: string | null; hasInconsistentExport: boolean } {
  const completedExports = rows
    .filter((row) => row.payment_status === "completed" && row.invoice_exported_at)
    .map((row) => row.invoice_exported_at as string);
  const inconsistentExports = rows
    .filter((row) => row.payment_status !== "completed" && row.invoice_exported_at)
    .map((row) => row.invoice_exported_at as string);
  return {
    completedExportedAt:
      completedExports.length > 0 ? latestIso(completedExports) : null,
    hasInconsistentExport: inconsistentExports.length > 0,
  };
}

/**
 * Enrollment chưa gắn payment: khóa thật sự miễn phí (giá sau giảm = 0) vs khóa trả phí (đăng ký trước / chờ thanh toán).
 * Cùng logic `resolveEnrollmentPaymentAccess` trong lib/enrollment-payment-status.ts
 */
async function buildEnrollmentWithoutPaymentRows(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  enrollmentsNoPayment: {
    id: string;
    user_id: string;
    regular_course_id: string;
    enrolled_at: string | null;
    status: string;
  }[],
  profileMap: Map<
    string,
    { id: string; full_name?: string | null; email?: string | null; student_code?: string | null }
  >,
  courseMap: Map<string, CourseRow>,
  programMap: Map<string, string>
): Promise<PaymentReportPublicRow[]> {
  if (!enrollmentsNoPayment.length) return [];

  const courseIds = [...new Set(enrollmentsNoPayment.map((e) => e.regular_course_id).filter(Boolean))] as string[];
  if (courseIds.length) {
    const { data: pricedCourses } = await admin
      .from("regular_courses")
      .select("id, name, program_id, price_cents, discount_percent")
      .in("id", courseIds);
    for (const c of pricedCourses ?? []) {
      courseMap.set(c.id, c as CourseRow);
    }
    const pids = [...new Set((pricedCourses ?? []).map((c) => c.program_id).filter(Boolean))] as string[];
    const missingPids = pids.filter((pid) => !programMap.has(pid));
    if (missingPids.length) {
      const { data: morePrograms } = await admin.from("programs").select("id, name").in("id", missingPids);
      for (const p of morePrograms ?? []) {
        programMap.set(p.id, p.name);
      }
    }
  }

  const userIds = [...new Set(enrollmentsNoPayment.map((e) => e.user_id))];
  const missingUserIds = userIds.filter((uid) => !profileMap.has(uid));
  if (missingUserIds.length) {
    const { data: moreProfiles } = await admin
      .from("profiles")
      .select("id, full_name, email, student_code")
      .in("id", missingUserIds);
    for (const pr of moreProfiles ?? []) {
      profileMap.set(pr.id, pr);
    }
  }

  return enrollmentsNoPayment.map((e) => {
    const course = courseMap.get(e.regular_course_id);
    const courseDisplay = course?.name ?? "—";
    const pid = course?.program_id;
    const programDisplay = pid ? programMap.get(pid) ?? "—" : "—";
    const profile = profileMap.get(e.user_id);
    const studentCode =
      (profile as { student_code?: string | null } | undefined)?.student_code?.trim() || "—";
    const enrolledAt = e.enrolled_at ?? new Date(0).toISOString();

    const priceCents = Number(course?.price_cents) || 0;
    const discountPercent = course?.discount_percent ?? null;
    const saleCents = getSalePriceCents(priceCents, discountPercent);
    const isFreeCourse = saleCents <= 0;

    if (isFreeCourse) {
      return {
        id: e.id,
        program_name: programDisplay,
        course_name: courseDisplay,
        enrolled_at: enrolledAt,
        enrolled_at_display: formatDateVi(enrolledAt),
        management_code: `EN-${e.id.slice(0, 8)}`,
        student_name: profile?.full_name || profile?.email || "—",
        student_code: studentCode,
        status: "Đăng ký miễn phí",
        payment_status: "free",
        payment_completed_at: null,
        payment_date_display: "—",
        amount_cents: 0,
        amount_display: "Miễn phí",
        is_whitelist: false,
        invoice_exported_at: null,
        invoice_export_inconsistent: false,
        enrollment_only: true,
        orphan_payment: false,
      };
    }

    return {
      id: e.id,
      program_name: programDisplay,
      course_name: courseDisplay,
      enrolled_at: enrolledAt,
      enrolled_at_display: formatDateVi(enrolledAt),
      management_code: `EN-${e.id.slice(0, 8)}`,
      student_name: profile?.full_name || profile?.email || "—",
      student_code: studentCode,
      status: paymentStatusLabel("pending"),
      payment_status: "pending",
      payment_completed_at: null,
      payment_date_display: "—",
      amount_cents: saleCents,
      amount_display: formatVnd(saleCents),
      is_whitelist: false,
      invoice_exported_at: null,
      invoice_export_inconsistent: false,
      enrollment_only: true,
      orphan_payment: false,
    };
  });
}

function mergeAndSortReportRows(
  paymentItems: PaymentReportPublicRow[],
  enrollmentRows: PaymentReportPublicRow[]
): PaymentReportPublicRow[] {
  return [...paymentItems, ...enrollmentRows].sort(
    (a, b) =>
      new Date(b.enrolled_at ?? 0).getTime() - new Date(a.enrolled_at ?? 0).getTime()
  );
}

function attachInvoiceMeta(
  row: PaymentReportPublicRow
): PaymentReportResponseRow {
  const paymentLabel = paymentStatusLabel(row.payment_status);
  const paymentLabelLower = paymentLabel.toLowerCase();

  if (row.orphan_payment && !row.enrollment_only) {
    return {
      ...row,
      invoice_state: "needs_review",
      invoice_status_label: "— (không còn học viên trong hệ thống)",
      invoice_action_label: "—",
      can_export_invoice: false,
    };
  }

  if (row.invoice_export_inconsistent) {
    return {
      ...row,
      invoice_state: "needs_review",
      invoice_status_label:
        "Cần rà soát — phát hiện dấu mốc xuất hóa đơn ở giao dịch chưa thanh toán hoàn tất",
      invoice_action_label: "Cần rà soát",
      can_export_invoice: false,
    };
  }

  if (row.invoice_exported_at) {
    return {
      ...row,
      invoice_state: "exported",
      invoice_status_label: `Đã xuất — ${formatDateTimeVi(
        row.invoice_exported_at
      )}`,
      invoice_action_label: "Đã xuất",
      can_export_invoice: false,
    };
  }

  if (row.enrollment_only && row.payment_status === "free") {
    return {
      ...row,
      invoice_state: "not_applicable",
      invoice_status_label: "— (không qua thanh toán)",
      invoice_action_label: "—",
      can_export_invoice: false,
    };
  }

  if (row.payment_status === "completed") {
    return {
      ...row,
      invoice_state: "pending_export",
      invoice_status_label: "Chưa đánh dấu xuất",
      invoice_action_label: "Xuất hóa đơn",
      can_export_invoice: true,
    };
  }

  if (row.payment_status === "pending") {
    return {
      ...row,
      invoice_state: "not_eligible",
      invoice_status_label: "Chưa đủ điều kiện (chờ thanh toán)",
      invoice_action_label: "Chưa thanh toán",
      can_export_invoice: false,
    };
  }

  return {
    ...row,
    invoice_state: "not_eligible",
    invoice_status_label: `Không thể xuất (${paymentLabelLower})`,
    invoice_action_label: "Không thể xuất",
    can_export_invoice: false,
  };
}

function paymentStatusRank(s: string): number {
  switch (s) {
    case "completed":
      return 5;
    case "pending":
      return 4;
    case "failed":
      return 3;
    case "refunded":
      return 2;
    case "cancelled":
      return 1;
    default:
      return 0;
  }
}

function formatDateVi(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTimeVi(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function paymentStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Đã thanh toán";
    case "pending":
      return "Chờ thanh toán";
    case "failed":
      return "Thanh toán thất bại";
    case "refunded":
      return "Đã hoàn tiền";
    case "cancelled":
      return "Đã hủy";
    default:
      return status || "—";
  }
}

function formatVnd(cents: number): string {
  if (cents === 0) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(cents);
}

function latestIso(values: string[]): string {
  return [...values].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )[0];
}
