import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { updatePrice } from "@/lib/airtable";
import { PRICE_FIELDS } from "@/lib/fields";

export const runtime = "nodejs";

export async function POST(req) {
  // Identity comes from the signed session cookie — never from the request body.
  // The browser cannot claim to be someone else.
  const user = currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { recordId, fieldKey, value } = await req.json().catch(() => ({}));

  // Only ever write a field from the allowlist. This is what stops the app
  // touching scripts, attachments or anything else on Websites.
  const field = PRICE_FIELDS.find((f) => f.key === fieldKey);
  if (!field) return NextResponse.json({ error: "That field is not editable" }, { status: 400 });
  if (!recordId || typeof recordId !== "string") {
    return NextResponse.json({ error: "Missing record" }, { status: 400 });
  }

  let clean = null;
  if (value !== null && value !== "" && value !== undefined) {
    const n = Number(String(value).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n)) return NextResponse.json({ error: "Not a number" }, { status: 400 });
    if (n < 0) return NextResponse.json({ error: "Price can't be negative" }, { status: 400 });
    clean = Math.round(n * 100) / 100;
  }

  try {
    const result = await updatePrice({ recordId, field, value: clean, user: user.email });
    return NextResponse.json({ ok: true, value: clean, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
