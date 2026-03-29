"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function ConfirmAdminPromotionClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMessage("Thiếu liên kết xác nhận. Mở đúng URL trong email.");
      return;
    }
    if (ran.current) return;
    ran.current = true;

    async function run() {
      setStatus("loading");
      try {
        const res = await fetch("/api/owner/students/promote-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as { error?: string };
        if (res.ok) {
          setStatus("ok");
          setMessage("Đã xác nhận nâng quyền Admin. Người dùng có thể đăng nhập khu vực quản trị.");
        } else {
          setStatus("err");
          setMessage(data.error || "Không thể xác nhận.");
        }
      } catch {
        setStatus("err");
        setMessage("Không thể kết nối. Thử lại sau.");
      }
    }
    void run();
  }, [token]);

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-white/5 p-8">
      {status === "loading" && <p className="text-gray-300">Đang xác nhận…</p>}
      {status === "ok" && (
        <>
          <p className="text-green-300">{message}</p>
          <Link
            href="/owner/admins"
            className="mt-6 inline-block text-sm font-semibold text-[#D4AF37] hover:underline"
          >
            Đi tới Quản lý Admin →
          </Link>
        </>
      )}
      {status === "err" && <p className="text-red-200">{message}</p>}
      {status === "err" && token && (
        <Link href="/owner/students" className="mt-6 inline-block text-sm text-gray-400 hover:text-[#D4AF37]">
          ← Về Quản lý học viên
        </Link>
      )}
    </div>
  );
}
