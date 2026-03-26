import { withAuth } from "next-auth/middleware";

// Next.js 16에서 middleware → proxy로 네이밍 변경됨
// withAuth는 내부적으로 default export를 반환하므로 그대로 사용 가능
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // 인증이 필요한 기능 영역 (대시보드 및 AI 처리 API)
  matcher: [
    "/dashboard/:path*",
    "/api/process/:path*",
    "/api/upload-chunk/:path*",
    "/api/dub/:path*",
  ]
};
