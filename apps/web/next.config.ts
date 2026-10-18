import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@agent-template/ui", "@agent-template/shared"]
};

export default nextConfig;
