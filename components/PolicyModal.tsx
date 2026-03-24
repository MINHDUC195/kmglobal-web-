"use client";

import { useEffect } from "react";
import Link from "next/link";

type PolicyType = "terms" | "privacy";

const POLICY_CONTENT: Record<PolicyType, { title: string; description: string; body: string }> = {
  terms: {
    title: "Điều khoản sử dụng",
    description:
      "Văn bản pháp lý điều chỉnh việc sử dụng nền tảng đào tạo ISO/Hệ thống quản lý, bao gồm quyền truy cập học liệu, bảo mật tài khoản và trách nhiệm tuân thủ của học viên.",
    body: "Nội dung đang được cập nhật. Vui lòng quay lại sau.",
  },
  privacy: {
    title: "Chính sách bảo mật",
    description:
      "Chính sách mô tả cách hệ thống thu thập, lưu trữ, xử lý và bảo vệ thông tin học viên trong quá trình học tập các chương trình ISO/Hệ thống quản lý.",
    body: "Nội dung đang được cập nhật. Vui lòng quay lại sau.",
  },
};

interface PolicyModalProps {
  type: PolicyType;
  isOpen: boolean;
  onClose: () => void;
  onSwitch?: (type: PolicyType) => void;
}

export default function PolicyModal({ type, isOpen, onClose, onSwitch }: PolicyModalProps) {
  const content = POLICY_CONTENT[type];

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#D4AF37]/30 bg-[#0f1c33] p-6 shadow-[0_0_35px_rgba(212,175,55,0.2)] md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-[0.22em] text-[#D4AF37]/80">KM Global Academy</p>
        <h2 id="policy-title" className="mt-2 font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          {content.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-gray-300">{content.description}</p>

        <article className="mt-6 rounded-xl border border-white/10 bg-[#091327]/75 p-4">
          <div className="text-[15px] leading-8 text-gray-100">{content.body}</div>
        </article>

        {onSwitch && (
          <p className="mt-4 text-sm text-gray-400">
            {type === "terms" ? (
              <>
                <button
                  type="button"
                  onClick={() => onSwitch("privacy")}
                  className="font-semibold text-[#D4AF37] underline hover:text-[#E7C768]"
                >
                  Xem Chính sách bảo mật
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSwitch("terms")}
                  className="font-semibold text-[#D4AF37] underline hover:text-[#E7C768]"
                >
                  Xem Điều khoản sử dụng
                </button>
              </>
            )}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <Link
            href={type === "terms" ? "/terms-of-service" : "/privacy-policy"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 underline hover:text-[#D4AF37]"
          >
            Mở trang đầy đủ trong tab mới
          </Link>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full border border-[#D4AF37]/70 bg-[#D4AF37]/10 px-5 py-2.5 text-sm font-semibold text-[#F7E6A8] transition hover:bg-[#D4AF37] hover:text-black"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
