import { NextResponse } from "next/server";
import { currentUser, isStaffEmail, approverEmails, isApproverEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Answers "why am I not an approver?" without exposing the approver list to
// whoever happens to be signed in.
export async function GET() {
  const user = currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const onList = isApproverEmail(user.email);
  const count = approverEmails().length;

  return NextResponse.json({
    yourEmail: user.email,
    yourRole: user.role,
    onStaffDomain: isStaffEmail(user.email),
    approverEmailsConfigured: count,
    yourEmailIsOnTheApproverList: onList,
    diagnosis: onList
      ? "You are an approver."
      : count === 0
        ? "APPROVER_EMAILS is empty or not set on this deployment. Set it in Vercel, then redeploy — environment variables only take effect on a new build."
        : `APPROVER_EMAILS has ${count} address(es), but yours is not among them. Check for a typo, and that you signed in with exactly the address on the list.`,
  });
}
