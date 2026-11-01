import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Allow opening the dev server from a phone on the same Wi-Fi (e.g. http://10.x.x.x:3000).
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/me", destination: "/profile", permanent: false },
      { source: "/progress", destination: "/reports", permanent: false },
    ];
  },
};

export default nextConfig;
