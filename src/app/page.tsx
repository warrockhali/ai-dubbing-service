import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  
  // 이미 인증된 회원은 대시보드로 자동 리다이렉트
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="landing-layout">
      <header className="landing-header">
        <h1>AI Dubbing Studio</h1>
        <Link href="/login" className="login-btn-header">로그인</Link>
      </header>
      
      <main className="landing-main">
        <h2 className="hero-title">경계를 허무는 <span className="highlight">음성의 마법</span></h2>
        <p className="hero-desc">
          오디오/비디오 파일을 업로드하고, 전사부터 번역, 원본 목소리를 살린 TTS 합성까지 
          단 번에 끝내는 다국어 더빙 파이프라인을 경험해보세요.
        </p>
        <Link href="/login" className="hero-cta">🚀 지금 시작하기</Link>
        
        <div className="feature-grid">
          <div className="feature-card">
            <h3>🎙️ 음성 인식 (STT)</h3>
            <p>원본 영상 또는 음성에서 발음 및 대사를 높은 정확도로 추출하여 전사(Transcription) 합니다.</p>
          </div>
          <div className="feature-card">
            <h3>🌐 다국어 번역</h3>
            <p>추출된 텍스트를 문맥 손실 없이 타겟 언어로 실시간 번역하여 대본을 생성합니다.</p>
          </div>
          <div className="feature-card">
            <h3>🗣️ 음성 합성 (TTS)</h3>
            <p>ElevenLabs API를 연동하여 다국어가 지원되는 자연스럽고 생동감 있는 오디오로 합성을 완료합니다.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
