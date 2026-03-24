import * as dotenv from 'dotenv';
// seed.ts 등 스크립트에서 직접 import할 때에도 환경변수가 주입되도록 보장
dotenv.config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error('[DB] TURSO_DATABASE_URL 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client);
