/** @type {import('next').NextConfig} */
module.exports = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Robots-Tag",         value: "noindex" },
        { key: "X-Frame-Options",       value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
};
