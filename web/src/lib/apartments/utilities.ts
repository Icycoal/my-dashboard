import type { UtilityEstimate } from "./types";
import { getSetting } from "@/lib/settings";

type Region = "Northeast" | "Midwest" | "South" | "West";

interface RegionBaseline {
  electricity: number;
  gas: number;
  water: number;
  sewer: number;
  trash: number;
}

const STATE_REGION: Record<string, Region> = {
  // Northeast
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast",
  RI: "Northeast", VT: "Northeast", NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  // Midwest
  IL: "Midwest", IN: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest",
  IA: "Midwest", KS: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest",
  ND: "Midwest", SD: "Midwest",
  // South
  DE: "South", FL: "South", GA: "South", MD: "South", NC: "South", SC: "South",
  VA: "South", DC: "South", WV: "South", AL: "South", KY: "South", MS: "South",
  TN: "South", AR: "South", LA: "South", OK: "South", TX: "South",
  // West
  AZ: "West", CO: "West", ID: "West", MT: "West", NV: "West", NM: "West",
  UT: "West", WY: "West", AK: "West", CA: "West", HI: "West", OR: "West", WA: "West",
};

const SIZE_SCALED = new Set(["Electricity", "Gas", "Water"]);

const FULL_STATE_TO_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

/** Pull a 2-letter state code out of a free-form US address. Returns null if not found. */
export function detectState(address: string): string | null {
  const upper = address.toUpperCase();
  // Prefer the common "City, ST 12345" pattern.
  const m = upper.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?/);
  if (m && STATE_REGION[m[1]]) return m[1];
  // Fall back to a bare ", ST" near the end.
  const m2 = upper.match(/,\s*([A-Z]{2})\b(?!.*,\s*[A-Z]{2}\b)/);
  if (m2 && STATE_REGION[m2[1]]) return m2[1];
  // Fall back to a spelled-out state name.
  const lower = address.toLowerCase();
  for (const [name, abbr] of Object.entries(FULL_STATE_TO_ABBR)) {
    if (lower.includes(name)) return abbr;
  }
  return null;
}

export function regionForState(state: string | null): Region {
  if (state && STATE_REGION[state]) return STATE_REGION[state];
  return "South"; // national-ish middle default when unknown
}

/**
 * Estimate monthly utility costs for a unit.
 * Utilities whose normalized label appears in `includedLabels` are marked included (cost 0).
 */
export function estimateUtilities(
  address: string,
  bedrooms: number,
  includedLabels: string[]
): { utilities: UtilityEstimate[]; state: string | null; region: Region } {
  const state = detectState(address);
  const region = regionForState(state);
  const baselines = getSetting<Record<Region, RegionBaseline>>("apartments.utility_baselines");
  const base = baselines[region];
  const internetMonthly = getSetting<number>("apartments.internet_monthly");
  const bedroomFactorStudio = getSetting<number>("apartments.bedroom_factor_studio");
  const bedroomFactorPerBr = getSetting<number>("apartments.bedroom_factor_per_br");
  const factor = bedrooms <= 0 ? bedroomFactorStudio : 1 + (bedrooms - 1) * bedroomFactorPerBr;
  const included = new Set(includedLabels.map((l) => l.trim()));

  const raw: { label: string; amount: number }[] = [
    { label: "Electricity", amount: base.electricity },
    { label: "Gas", amount: base.gas },
    { label: "Water", amount: base.water },
    { label: "Sewer", amount: base.sewer },
    { label: "Trash", amount: base.trash },
    { label: "Internet", amount: internetMonthly },
  ];

  const utilities: UtilityEstimate[] = raw.map(({ label, amount }) => {
    const scaled = SIZE_SCALED.has(label) ? amount * factor : amount;
    const rounded = Math.round(scaled);
    if (included.has(label)) {
      return { label, amount: 0, included: true, source: "listing-included" };
    }
    return { label, amount: rounded, included: false, source: "regional-average" };
  });

  return { utilities, state, region };
}
