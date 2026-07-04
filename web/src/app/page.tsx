"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { dashboardSummary } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";
import { card, cardPad, listCard, pageSubtitle, pageTitle, sectionLabel } from "@/lib/ui";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`${cardPad} transition-colors hover:border-white/10`}>
      <div className="flex items-center justify-between">
        <p className={sectionLabel}>{title}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
          {icon}
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums text-gray-50">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 rounded-lg bg-white/5" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-white/5" />
    </div>
  );
}

function Inner() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    dashboardSummary().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="text-sm text-red-400">{err}</div>;
  if (!data) return <Skeleton />;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className={pageTitle}>{greeting()}</h1>
        <p className={pageSubtitle}>{today}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          title="Calories"
          value={`${Math.round(data.todayCalories)}`}
          sub="kcal logged today"
          icon={
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path
                d="M8 1.5c.5 2.5-2.5 3.5-2.5 6a2.5 2.5 0 0 0 5 0c0-.8-.3-1.5-.7-2.1C11.5 6 13 7.6 13 10a5 5 0 0 1-10 0c0-4 4.5-5.5 5-8.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <StatCard
          title="Protein"
          value={`${Math.round(data.todayProteinG)}g`}
          sub="logged today"
          icon={
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path
                d="M5 11 11 5M3.5 9.5 2 11l3 3 1.5-1.5M12.5 6.5 14 5l-3-3-1.5 1.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
        <StatCard
          title="Latest Weight"
          value={data.latestWeightLbs ? `${data.latestWeightLbs} lbs` : "—"}
          sub={
            data.latestWeightDate
              ? new Date(data.latestWeightDate).toLocaleDateString()
              : undefined
          }
          icon={
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path
                d="M2 9.5 6 5l3 3 5-5.5M14 2.5v4h-4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </div>

      <section>
        <h2 className={`${sectionLabel} mb-3`}>Recent Workouts</h2>
        {data.recentWorkouts.length === 0 ? (
          <div className={`${card} px-5 py-8 text-center text-sm text-gray-500`}>
            No workouts yet.
          </div>
        ) : (
          <div className={listCard}>
            {data.recentWorkouts.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-4 transition-colors hover:bg-white/[0.02]"
              >
                <div>
                  <div className="font-medium text-gray-100">{w.name ?? "Workout"}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {new Date(w.startedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm tabular-nums text-gray-400">
                  {w.exerciseCount} exercises
                  {w.durationMinutes ? ` · ${w.durationMinutes} min` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <Inner />
    </AuthGuard>
  );
}
