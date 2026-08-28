import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { canRequest, ROLES } from "@/lib/auth";
import { createRequest, listRequests, getSites } from "@/lib/airtable";
import { PRICE_FIELDS } from "@/lib/fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Staff see the pending queue. Customers never do.
export async function GET() {
  const user = currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canRequest(user.role)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  try {
    return NextResponse.json({ requests: await listRequests({ status: "Pending" }) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Raise a request. Writes nothing to the Websites table.
export async function POST(req) {
  const user = currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canRequest(user.role)) {
    return NextResponse.json({ error: "Only staff can request price changes" }, { status: 403 });
  }

  const { recordId, fieldKey, value } = await req.json().catch(() => ({}));

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
    const rows = await getSites();
    const row = rows.find((r) => r.id === recordId);
    if (!row) return NextResponse.json({ error: "Unknown website record" }, { status: 400 });

    // Sales only ever see allocation sites, so they must not be able to raise a
    // request against one they were never sent by crafting the record id.
    if (user.role !== ROLES.APPROVER && !row.allocation) {
      return NextResponse.json({ error: "That site is not on the sales list" }, { status: 403 });
    }

    const oldValue = row.prices[field.key] ?? null;
    if (oldValue === clean) return NextResponse.json({ ok: true, unchanged: true });

    const id = await createRequest({ row, field, oldValue, value: clean, user: user.email });
    return NextResponse.json({ ok: true, id, pending: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
