
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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
  // Allow Replit and other development origins for cross-origin HMR and server actions
  allowedDevOrigins: [
    "*.replit.dev",
    "*.repl.co",
    "*.cloudworkstations.dev",
    "*.firebaseapp.com",
    "*.web.app",
    "*.c9users.io"
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: [
        "*.replit.dev",
        "*.repl.co",
        "*.cloudworkstations.dev",
        "localhost:3000",
        "localhost:5000",
        "*.firebaseapp.com",
        "*.web.app",
        "*.c9users.io"
      ],
    },
  },
};

export default nextConfig;
