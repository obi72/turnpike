import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ["app.trnpk.net"] } },
};

export default config;
