/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, dev }) => {
    // Add WebSocket support
    config.externals = [...(config.externals || [])];
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: require.resolve('ws'),
      };
    }

    // Disable webpack caching in production
    if (!dev) {
      config.cache = false;
    }

    return config;
  },
  // Add headers for WebSocket support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Upgrade, Connection' },
        ],
      },
    ];
  },
  // Add WebSocket configuration
  webSocketTransport: {
    pingInterval: 25000,
    pingTimeout: 60000,
    reconnect: true,
    reconnectAttempts: 5,
    reconnectInterval: 1000,
  },
};

module.exports = nextConfig;