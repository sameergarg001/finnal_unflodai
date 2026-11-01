import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnfoldAI",
  description: "Your daily mentor for real-world skills.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "UnfoldAI", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-slate-100 font-sans">{children}</body>
    </html>
  );
}
