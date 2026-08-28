import { NextResponse } from "next/server";
import { currentUser, ROLES } from "@/lib/auth";
import { getSites } from "@/lib/airtable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What a customer is allowed to receive. Anything not listed here never leaves
// the server, so hiding a column is not merely a UI decision.
const CUSTOMER_FIELDS = ["id", "website", "siteName", "dr", "niche", "fullUrl", "prices"];

function forCustomer(row) {
  const out = {};
  for (const k of CUSTOMER_FIELDS) out[k] = row[k];
  return out;
}

export async function GET(req) {
  const user = currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const force = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    const rows = await getSites({ force });

    if (user.role === ROLES.CUSTOMER) {
      // Customers only ever see sites explicitly marked sellable, whatever
      // SELLABLE_ONLY is set to for staff.
      const visible = rows.filter((r) => r.sellable === "Yes").map(forCustomer);
      return NextResponse.json({ rows: visible, count: visible.length, role: user.role });
    }

    return NextResponse.json({ rows, count: rows.length, role: user.role });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
