import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No `output: "standalone"` — Vercel builds and hosts the app natively, so the
  // standalone bundle is only needed for self-hosting (Docker/Node). Add it then.
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
