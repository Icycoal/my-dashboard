"use client";

import { Fragment, useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import type { Complex } from "@/lib/apartments/types";
import { btnPrimary, cardPad, input, pageSubtitle, pageTitle } from "@/lib/ui";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;

const STATUS_STYLE: Record<string, string> = {
  ok: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  partial: "border border-amber-500/20 bg-amber-500/10 text-amber-400",
  failed: "border border-red-500/20 bg-red-500/10 text-red-400",
  pending: "border border-white/[0.08] bg-white/5 text-gray-400",
};

const emptyForm = { name: "", address: "", url: "", bedrooms: "1", manualBaseRent: "", notes: "" };

const inputCls = `${input} w-full`;

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-400">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Inner() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/apartments");
    const data = await res.json();
    setComplexes(data.complexes ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          url: form.url,
          bedrooms: Number(form.bedrooms),
          notes: form.notes,
          manualBaseRent: form.manualBaseRent ? Number(form.manualBaseRent) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setForm({ ...emptyForm });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function rescrape(id: number) {
    setBusyId(id);
    try {
      await fetch(`/api/apartments/${id}`, { method: "POST" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this complex?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/apartments/${id}`, { method: "DELETE" });
      if (expanded === id) setExpanded(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const cheapest = complexes.length
    ? Math.min(...complexes.filter((c) => c.monthlyTotal > 0).map((c) => c.monthlyTotal))
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className={pageTitle}>Apartments</h1>
        <p className={pageSubtitle}>
          The real monthly cost — base rent + mandatory fees + estimated utilities not included in rent.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className={`${cardPad} grid grid-cols-1 gap-3 sm:grid-cols-2`}>
        <Field label="Complex name" required>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="The Maple Apartments"
            required
          />
        </Field>
        <Field label="Address" required>
          <input
            className={inputCls}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="123 Main St, Austin, TX 78701"
            required
          />
        </Field>
        <Field label="Listing URL" required>
          <input
            className={inputCls}
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://themapleapts.com"
            type="url"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedrooms">
            <select
              className={inputCls}
              value={form.bedrooms}
              onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
            >
              <option value="0">Studio</option>
              <option value="1">1 bed</option>
              <option value="2">2 bed</option>
              <option value="3">3 bed</option>
              <option value="4">4 bed</option>
            </select>
          </Field>
          <Field label="Base rent override">
            <input
              className={inputCls}
              value={form.manualBaseRent}
              onChange={(e) => setForm({ ...form, manualBaseRent: e.target.value })}
              placeholder="optional $"
              inputMode="numeric"
            />
          </Field>
        </div>
        <Field label="Notes" className="sm:col-span-2">
          <input
            className={inputCls}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Pet friendly, near train…"
          />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting ? "Scraping… (this can take ~30s)" : "Add & calculate total"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </form>

      {/* Results */}
      {complexes.length === 0 ? (
        <p className="text-sm text-gray-500">No complexes yet. Add one above to compare total costs.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/60 shadow">
          <table className="w-full text-sm">
            <thead className="bg-gray-950/50 text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
              <tr>
                <th className="px-4 py-3">Complex</th>
                <th className="px-4 py-3 text-right">Rent (eff.)</th>
                <th className="px-4 py-3 text-right">Fees/mo</th>
                <th className="px-4 py-3 text-right">Utilities/mo</th>
                <th className="px-4 py-3 text-right">Total/mo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {complexes.map((c) => {
                const feeSum = c.fees.reduce((s, f) => s + f.amount, 0);
                const utilSum = c.utilities.reduce((s, u) => s + u.amount, 0);
                const isBest = cheapest != null && c.monthlyTotal === cheapest && c.monthlyTotal > 0;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                          className="text-left font-medium text-gray-100 hover:text-blue-400"
                        >
                          {c.name}
                        </button>
                        <div className="text-xs text-gray-500">{c.address}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[c.scrapeStatus]}`}>
                            {c.scrapeStatus}
                          </span>
                          {isBest && (
                            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                              cheapest
                            </span>
                          )}
                          {c.grossRent != null && c.grossRent !== c.baseRent && (
                            <span
                              className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                              title={c.concession}
                            >
                              deal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                        {money(c.baseRent)}
                        {c.grossRent != null && c.grossRent !== c.baseRent && (
                          <div className="text-[10px] text-gray-500 line-through">{money(c.grossRent)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-300">{money(feeSum)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-300">{money(utilSum)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-100">{money(c.monthlyTotal)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3 text-xs">
                          <button
                            onClick={() => rescrape(c.id)}
                            disabled={busyId === c.id}
                            className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                          >
                            {busyId === c.id ? "…" : "rescan"}
                          </button>
                          <button
                            onClick={() => remove(c.id)}
                            disabled={busyId === c.id}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === c.id && (
                      <tr className="border-t border-white/[0.05] bg-gray-950/40">
                        <td colSpan={6} className="px-4 py-4">
                          <Breakdown complex={c} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-600">
        Utilities are regional estimates, not live bills. Scraping is best-effort across varied leasing
        sites — point at a specific property&apos;s leasing page (not a city hub), and use &ldquo;rescan&rdquo;,
        the base-rent override, and the scrape log to verify each number.
      </p>
    </div>
  );
}

function Breakdown({ complex: c }: { complex: Complex }) {
  const hasDeal = c.grossRent != null && c.grossRent !== c.baseRent;
  return (
    <div className="space-y-4">
      {(hasDeal || c.concession) && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2 text-xs text-emerald-200">
          <span className="font-medium">Rent:</span>{" "}
          {hasDeal ? (
            <>
              street {money(c.grossRent)}/mo → <span className="font-semibold">effective {money(c.baseRent)}/mo</span> after concession
            </>
          ) : (
            <>effective {money(c.baseRent)}/mo</>
          )}
          {c.concession && <div className="mt-1 text-emerald-300/80">{c.concession}</div>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 text-gray-300 md:grid-cols-3">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Recurring fees</h4>
        {c.fees.length ? (
          <ul className="space-y-1">
            {c.fees.map((f, i) => (
              <li key={i} className="flex justify-between">
                <span>{f.label}</span>
                <span className="tabular-nums">{money(f.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">None detected</p>
        )}
        {c.oneTimeFees.length > 0 && (
          <>
            <h4 className="mb-1 mt-3 text-xs font-semibold uppercase text-gray-500">One-time fees</h4>
            <ul className="space-y-1 text-gray-500">
              {c.oneTimeFees.map((f, i) => (
                <li key={i} className="flex justify-between">
                  <span>{f.label}</span>
                  <span className="tabular-nums">{money(f.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Utilities (est.)</h4>
        <ul className="space-y-1">
          {c.utilities.map((u, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {u.label}
                {u.included && <span className="ml-1 text-green-400">incl.</span>}
              </span>
              <span className="tabular-nums">{u.included ? "$0" : money(u.amount)}</span>
            </li>
          ))}
        </ul>
        {c.notes && <p className="mt-3 text-xs text-gray-500">📝 {c.notes}</p>}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Scrape log</h4>
        <ol className="space-y-1 text-xs text-gray-500">
          {c.scrapeLog.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ol>
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
        >
          open listing ↗
        </a>
      </div>
      </div>
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
