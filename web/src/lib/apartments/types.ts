// Shared domain types for Apartment Hunter.

/** A recurring or one-time charge on top of base rent (admin, amenity, trash, pest, etc.). */
export interface Fee {
  label: string;
  amount: number; // dollars
  recurring: boolean; // true = charged every month, false = one-time (app/admin)
}

/** A utility line item. Either included in rent (added cost 0) or estimated from regional averages. */
export interface UtilityEstimate {
  label: string; // Electricity, Water, Gas, Sewer, Trash, Internet
  amount: number; // monthly dollars (0 when included)
  included: boolean; // included in rent per the listing
  source: "regional-average" | "listing-included" | "user";
}

export type ScrapeStatus = "pending" | "ok" | "partial" | "failed";

export interface Complex {
  id: number;
  name: string;
  address: string;
  url: string;
  bedrooms: number;
  baseRent: number | null; // EFFECTIVE monthly rent (after concessions) — used in the total
  grossRent: number | null; // standard/"street" monthly rent before concessions
  concession: string; // description of any specials/concessions + assumptions used
  fees: Fee[]; // monthly mandatory fees
  oneTimeFees: Fee[]; // app/admin one-time fees (informational)
  utilities: UtilityEstimate[];
  monthlyTotal: number; // effective rent + recurring fees + non-included utilities
  notes: string;
  scrapeStatus: ScrapeStatus;
  scrapeLog: string[]; // human-readable trace of what the scraper did
  createdAt: string;
  updatedAt: string;
}

/** Payload accepted when adding a complex. */
export interface NewComplexInput {
  name: string;
  address: string;
  url: string;
  bedrooms: number;
  notes?: string;
}

/** What the scraper returns to the API route. */
export interface ScrapeResult {
  baseRent: number | null; // effective rent (after concessions) — drives the total
  grossRent: number | null; // street rent before concessions
  concession: string; // human-readable deal description + assumptions
  fees: Fee[];
  oneTimeFees: Fee[];
  includedUtilityLabels: string[]; // normalized labels (Water, Trash, ...) the listing says are included
  status: ScrapeStatus;
  log: string[];
}
