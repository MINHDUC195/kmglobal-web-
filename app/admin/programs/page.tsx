import Link from "next/link";
import { AdminBreadcrumbStrip } from "../../../components/AdminHierarchyBreadcrumb";
import DashboardNav from "../../../components/DashboardNav";
import Footer from "../../../components/Footer";
import ListPagination from "../../../components/ListPagination";
import {
  clampPage,
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  totalPagesFromCount,
} from "../../../lib/list-pagination";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import AdminProgramsList from "./AdminProgramsList";

export const dynamic = "force-dynamic";

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const q = await searchParams;
  const requestedPage = parsePageParam(q.page);
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const supabase = await createServerSupabaseClient();
  const { count: total } = await supabase
    .from("programs")
    .select("id", { count: "exact", head: true });
  const totalItems = total ?? 0;
  const totalPages = totalPagesFromCount(totalItems, pageSize);
  const page = clampPage(requestedPage, totalPages);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, code, note, created_at, approval_status")
    .range(from, to)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />
      <AdminBreadcrumbStrip
        items={[
          { label: "Trang quản trị", href: "/admin" },
          { label: "Chương trình học" },
        ]}
      />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
            Chương trình học
          </h1>
          <Link
            href="/admin/programs/new"
            className="rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
          >
            + Thêm chương trình
          </Link>
        </div>

        <div className="mt-8">
          <AdminProgramsList programs={programs ?? []} />
          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            basePath="/admin/programs"
          />
        </div>
      </main>

      <Footer hideLogo />
    </div>
  );
}
