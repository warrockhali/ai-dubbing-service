'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">🎤 AI 더빙 서비스</h1>
        <p className="login-desc">에스트소프트 인턴과제 - 음성 추출 및 다국어 더빙 파이프라인</p>

        {error === 'AccessDenied' && (
          <div className="error-message">
            접근이 차단되었습니다. 화이트리스트에 등록된 계정만 이용 가능합니다.
          </div>
        )}

        <button 
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })} 
          className="google-btn"
        >
          <img src="https://authjs.dev/img/providers/google.svg" alt="Google Logo" width={24} height={24} className="google-icon" />
          Google 계정으로 계속하기
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-container"><div className="login-box">로딩 중...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}
