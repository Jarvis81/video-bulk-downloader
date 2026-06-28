/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Consume the shared workspace package directly from source.
  transpilePackages: ["@vbd/shared"],
  // Static export (the app is a single client route) → `apps/web/out`, which
  // Fastify serves inside Electron. Avoids the Windows `standalone` symlink issue.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
