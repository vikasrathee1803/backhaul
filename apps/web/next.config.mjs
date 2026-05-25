/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the Vercel preview deployment URL pattern in addition to the
  // hardcoded production domain. Needed for PR preview links.
  experimental: {
    serverActions: {
      allowedOrigins: ["backhaul.vercel.app", "*.vercel.app"],
    },
  },
};

export default nextConfig;
