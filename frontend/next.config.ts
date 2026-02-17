import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/:path*`,
      },
    ];
  },
  experimental: {
    proxyClientMaxBodySize: '100MB',
  },
};

export default nextConfig;
