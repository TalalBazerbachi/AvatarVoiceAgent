// /** @type {import('next').NextConfig} */

// const nextConfig = {
//     reactStrictMode: true,
//   }
// export default nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add WebSocket support
    config.externals = [...(config.externals || [])];
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: require.resolve('ws'),
      };
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
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;