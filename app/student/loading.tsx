export default function StudentLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-white/10" />
      <div className="h-5 w-80 animate-pulse rounded-lg bg-white/5" />
      <div className="mt-6 space-y-4">
        <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}
