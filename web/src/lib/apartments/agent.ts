import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Fee, ScrapeResult } from "./types";

// Fully agentic scraper powered by the Claude Agent SDK (the engine behind
// Claude Code), driving a real browser through the Playwright MCP server.
// Authenticated with your Claude Code subscription (CLAUDE_CODE_OAUTH_TOKEN)
// so model usage draws on your plan's Agent-SDK credits, not metered API.

// Model is configurable; default to Sonnet for a good cost/quality balance on
// a subscription. Set APARTMENT_AGENT_MODEL to override (e.g. claude-opus-4-8).
const MODEL = process.env.APARTMENT_AGENT_MODEL?.trim() || "claude-sonnet-4-6";
const MAX_TURNS = 60;

// Playwright MCP tools the agent is allowed to use (namespaced mcp__<server>__<tool>).
const ALLOWED_TOOLS = [
  "mcp__playwright__browser_navigate",
  "mcp__playwright__browser_navigate_back",
  "mcp__playwright__browser_click",
  "mcp__playwright__browser_type",
  "mcp__playwright__browser_select_option",
  "mcp__playwright__browser_press_key",
  "mcp__playwright__browser_snapshot",
  "mcp__playwright__browser_wait_for",
];

const SYSTEM_PROMPT = `You are an apartment-pricing research agent. You drive a real web browser (via the Playwright MCP tools) to find the TRUE total monthly cost of renting a specific unit at an apartment complex.

You are given the complex name, address, target bedroom count, and a starting URL (its leasing site). Navigate the site to find pricing, then output your findings as JSON.

Use browser_navigate to load the starting URL, browser_snapshot to read a page's accessibility tree/text, and browser_click to follow links toward "Floor Plans", "Availability", "Pricing", or "Apply". Many sites render prices via JavaScript — use browser_snapshot after navigating. Don't wander into careers/about/blog pages. A handful of navigations is usually enough.

What to find (for the lowest-priced unit of the target bedroom count; a Studio is 0 bedrooms; if the count is unavailable use the closest and note it):

- gross_rent (street rent): the standard monthly rent you would actually pay each month on the lease, BEFORE spreading out any free-month concession.
- effective_rent: the TRUE average monthly cost over the lease term after applying concessions/specials. Apartment prices are deceptive and almost always involve a deal — actively look for specials like "2 months free", "6 weeks free", "$X off", "look & lease". Compute: effective = gross × (lease_term_months − free_months) / lease_term_months. Use the lease term stated on the site; if none is stated, assume 12 months. If there is genuinely no concession, effective_rent equals gross_rent.
  - CRITICAL — do not double-count: many sites advertise a "starting at"/"from" price that ALREADY bakes in a concession (it's already a net-effective number) while ALSO showing a separate special banner. Work out which is which. If the advertised price already reflects a concession, treat it as the effective rent and back out the gross if the site states the deal; never apply the same free-month discount twice. Explain your reasoning in concession.
- concession: a short description of the specials found and the assumptions you used (lease term, months/weeks free, and whether the advertised price already included a concession). Empty string if there is no deal.
- recurring_fees: MANDATORY monthly charges on top of rent (amenity, valet trash, pest control, technology, package, required parking, common-area). Exclude optional add-ons (extra parking, storage, pet rent) — mention those in notes.
- one_time_fees: application and administrative fees (charged once, not monthly).
- included_utilities: which of [Water, Sewer, Trash, Gas, Electricity, Internet] the listing EXPLICITLY says are included in rent.

Rules:
- Only report numbers you actually saw on a page. Do not invent prices. Amounts are plain numbers (1450, not "$1,450").
- STOP as soon as you have the lowest available rent for the target bedroom count, then output your JSON. Do NOT start a rental application, sign a lease, fill out personal-info forms, or click through individual-unit selection/"Continue"/"Apply" wizards beyond what's needed to SEE the price. Seeing the advertised or available price is enough — never begin an application.
- Some sites hand off to a third-party leasing portal (e.g. RealPage, Entrata). The availability/pricing list there usually shows the rent for each unit — read it and report the lowest for the target bedrooms; do not proceed past it.
- You have a limited number of steps. Work efficiently, and if you are running low, output your JSON immediately with whatever you have found so far (status "partial" if unsure).
- If after a reasonable effort you cannot find a real rent (bot wall, no online pricing, dead site), set gross_rent and effective_rent to null and status to "partial", explaining what blocked you in notes.

When finished, respond with ONLY a single JSON object — no prose, no markdown code fences — of EXACTLY this shape:
{"gross_rent": number|null, "effective_rent": number|null, "concession": string, "recurring_fees": [{"label": string, "amount": number}], "one_time_fees": [{"label": string, "amount": number}], "included_utilities": string[], "status": "ok"|"partial", "notes": string}`;

function toFees(raw: unknown, recurring: boolean): Fee[] {
  if (!Array.isArray(raw)) return [];
  const out: Fee[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const label = String((item as Record<string, unknown>).label ?? "").trim();
      const amount = Number((item as Record<string, unknown>).amount);
      if (label && Number.isFinite(amount)) out.push({ label, amount, recurring });
    }
  }
  return out;
}

