"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initial: {
    fullName: string;
    email: string;
    address: string;
    company: string;
    phone: string;
    gender: "" | "male" | "female" | "other";
    avatarUrl: string;
    studentCode: string;
  };
};

export default function StudentProfileForm({ initial }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(initial.fullName);
  const [address, setAddress] = useState(initial.address);
  const [company, setCompany] = useState(initial.company);
  const [phone, setPhone] = useState(initial.phone);
  const [gender, setGender] = useState<"" | "male" | "female" | "other">(initial.gender);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          address: address.trim(),
          company: company.trim(),
          phone: phone.trim(),
          gender: gender || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(data.error || "Không thể cập nhật.");
      }
    } catch {
      setError("Không thể kết nối.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAvatarChange(file: File | null) {
    if (!file) return;
    setError("");
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/student/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        router.refresh();
      } else {
        setError(data.error || "Không thể tải ảnh lên.");
      }
    } catch {
      setError("Không thể tải ảnh lên.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-white/10 bg-white/5 p-6">
      {initial.studentCode ? (
        <div className="rounded-lg border border-[#D4AF37]/30 bg-[#0b1323]/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Mã học viên
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-[#D4AF37]">
            {initial.studentCode}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Mã học viên sẽ được cấp tự động theo định dạng 440311 (ví dụ: 440311-A000068 — chữ cái
          và 6 chữ số tăng dần).
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-[#D4AF37]/50 bg-[#0b1323]">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL động từ Supabase Storage
            <img
              src={avatarUrl}
              alt="Ảnh đại diện"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-gray-600">
              HV
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">Ảnh đại diện</label>
          <p className="text-xs text-gray-500">
            JPEG, PNG hoặc WebP — tối đa 2MB. Ảnh hiển thị trên hồ sơ và có thể dùng cho chứng chỉ.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              className="hidden"
              onChange={(e) => void handleAvatarChange(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-50"
            >
              {uploadingAvatar ? "Đang tải..." : "Chọn ảnh"}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300">Họ và tên</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1323] px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
          placeholder="Nhập họ và tên"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Email</label>
        <input
          type="email"
          value={initial.email}
          readOnly
          className="mt-1 w-full cursor-not-allowed rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-gray-400"
          placeholder="email@example.com"
          title="Email không thể thay đổi"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Điện thoại</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1323] px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
          placeholder="Số điện thoại"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Công ty / Tổ chức</label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1323] px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
          placeholder="Tên công ty"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Địa chỉ</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1323] px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
          placeholder="Địa chỉ"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Giới tính</label>
        <select
          value={gender}
          onChange={(e) => setGender((e.target.value || "") as "" | "male" | "female" | "other")}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1323] px-4 py-2.5 text-white outline-none focus:border-[#D4AF37]"
        >
          <option value="">— Chọn —</option>
          <option value="male">Nam</option>
          <option value="female">Nữ</option>
          <option value="other">Khác</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          Cập nhật thành công.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-50"
      >
        {submitting ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
