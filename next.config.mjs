/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the Tavily SDK as a plain Node dependency in server routes (it has optional native deps).
  serverExternalPackages: ["@tavily/core"],
};
export default nextConfig;
