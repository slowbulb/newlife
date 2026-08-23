import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root to this project so Turbopack doesn't get
  // confused by an unrelated lockfile elsewhere on your machine (e.g. one
  // sitting in your home directory).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
