import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnfoldAI — grow one small challenge at a time",
  description: "Personalized, real-world challenges that build the skills that matter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
