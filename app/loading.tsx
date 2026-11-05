import { LogoLoader } from "@/components/Brand";

/** Shown while a page's server data loads (every route is dynamic, so this appears on navigation). */
export default function Loading() {
  return (
    <div className="loading-delay flex min-h-dvh items-center justify-center pb-24">
      <LogoLoader size={56} />
    </div>
  );
}
