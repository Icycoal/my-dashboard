import type { ScrapeResult, UtilityEstimate, Fee } from "./types";
import { estimateUtilities } from "./utilities";

export interface Computed {
  baseRent: number | null;
  grossRent: number | null;
  concession: string;
  fees: Fee[];
  oneTimeFees: Fee[];
  utilities: UtilityEstimate[];
  monthlyTotal: number;
  log: string[];
}

/**
 * Combine a scrape result with regional utility estimates into the final
 * monthly total = EFFECTIVE rent (after concessions) + recurring fees + utilities
 * not included in rent. One-time fees (application/admin) are tracked but
 * excluded from the monthly total.
 */
export function computeTotals(
  address: string,
  bedrooms: number,
  scrape: ScrapeResult
): Computed {
  const { utilities, state, region } = estimateUtilities(
    address,
    bedrooms,
    scrape.includedUtilityLabels
  );

  const recurringFees = scrape.fees.reduce((s, f) => s + f.amount, 0);
  const utilCost = utilities.reduce((s, u) => s + u.amount, 0);
  const effective = scrape.baseRent ?? 0; // baseRent carries the EFFECTIVE rent
  const monthlyTotal = Math.round(effective + recurringFees + utilCost);

  const log = [...scrape.log];
  if (scrape.grossRent != null && scrape.grossRent !== scrape.baseRent) {
    log.push(
      `Concession applied: street rent $${scrape.grossRent} → effective $${scrape.baseRent}/mo${scrape.concession ? ` (${scrape.concession})` : ""}.`
    );
  }
  log.push(
    `Utilities estimated for ${state ?? "unknown state"} (${region} region), ${bedrooms}BR: $${utilCost}/mo.`
  );
  log.push(
    `Monthly total = effective rent $${effective} + recurring fees $${recurringFees} + utilities $${utilCost} = $${monthlyTotal}.`
  );

  return {
    baseRent: scrape.baseRent,
    grossRent: scrape.grossRent,
    concession: scrape.concession,
    fees: scrape.fees,
    oneTimeFees: scrape.oneTimeFees,
    utilities,
    monthlyTotal,
    log,
  };
}
