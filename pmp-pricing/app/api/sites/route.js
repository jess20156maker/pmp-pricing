import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getSites } from "@/lib/airtable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!currentUser()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    const rows = await getSites({ force });
    return NextResponse.json({ rows, count: rows.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
