
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Explicitly allow development workstation origins for cross-origin HMR and server actions
  allowedDevOrigins: [
    "*.cloudworkstations.dev",
    "*.firebaseapp.com",
    "*.web.app",
    "*.c9users.io"
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: [
        "*.cloudworkstations.dev",
        "localhost:3000",
        "localhost:9002",
        "*.firebaseapp.com",
        "*.web.app",
        "*.c9users.io"
      ],
    },
  },
};

export default nextConfig;
