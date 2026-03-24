import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "./db";
import { whitelist } from "./db/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        const result = await db
          .select()
          .from(whitelist)
          .where(eq(whitelist.email, user.email));
        
        if (result.length > 0) {
          return true; // 인증 성공 (화이트리스트 통과)
        }
        
        return false; // 인증 실패 (화이트리스트에 없음)
      } catch (error) {
        console.error("화이트리스트 검증 오류:", error);
        return false;
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login?error=AccessDenied", // 유저 차단 시 리다이렉트
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
