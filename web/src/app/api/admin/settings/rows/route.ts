import { NextResponse } from "next/server";
import { getAllSettings } from "@/lib/settings";

export async function GET() {
  try {
    return NextResponse.json(getAllSettings());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
