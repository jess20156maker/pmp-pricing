import { currentUser, ROLES } from "@/lib/auth";
import Console from "@/components/Console";

export const dynamic = "force-dynamic";

export default function Page() {
  // No sign-in wall. Anyone who opens the link sees the price list read-only;
  // staff sign in from the header when they need to change something.
  const user = currentUser();
  return (
    <Console
      email={user?.email || ""}
      role={user?.role || ROLES.CUSTOMER}
      signedIn={!!user}
    />
  );
}
