import LearnInteractionGuard from "./LearnInteractionGuard";

export default function LearnRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="learn-print-guard learn-copy-guard" data-learn-protected="1">
      <LearnInteractionGuard />
      {children}
    </div>
  );
}
