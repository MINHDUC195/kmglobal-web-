type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
};

export default function SectionHeader({ eyebrow, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-10 text-center sm:mb-12 lg:mb-14">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.35em] text-[#D4AF37]/70">
        {eyebrow}
      </p>
      <h2 className="font-[family-name:var(--font-serif)] text-3xl font-bold uppercase tracking-[0.12em] text-white sm:text-4xl whitespace-pre-line">
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-2xl text-base text-gray-400">{subtitle}</p>
      )}
      <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />
    </div>
  );
}
