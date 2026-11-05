import type { Metadata, Viewport } from "next";
import { getCurrentUser } from "@/server/auth/session";
import { preferencesOf } from "@/server/services/notifications";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const head = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-head", weight: ["500", "600", "700", "800"] });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "UnfoldAI",
  description: "Build the skills that move your life forward.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "UnfoldAI", statusBarStyle: "default" },
  // Favicon and Apple icon come from app/icon.svg and app/apple-icon.png (file conventions).
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1129" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const theme = preferencesOf(user?.profile?.preferences).theme;
  return (
    <html lang="en" data-theme={theme} className={`${head.variable} ${body.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
