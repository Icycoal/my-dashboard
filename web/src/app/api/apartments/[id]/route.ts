import { NextResponse, type NextRequest } from "next/server";
import { getComplex, deleteComplex, updateComplexComputed } from "@/lib/apartments/db";
import { scrapeComplex } from "@/lib/apartments/agent";
import { computeTotals } from "@/lib/apartments/compute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteComplex(Number(id));
  return NextResponse.json({ ok: true });
}

// Re-scrape an existing complex. Optional JSON body { manualBaseRent } overrides rent.
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const complex = getComplex(Number(id));
  if (!complex) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let override: number | null = null;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body?.manualBaseRent != null && Number.isFinite(Number(body.manualBaseRent))) {
      override = Number(body.manualBaseRent);
    }
  } catch {
    /* no body is fine */
  }

  const scrape = await scrapeComplex(complex.url, complex.bedrooms, {
    name: complex.name,
    address: complex.address,
  });
  if (override !== null) {
    scrape.baseRent = override;
    scrape.status = scrape.status === "failed" ? "partial" : scrape.status;
    scrape.log.push(`Base rent manually overridden to $${override}.`);
  }
  const computed = computeTotals(complex.address, complex.bedrooms, scrape);

  const updated = updateComplexComputed(complex.id, {
    baseRent: computed.baseRent,
    grossRent: computed.grossRent,
    concession: computed.concession,
    fees: computed.fees,
    oneTimeFees: computed.oneTimeFees,
    utilities: computed.utilities,
    monthlyTotal: computed.monthlyTotal,
    scrapeStatus: scrape.status,
    scrapeLog: computed.log,
  });

  return NextResponse.json({ complex: updated });
}
