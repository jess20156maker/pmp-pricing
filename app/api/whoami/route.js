import { NextResponse } from "next/server";
import {
  currentUser, isStaffEmail, approverEmails, isApproverEmail, canApprove,
} from "@/lib/auth";
import { ROLES } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Answers "why am I not an approver?" against what the running deployment
// actually sees, which is the only thing that matters — Vercel masks the value
// once saved, so reading it back in the dashboard is not possible.
export async function GET() {
  const user = currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const list = approverEmails();
  const onList = isApproverEmail(user.email);

  const body = {
    yourEmail: user.email,
    yourRole: user.role,
    onStaffDomain: isStaffEmail(user.email),
    approverEmailsConfigured: list.length,
    yourEmailIsOnTheApproverList: onList,
    diagnosis: onList
      ? "You are an approver."
      : list.length === 0
        ? "APPROVER_EMAILS is empty or not set on this deployment. Set it in Vercel, then redeploy — environment variables only take effect on a new build."
        : `APPROVER_EMAILS has ${list.length} address(es), but yours is not among them. Check for a typo, and that you signed in with exactly the address on the list.`,
  };

  // Only an approver sees the actual list. Everyone else gets the count, so
  // this cannot be used to enumerate who can approve prices.
  if (canApprove(user.role)) body.approverEmails = list;

  // A staff member who is not an approver still gets a masked view, enough to
  // spot a typo in their own address without revealing anyone else's.
  if (!onList && user.role === ROLES.SALES) {
    body.approverEmailsMasked = list.map((e) => {
      const [name, domain] = e.split("@");
      return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
    });
  }

  return NextResponse.json(body);
}
