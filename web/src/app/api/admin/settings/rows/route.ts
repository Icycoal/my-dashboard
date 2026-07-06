import { NextResponse } from "next/server";
import { getAllSettings } from "@/lib/settings";
import { verifyAuth, unauthorized } from "@/lib/serverAuth";

export async function GET(req: Request) {
  if (!verifyAuth(req)) return unauthorized();
  try {
    return NextResponse.json(getAllSettings());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
