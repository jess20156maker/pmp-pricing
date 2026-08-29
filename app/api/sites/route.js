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
  // Readable without signing in. Anyone not signed in is treated as a customer
  // and gets exactly what a customer gets — nothing more leaves the server.
  const user = currentUser();
  const role = user?.role || ROLES.CUSTOMER;

  const force = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    const rows = await getSites({ force });

    // "PMP Agency Allocation Sales List" is the sellable inventory. Customers
    // and sales only ever receive those sites; an approver sees everything so
    // they can still price a site outside the allocation.
    const visible = role === ROLES.APPROVER
      ? rows
      : rows.filter((r) => !!r.allocation);

    if (role === ROLES.CUSTOMER) {
      // Only the columns below leave the server for a customer.
      const safe = visible.map(forCustomer);
      return NextResponse.json({ rows: safe, count: safe.length, role });
    }

    return NextResponse.json({ rows: visible, count: visible.length, role });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
