/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Keep native/binary deps (Playwright, better-sqlite3) out of the server bundler.
  serverExternalPackages: ['playwright', 'playwright-core', 'better-sqlite3', '@anthropic-ai/claude-agent-sdk'],
};
module.exports = nextConfig;
