import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

/** The app opens straight into Today (or login) — no website landing page. */
export default async function Home() {
  redirect((await getCurrentUser()) ? "/dashboard" : "/login");
}
