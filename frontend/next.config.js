/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/websocket/:path*',
        destination: 'http://localhost:3001/:path*',
      },
      {
        source: '/api/neo4j/:path*',
        destination: 'http://localhost:8002/:path*',
      },
      {
        source: '/api/keycloak/:path*',
        destination: 'http://localhost:8001/:path*',
      },
      {
        source: '/api/ai-gateway/:path*',
        destination: 'http://localhost:8005/:path*',
      }
    ];
  }
};

module.exports = nextConfig;