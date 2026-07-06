import { NextResponse, type NextRequest } from "next/server";
import { verifyAuth, unauthorized } from "@/lib/serverAuth";
import { listComplexes, insertComplex, updateComplexComputed } from "@/lib/apartments/db";
import { scrapeComplex } from "@/lib/apartments/agent";
import { computeTotals } from "@/lib/apartments/compute";

// Playwright + better-sqlite3 require the Node.js runtime, and scraping is slow.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return unauthorized();
  return NextResponse.json({ complexes: listComplexes() });
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, address, url, bedrooms, notes, manualBaseRent } = (body ??
    {}) as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof address !== "string" || !address.trim()) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "url must start with http:// or https://" },
      { status: 400 }
    );
  }

  const beds = Number.isFinite(Number(bedrooms)) ? Math.max(0, Math.trunc(Number(bedrooms))) : 1;
  const override =
    manualBaseRent != null && Number.isFinite(Number(manualBaseRent))
      ? Number(manualBaseRent)
      : null;

  // 1. Persist the complex immediately (status: pending).
  const created = insertComplex({
    name: name.trim(),
    address: address.trim(),
    url: url.trim(),
    bedrooms: beds,
    notes: typeof notes === "string" ? notes : "",
  });

  // 2. Scrape the leasing site, then compute the total.
  const scrape = await scrapeComplex(created.url, beds, {
    name: created.name,
    address: created.address,
  });
  if (override !== null) {
    scrape.baseRent = override;
    scrape.status = scrape.status === "failed" ? "partial" : scrape.status;
    scrape.log.push(`Base rent manually overridden to $${override}.`);
  }
  const computed = computeTotals(created.address, beds, scrape);

  const updated = updateComplexComputed(created.id, {
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

  return NextResponse.json({ complex: updated }, { status: 201 });
}
