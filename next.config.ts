import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer pulls in native-ish font/stream internals that don't survive
  // bundling; leave it to Node's own resolver in server builds.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
