import Link from "next/link";

type ListPaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  basePath: string;
  query?: Record<string, string | undefined>;
  className?: string;
};

function buildHref(
  basePath: string,
  query: Record<string, string | undefined> | undefined,
  page: number
): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export default function ListPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  basePath,
  query,
  className = "",
}: ListPaginationProps) {
  if (totalItems <= pageSize && totalPages <= 1) return null;
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div
      className={`mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-sm text-gray-500">
        Hien thi {from}-{to} / {totalItems} muc
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(basePath, query, page - 1)}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-gray-300 hover:border-[#D4AF37]/50 hover:text-[#D4AF37]"
          >
            ← Truoc
          </Link>
        ) : (
          <span className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-600">
            ← Truoc
          </span>
        )}
        <span className="text-sm text-gray-400">
          Trang <span className="font-semibold text-white">{page}</span> / {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={buildHref(basePath, query, page + 1)}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-gray-300 hover:border-[#D4AF37]/50 hover:text-[#D4AF37]"
          >
            Sau →
          </Link>
        ) : (
          <span className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-600">
            Sau →
          </span>
        )}
      </div>
    </div>
  );
}
