"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { passwordLogin } from "@/lib/api";
import { btnPrimary, card, input } from "@/lib/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await passwordLogin(password);
      router.push("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 shadow-glow">
            <svg viewBox="0 0 16 16" fill="none" className="h-6 w-6 text-white" aria-hidden>
              <path
                d="M2 9.5 6 5l3 3 5-5.5M14 2.5v4h-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold tracking-tight text-gray-50">
              My Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">Health, finances, and everything between.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className={`${card} space-y-4 p-6`}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            className={`${input} w-full`}
          />
          {err && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {err}
            </div>
          )}
          <button disabled={loading} className={`${btnPrimary} w-full`}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
