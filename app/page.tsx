import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath } from "@/server/auth/session";

/** The app opens straight into Home (or the welcome screen) — no website landing page. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? (onboardingPath(user) ?? "/dashboard") : "/welcome");
}
