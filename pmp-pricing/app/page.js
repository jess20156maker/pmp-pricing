import { currentUser } from "@/lib/auth";
import Login from "@/components/Login";
import Console from "@/components/Console";

export const dynamic = "force-dynamic";

export default function Page() {
  const user = currentUser();
  if (!user) return <Login />;
  return <Console email={user.email} />;
}
