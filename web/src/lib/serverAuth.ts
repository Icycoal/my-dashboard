import crypto from "node:crypto";
import { NextResponse } from "next/server";

// Verifies the Vapor backend's HS256 JWT (payload { sub: userId, exp }).
// The secret is shared via HEALTH_JWT_SECRET — start.sh exports backend/.env
// into both processes. The fallback matches the backend's dev fallback.
const SECRET = () => process.env.HEALTH_JWT_SECRET ?? "dev-only-change-me";

/** Returns the authenticated user id, or null if the token is missing/invalid. */
export function verifyAuth(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const [h, p, sig] = header.slice(7).trim().split(".");
  if (!h || !p || !sig) return null;
  try {
    const alg = (JSON.parse(Buffer.from(h, "base64url").toString()) as { alg?: string }).alg;
    if (alg !== "HS256") return null;
    const expected = crypto.createHmac("sha256", SECRET()).update(`${h}.${p}`).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString()) as { sub?: string; exp?: number };
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
