/** @type {import('next').NextConfig} */
module.exports = {
  webpack: (config) => {
    // Ignore optional pino-pretty dependency from WalletConnect/wagmi
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",       value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};
