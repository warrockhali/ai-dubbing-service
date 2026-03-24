import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// 로컬 환경변수 파일(.env.local)을 읽어오도록 설정
dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  // 최신 Drizzle 버전에 맞춰 driver 대신 dialect: 'turso'로 단일 지정
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || 'file:./local.db',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  },
});
