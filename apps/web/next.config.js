/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      // Long-running routes use app/api/* proxies (draft, agent dashboard).
      // Other /api/* still proxies to ASP.NET.
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
      {
        source: '/media-files/:path*',
        destination: 'http://localhost:5000/media-files/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
