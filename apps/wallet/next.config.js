/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: [
    "@coinbase/cdp-core",
    "@coinbase/cdp-hooks",
    "@coinbase/cdp-react",
    "x402",
  ],
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
