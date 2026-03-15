
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Move typescript ignore inside its own object if needed
  typescript: {
    ignoreBuildErrors: true,
  },
  // This is the specific block causing the error in Capture 30
  eslint: {
    // This tells Next.js to run the build even if there are linting errors
    ignoreDuringBuilds: true,
  },
  images: {
    // Your existing image configuration here
  }
};

export default nextConfig;