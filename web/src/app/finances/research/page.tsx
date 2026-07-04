"use client";

import { useState } from "react";
import ThirteenFBrowser from "@/components/finances/thirteenf/ThirteenFBrowser";
import AlgorithmDashboard from "@/components/finances/algorithm/AlgorithmDashboard";

type Tab = "13f" | "algorithm";

export default function ResearchPage() {
  const [tab, setTab] = useState<Tab>("13f");
  const tabClass = (active: boolean) =>
    `rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-white/[0.08] text-gray-50" : "text-gray-500 hover:text-gray-200"
    }`;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 inline-flex rounded-lg border border-white/[0.06] bg-gray-900/60 p-1">
        <button onClick={() => setTab("13f")} className={tabClass(tab === "13f")}>13F Filings</button>
        <button onClick={() => setTab("algorithm")} className={tabClass(tab === "algorithm")}>Algorithm</button>
      </div>
      {tab === "13f" ? <ThirteenFBrowser /> : <AlgorithmDashboard />}
    </div>
  );
}
