import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Lets `next dev` see Cloudflare bindings/env the same way the deployed Worker does.
initOpenNextCloudflareForDev();

// Workers can't resolve node_modules at runtime, so react-pdf must be bundled, not left external.
const nextConfig: NextConfig = { transpilePackages: ["@react-pdf/renderer"] };

export default nextConfig;
