import type { Metadata, Viewport } from "next";
import { getCurrentUser } from "@/server/auth/session";
import { preferencesOf } from "@/server/services/notifications";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnfoldAI",
  description: "Build the skills that move your life forward.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "UnfoldAI", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1020",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const theme = preferencesOf(user?.profile?.preferences).theme;
  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
