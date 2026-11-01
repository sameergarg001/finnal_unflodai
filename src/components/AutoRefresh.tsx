"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the page every few seconds while background work (AI analysis) finishes. */
export function AutoRefresh({ everyMs = 3000, children }: { everyMs?: number; children?: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return <>{children}</>;
}
