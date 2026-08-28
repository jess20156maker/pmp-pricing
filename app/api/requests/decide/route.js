import { NextResponse } from "next/server";
import { currentUser, canApprove } from "@/lib/auth";
import { getRequest, markRequest, updatePrice } from "@/lib/airtable";
import { PRICE_FIELDS } from "@/lib/fields";

export const runtime = "nodejs";

export async function POST(req) {
  const user = currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canApprove(user.role)) {
    return NextResponse.json({ error: "Only an approver can decide requests" }, { status: 403 });
  }

  const { id, decision, note } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing request" }, { status: 400 });
  }
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "Decision must be approve or reject" }, { status: 400 });
  }

  try {
    const reqRow = await getRequest(id);
    if (!reqRow) {
      return NextResponse.json({ error: "That request no longer exists" }, { status: 404 });
    }

    // Deciding twice would apply the price twice and overwrite the first decision.
    if (reqRow.status !== "Pending") {
      return NextResponse.json(
        { error: `That request was already ${reqRow.status.toLowerCase()}` },
        { status: 409 }
      );
    }

    if (decision === "reject") {
      await markRequest(id, { status: "Rejected", user: user.email, note });
      return NextResponse.json({ ok: true, status: "Rejected" });
    }

    const field = PRICE_FIELDS.find((f) => f.key === reqRow.fieldKey);
    if (!field) return NextResponse.json({ error: "That field is not editable" }, { status: 400 });

    const value = reqRow.newValue === "" ? null : Number(reqRow.newValue);
    if (value !== null && !Number.isFinite(value)) {
      return NextResponse.json({ error: "Requested value is not a number" }, { status: 400 });
    }

    // Apply first. Marking it approved when the write failed would lose the request.
    await updatePrice({ recordId: reqRow.recordId, field, value, user: reqRow.requestedBy });
    await markRequest(id, { status: "Approved", user: user.email, note });

    return NextResponse.json({ ok: true, status: "Approved", value });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
