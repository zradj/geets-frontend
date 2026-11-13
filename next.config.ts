import type { NextConfig } from 'next';

// Static export: the production site is plain files served by Caddy.
// There is no Node.js server to attack or to keep logs.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