/** Pull the final JSON object out of the agent's last text response. */
function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const o = input as Record<string, unknown>;
  const v = o.url ?? o.element ?? o.ref ?? o.text ?? "";
  return v ? ` ${String(v).slice(0, 80)}` : "";
}

export async function scrapeComplex(
  startUrl: string,
  bedrooms: number,
  ctx?: { name?: string; address?: string }
): Promise<ScrapeResult> {
  const log: string[] = [];

  const hasOauth = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  if (!hasOauth && !hasApiKey) {
    log.push(
      "No credentials. Run `claude setup-token` and set CLAUDE_CODE_OAUTH_TOKEN in web/.env.local to use your Claude Code subscription."
    );
    return { baseRent: null, grossRent: null, concession: "", fees: [], oneTimeFees: [], includedUtilityLabels: [], status: "failed", log };
  }

  // Force subscription auth: if an API key is present it would take precedence
  // (and bill per-token), so strip it from the child env when a token exists.
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  if (hasOauth) {
    delete childEnv.ANTHROPIC_API_KEY;
    log.push(`Using Claude Code subscription auth · model ${MODEL}.`);
  } else {
    log.push(`No subscription token found; falling back to metered ANTHROPIC_API_KEY · model ${MODEL}.`);
  }

  const bedLabel = bedrooms === 0 ? "Studio (0 bedroom)" : `${bedrooms}-bedroom`;
  const prompt =
    `Complex: ${ctx?.name ?? "(unknown)"}\n` +
    `Address: ${ctx?.address ?? "(unknown)"}\n` +
    `Target unit: ${bedLabel}\n` +
    `Starting URL: ${startUrl}\n\n` +
    `Find the total monthly cost and output the JSON described in your instructions.`;

  let finalText = "";

  try {
    const response = query({
      prompt,
      options: {
        model: MODEL,
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: MAX_TURNS,
        permissionMode: "bypassPermissions",
        allowedTools: ALLOWED_TOOLS,
        mcpServers: {
          playwright: {
            type: "stdio",
            command: "npx",
            args: ["@playwright/mcp@latest", "--headless", "--isolated"],
          },
        },
        env: childEnv,
        cwd: process.cwd(),
      },
    });

    for await (const message of response) {
      const m = message as unknown as Record<string, unknown>;
      if (m.type === "assistant") {
        const inner = (m.message as { content?: unknown[] } | undefined)?.content;
        if (Array.isArray(inner)) {
          for (const block of inner) {
            const b = block as Record<string, unknown>;
            if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
              finalText = b.text;
            } else if (b.type === "tool_use" && typeof b.name === "string") {
              const short = b.name.replace(/^mcp__playwright__/, "");
              log.push(`→ ${short}${summarizeInput(b.input)}`);
            }
          }
        }
      } else if (m.type === "result") {
        if (typeof m.result === "string" && m.result.trim()) finalText = m.result;
        if (m.is_error) log.push(`Agent run reported an error (${String(m.subtype ?? "unknown")}).`);
      }
    }
  } catch (err) {
    log.push(`Agent error: ${(err as Error).message}`);
  }

  const parsed = extractJson(finalText);
  if (!parsed) {
    log.push("Could not parse the agent's final JSON output.");
    if (finalText) log.push(`Final response: ${finalText.slice(0, 300)}`);
    return { baseRent: null, grossRent: null, concession: "", fees: [], oneTimeFees: [], includedUtilityLabels: [], status: "partial", log };
  }

  const num = (v: unknown): number | null =>
    v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const grossRent = num(parsed.gross_rent);
  // baseRent carries the EFFECTIVE rent (after concessions); fall back to gross.
  const baseRent = num(parsed.effective_rent) ?? grossRent;
  const concession = typeof parsed.concession === "string" ? parsed.concession.trim() : "";
  const fees = toFees(parsed.recurring_fees, true);
  const oneTimeFees = toFees(parsed.one_time_fees, false);
  const includedUtilityLabels = Array.isArray(parsed.included_utilities)
    ? (parsed.included_utilities as unknown[]).map((u) => String(u))
    : [];
  const status: ScrapeResult["status"] =
    parsed.status === "ok" || (parsed.status == null && baseRent !== null) ? "ok" : "partial";

  if (typeof parsed.notes === "string" && parsed.notes.trim()) log.push(`Agent notes: ${parsed.notes.trim()}`);
  log.push(
    `Agent reported: street rent ${grossRent ?? "—"}, effective ${baseRent ?? "—"}${concession ? ` (${concession})` : ""}, ${fees.length} recurring fee(s), ${oneTimeFees.length} one-time fee(s), included: ${includedUtilityLabels.join(", ") || "none"}.`
  );

  return { baseRent, grossRent, concession, fees, oneTimeFees, includedUtilityLabels, status, log };
}
