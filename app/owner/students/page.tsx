"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Student = {
  id: string;
  student_code: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  gender: string;
  created_at: string;
  enrolled_courses: string[];
  payment_status: string;
  account_abuse_locked?: boolean;
};

type StudentDetail = {
  profile: {
    id: string;
    studentCode: string | null;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    address: string | null;
    gender: string | null;
    createdAt: string | null;
  };
  enrollments: Array<{ id: string; courseName: string; enrolledAt: string | null }>;
  certificates: Array<{ id: string; code: string; percentScore: number; issuedAt: string | null; courseName: string }>;
};

export default function OwnerStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Student | null>(null);
  const [detailData, setDetailData] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<Student | null>(null);
  const [promoteConfirmStep, setPromoteConfirmStep] = useState(1);
  const [promoting, setPromoting] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  async function loadStudents() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/owner/students");
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students ?? []);
      } else {
        setError(data.error || "Không tải được danh sách học viên.");
        setStudents([]);
      }
    } catch {
      setError("Không thể kết nối.");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  async function openDetailModal(student: Student) {
    setDetailTarget(student);
    setDetailData(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/owner/students/${encodeURIComponent(student.id)}`);
      const data = await res.json();
      if (res.ok) {
        setDetailData(data);
      } else {
        setError(data.error || "Không tải được thông tin học viên.");
      }
    } catch {
      setError("Không thể kết nối.");
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetailModal() {
    setDetailTarget(null);
    setDetailData(null);
  }

  function openDeleteModal(student: Student) {
    setDeleteTarget(student);
    setDeleteConfirmStep(1);
  }

  function closeDeleteModal() {
    setDeleteTarget(null);
    setDeleteConfirmStep(1);
  }

  function openPromoteModal(student: Student) {
    setPromoteTarget(student);
    setPromoteConfirmStep(1);
  }

  function closePromoteModal() {
    setPromoteTarget(null);
    setPromoteConfirmStep(1);
  }

  async function handleUnlockAbuse(student: Student) {
    if (!student.account_abuse_locked) return;
    setUnlockingId(student.id);
    setError("");
    try {
      const res = await fetch(
        `/api/owner/students/${encodeURIComponent(student.id)}/unlock-abuse`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không mở khóa được.");
        return;
      }
      await loadStudents();
    } catch {
      setError("Không thể kết nối.");
    } finally {
      setUnlockingId(null);
    }
  }

  async function handlePromoteToAdmin() {
    if (!promoteTarget) return;
    if (promoteConfirmStep === 1) {
      setPromoteConfirmStep(2);
      return;
    }
    setPromoting(true);
    setError("");
    try {
      const res = await fetch("/api/owner/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: promoteTarget.id, action: "promote_to_admin" }),
      });
      const data = await res.json();
      if (res.ok) {
        closePromoteModal();
        closeDetailModal();
        void loadStudents();
      } else {
        setError(data.error || "Không thể phê duyệt nâng admin.");
      }
    } catch {
      setError("Không thể kết nối.");
    } finally {
      setPromoting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/owner/students?userId=${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        closeDeleteModal();
        void loadStudents();
      } else {
        setError(data.error || "Không thể xóa học viên.");
      }
    } catch {
      setError("Không thể kết nối.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/owner"
          className="text-sm text-gray-400 hover:text-[#D4AF37]"
        >
          ← Dashboard Owner
        </Link>
      </div>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Quản lý học viên
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-400">
        Bạn có thể phê duyệt nâng học viên lên <strong className="text-gray-300">Admin</strong> (truy cập khu vực quản trị).
        Sau khi phê duyệt, hãy vào{" "}
        <Link href="/owner/admins" className="text-[#D4AF37] underline hover:no-underline">
          Quản lý Admin
        </Link>{" "}
        để gán chương trình chỉnh sửa nếu cần.
      </p>

      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
        {error && (
          <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-gray-500">Đang tải...</p>
        ) : students.length === 0 ? (
          <p className="text-gray-500">Chưa có học viên nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-white/15 text-left">
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37]">Mã học viên</th>
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37]">Họ tên</th>
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37]">Email</th>
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37]">Số điện thoại</th>
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37]">Công ty</th>
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37]">Địa chỉ</th>
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37]">Giới tính</th>
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37]">Ngày tham gia</th>
                  <th className="pb-3 pr-4 text-sm font-semibold text-[#D4AF37] text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-white/5">
                    <td className="py-3 pr-4 font-mono text-sm text-white">{s.student_code}</td>
                    <td className="py-3 pr-4 text-sm text-white">{s.full_name}</td>
                    <td className="py-3 pr-4 text-sm text-gray-300">{s.email}</td>
                    <td className="py-3 pr-4 text-sm text-gray-300">{s.phone}</td>
                    <td className="py-3 pr-4 text-sm text-gray-300">{s.company}</td>
                    <td className="py-3 pr-4 text-sm text-gray-300">{s.address}</td>
                    <td className="py-3 pr-4 text-sm text-gray-300">{s.gender}</td>
                    <td className="py-3 pr-4 text-sm text-gray-400">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {s.account_abuse_locked && (
                          <span className="rounded border border-red-400/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-300">
                            Khóa abuse
                          </span>
                        )}
                        {s.account_abuse_locked && (
                          <button
                            type="button"
                            disabled={unlockingId === s.id}
                            onClick={() => void handleUnlockAbuse(s)}
                            className="rounded-lg border border-amber-500/60 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/15 disabled:opacity-50"
                          >
                            {unlockingId === s.id ? "Đang mở..." : "Mở khóa abuse"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDetailModal(s)}
                          className="rounded-lg border border-[#D4AF37]/60 px-3 py-1.5 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/10"
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          onClick={() => openPromoteModal(s)}
                          className="rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/15"
                        >
                          Phê duyệt Admin
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(s)}
                          className="rounded-lg border border-red-400/50 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-[#0a1628] shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a1628] p-6">
              <h3 className="text-lg font-semibold text-[#D4AF37]">
                Chi tiết học viên
              </h3>
              <button
                type="button"
                onClick={closeDetailModal}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
                aria-label="Đóng"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {loadingDetail ? (
                <p className="text-gray-500">Đang tải...</p>
              ) : detailData ? (
                <>
                  <section>
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#D4AF37]">
                      Thông tin cá nhân
                    </h4>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-gray-500">Mã học viên</dt>
                        <dd className="font-mono text-white">{detailData.profile.studentCode ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Họ tên</dt>
                        <dd className="text-white">{detailData.profile.fullName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Email</dt>
                        <dd className="text-white">{detailData.profile.email ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Số điện thoại</dt>
                        <dd className="text-white">{detailData.profile.phone ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Công ty</dt>
                        <dd className="text-white">{detailData.profile.company ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Địa chỉ</dt>
                        <dd className="text-white">{detailData.profile.address ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Giới tính</dt>
                        <dd className="text-white">{detailData.profile.gender ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Ngày tham gia</dt>
                        <dd className="text-white">
                          {detailData.profile.createdAt
                            ? new Date(detailData.profile.createdAt).toLocaleDateString("vi-VN", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </section>
                  <section>
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#D4AF37]">
                      Khóa học đã đăng ký
                    </h4>
                    {detailData.enrollments.length > 0 ? (
                      <ul className="space-y-2">
                        {detailData.enrollments.map((e) => (
                          <li key={e.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                            <span className="text-white">{e.courseName}</span>
                            <span className="text-sm text-gray-400">
                              {e.enrolledAt
                                ? new Date(e.enrolledAt).toLocaleDateString("vi-VN", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">Chưa đăng ký khóa học nào.</p>
                    )}
                  </section>
                  <section>
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#D4AF37]">
                      Chứng chỉ đã đạt
                    </h4>
                    {detailData.certificates.length > 0 ? (
                      <ul className="space-y-2">
                        {detailData.certificates.map((c) => (
                          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                            <span className="text-white">{c.courseName}</span>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-mono text-[#D4AF37]">{c.code}</span>
                              <span className="text-gray-400">{c.percentScore}%</span>
                              <span className="text-gray-500">
                                {c.issuedAt
                                  ? new Date(c.issuedAt).toLocaleDateString("vi-VN", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                    })
                                  : ""}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">Chưa có chứng chỉ nào.</p>
                    )}
                  </section>
                  {detailTarget && (
                    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-6">
                      <button
                        type="button"
                        onClick={() => {
                          openPromoteModal(detailTarget);
                          closeDetailModal();
                        }}
                        className="rounded-lg border border-emerald-500/50 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/15"
                      >
                        Phê duyệt lên Admin
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">Không tải được dữ liệu.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {promoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-emerald-500/30 bg-[#0a1628] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#D4AF37]">
              {promoteConfirmStep === 1 ? "Phê duyệt lên Admin" : "Xác nhận phê duyệt"}
            </h3>
            {promoteConfirmStep === 1 ? (
              <p className="mt-3 text-sm text-gray-300">
                Bạn sắp cấp quyền <strong className="text-emerald-200">Admin</strong> cho học viên{" "}
                <strong className="text-white">{promoteTarget.full_name}</strong> ({promoteTarget.email}
                ). Họ sẽ đăng nhập vào khu vực quản trị như các admin khác. Bạn có thể gán chương trình được
                phép sửa tại trang Quản lý Admin sau bước này.
              </p>
            ) : (
              <p className="mt-3 text-sm text-gray-300">
                Xác nhận lần cuối: <strong className="text-white">{promoteTarget.full_name}</strong> trở thành
                Admin. Thao tác có hiệu lực ngay sau khi nhấn &quot;Phê duyệt&quot;.
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => (promoteConfirmStep === 1 ? closePromoteModal() : setPromoteConfirmStep(1))}
                disabled={promoting}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                {promoteConfirmStep === 1 ? "Hủy" : "Quay lại"}
              </button>
              <button
                type="button"
                onClick={handlePromoteToAdmin}
                disabled={promoting}
                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {promoting
                  ? "Đang xử lý..."
                  : promoteConfirmStep === 1
                    ? "Tiếp tục"
                    : "Phê duyệt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a1628] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#D4AF37]">
              {deleteConfirmStep === 1 ? "Xác nhận xóa học viên" : "Xác nhận lần cuối"}
            </h3>
            {deleteConfirmStep === 1 ? (
              <p className="mt-3 text-sm text-gray-300">
                Bạn có chắc muốn xóa học viên <strong className="text-white">{deleteTarget.full_name}</strong> (
                {deleteTarget.email})? Dữ liệu sẽ bị xóa hoàn toàn khỏi hệ thống và không thể khôi phục.
              </p>
            ) : (
              <p className="mt-3 text-sm text-gray-300">
                Học viên <strong className="text-white">{deleteTarget.full_name}</strong> sẽ bị xóa vĩnh viễn. Nhấn
                &quot;Xóa vĩnh viễn&quot; để thực hiện.
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => (deleteConfirmStep === 1 ? closeDeleteModal() : setDeleteConfirmStep(1))}
                disabled={deleting}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                {deleteConfirmStep === 1 ? "Hủy" : "Quay lại"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting
                  ? "Đang xóa..."
                  : deleteConfirmStep === 1
                    ? "Tiếp tục"
                    : "Xóa vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
