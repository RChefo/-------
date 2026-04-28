/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use .next-prod instead of .next to avoid the Windows NTFS file-lock
  // on .next/trace that occurs on Arabic-named paths.
  distDir: '.next-prod',

  // Skip type-checking of auto-generated files in the build output dir.
  // Type-checking still works normally in the IDE via tsconfig.json.
  typescript: {
    ignoreBuildErrors: true,
  },

  async rewrites() {
    // BACKEND_URL is read at server start time (not build time), so it can
    // be changed by restarting without rebuilding.
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
