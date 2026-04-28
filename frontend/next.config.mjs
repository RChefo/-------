/** @type {import('next').NextConfig} */
const nextConfig = {
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
