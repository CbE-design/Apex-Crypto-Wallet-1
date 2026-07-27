/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prevent webpack from bundling these heavy native/CJS packages on the
    // server — Node.js will require() them at runtime instead.
    // (Next.js 14 uses `serverComponentsExternalPackages`; renamed in v15)
    serverComponentsExternalPackages: [
      '@vladmandic/face-api',
      'canvas',
      'tesseract.js',
      '@tensorflow/tfjs-node',
      '@opentelemetry/sdk-node',
      '@opentelemetry/instrumentation',
      'require-in-the-middle',
      'firebase-admin',
      '@google-cloud/firestore',
    ],
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: [
        "*.replit.dev",
        "*.kirk.replit.dev",
        "*.picard.replit.dev",
        "*.janeway.replit.dev",
        "*.sisko.replit.dev",
        "*.spock.replit.dev",
        "*.repl.co",
        "*.cloudworkstations.dev",
        "localhost:3000",
        "localhost:5000",
        "*.firebaseapp.com",
        "*.web.app",
        ...(process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : []),
      ],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.replit.com",
      },
      {
        protocol: "https",
        hostname: "**.replit.dev",
      },
      {
        protocol: "https",
        hostname: "**.repl.co",
      },
       {
        protocol: "https",
        hostname: "**.cloudworkstations.dev",
      },
      {
        protocol: "https",
        hostname: "**.firebaseapp.com",
      },
      {
        protocol: "https",
        hostname: "**.web.app",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
       ...(process.env.REPLIT_DEV_DOMAIN ? [{
        protocol: "https",
        hostname: process.env.REPLIT_DEV_DOMAIN,
      }] : []),
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /node:crypto/,
          (resource) => {
            resource.request = resource.request.replace(/^node:/, "");
          }
        )
      );
    }
    return config;
  },
};

export default nextConfig;
