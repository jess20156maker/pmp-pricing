import { currentUser } from "@/lib/auth";
import Login from "@/components/Login";
import Console from "@/components/Console";

export const dynamic = "force-dynamic";

export default function Page() {
  const user = currentUser();
  if (!user) return <Login />;
  // Vercel sets this on every deployment. Shown in the header so it is obvious
  // at a glance which build is actually live.
  const build = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);
  return <Console email={user.email} role={user.role} build={build} />;
}
