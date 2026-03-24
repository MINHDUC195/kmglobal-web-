"use client";

import FrontendShield from "../components/FrontendShield";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FrontendShield />
      {children}
    </>
  );
}

