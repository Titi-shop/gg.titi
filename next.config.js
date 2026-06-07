/** @type {import('next').NextConfig} */

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,

    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",

        headers: [
          {
            key: "Content-Security-Policy",

            value: [
              // base
              "default-src 'self' https: data: blob:;",

              // PI SDK cần rất mở
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob: data:;",

              // API / websocket / pi
              "connect-src * https: wss: ws: data: blob:;",

              // images
              "img-src * data: blob: https:;",

              // css
              "style-src 'self' 'unsafe-inline' https:;",

              // iframe payment pi browser
              "frame-src * https: data: blob:;",

              // fonts
              "font-src * data: https:;",

              // media
              "media-src * blob: data: https:;",
            ].join(" "),
          },

          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
