"use client";

import AuthGuard from "@/components/AuthGuard";
import { FinanceProvider } from "@/lib/FinanceProvider";

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <FinanceProvider>{children}</FinanceProvider>
    </AuthGuard>
  );
}
