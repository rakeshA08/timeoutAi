import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@ffmpeg-installer/ffmpeg',
    'fluent-ffmpeg',
    'isomorphic-git',
    '@libsql/client',
  ],
};

export default nextConfig;
