import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ffmpeg-installer/ffmpeg와 fluent-ffmpeg는 내부적으로 __dirname과 동적 require를 
  // 사용하여 시스템 바이너리를 로드하므로 Webpack 서버 번들링에서 예외 처리해야 합니다.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "fluent-ffmpeg"],
};

export default nextConfig;
