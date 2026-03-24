import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from './index';
import { whitelist } from './schema';

async function seed() {
  console.log('🌱 Seed 작업 시작: 기본 이메일 추가');
  
  // 과제 요구사항 필수 계정 및 서비스 관리자 계정 등록
  const defaultEmails = ['kts123@estsoft.com', 'gkok1029@gmail.com'];
  for (const email of defaultEmails) {
    await db.insert(whitelist).values({ email }).onConflictDoNothing();
  }
  
  console.log('✅ Seed 완료: kts123@estsoft.com 이메일 포함 완료');
}

seed().catch((err) => {
  console.error('Seed 에러:', err);
  process.exit(1);
});
