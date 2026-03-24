import { withAuth } from "next-auth/middleware";

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
    "/api/translation/:path*",
  ]
};
