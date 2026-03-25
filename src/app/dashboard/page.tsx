'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState('en');
  const [testMode, setTestMode] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [resultAudio, setResultAudio] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('processing');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLang', targetLang);
    formData.append('testMode', String(testMode));

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      
      let data: any = {};
      const responseText = await res.text();
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        if (responseText.includes('Request Entity Too Large') || res.status === 413) {
          throw new Error('Vercel 서버 등 호스팅 환경의 허용 용량(기본 4.5MB)을 초과하여 파일 전송이 차단되었습니다. 테스트를 위해 더 작은 용량의 파일을 업로드해 주세요.');
        }
        throw new Error(`서버에서 알 수 없는 응답이 돌아왔습니다 (상태코드: ${res.status}). 원본 응답 텍스트: ${responseText.substring(0, 50)}...`);
      }

      if (!res.ok) throw new Error(data.error || '알 수 없는 서버 오류가 발생했습니다.');

      setResultAudio(data.audioUrl || null);
      setErrorMessage(null);
      setStatus('done');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '처리 중 알 수 없는 오류가 발생했습니다.');
      setStatus('error');
    }
  };

  return (
    <div className="dashboard-layout">
      <header className="dashboard-header">
        <h2>🚀 AI Dubbing Studio</h2>
        <div className="header-actions">
          <span className="user-email">{session?.user?.email}</span>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="logout-btn">
            로그아웃
          </button>
        </div>
      </header>
      
      <main className="dashboard-main">
        <section className="upload-section">
          <h3>신규 더빙 프로젝트</h3>
          <p className="section-desc">미디어 파일을 업로드하고 원하는 언어로 번역 및 더빙하세요.</p>
          
          <form onSubmit={handleUpload} className="upload-form">
            <div className="file-drop-area">
              <input 
                type="file" 
                accept="audio/*, video/*" 
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
                className="file-input"
                required
              />
              <div className="file-msg">
                {file ? file.name : '클릭하거나 파일을 드래그하여 업로드'}
              </div>
            </div>

            <div className="lang-select-group">
              <label>타겟 언어:</label>
              <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="lang-select">
                <option value="en">English (영어)</option>
                <option value="ja">Japanese (일본어)</option>
                <option value="es">Spanish (스페인어)</option>
                <option value="zh">Chinese (중국어)</option>
              </select>
            </div>

            <div className="test-mode-toggle" style={{ marginBottom: '20px', padding: '10px 15px', backgroundColor: '#f0f4ff', borderRadius: '6px', border: '1px solid #d0dfff' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: '#004ee6' }}>
                <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                <span>🧪 테스트 모드 활성화 (처음 20초 크롭)</span>
              </label>
              <p style={{ margin: '5px 0 0 24px', fontSize: '0.85rem', color: '#444' }}>
                대용량 비디오/오디오의 앞부분 20초만 잘라서 빠르게 파이프라인(STT/번역/TTS)을 검증합니다.
              </p>
            </div>

            <button 
              type="submit" 
              className={`submit-btn ${status === 'processing' ? 'processing' : ''}`}
              disabled={status === 'processing' || !file}
            >
              {status === 'processing' ? '더빙 파이프라인 진행 중...' : '더빙 시작'}
            </button>
          </form>

          {status === 'error' && errorMessage && (
            <div className="error-message" style={{ 
              marginTop: '20px', 
              padding: '15px', 
              backgroundColor: '#ffebe9', 
              color: '#cf222e', 
              borderRadius: '8px', 
              border: '1px solid #ff8182',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>🚨</span> 
              <span>{errorMessage}</span>
            </div>
          )}
        </section>

        {status === 'done' && resultAudio && (
          <section className="result-section">
            <h3>🎉 더빙 완료!</h3>
            <div className="audio-player-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
              {resultAudio.startsWith('data:video') ? (
                <video controls src={resultAudio} className="video-player" style={{ width: '100%', maxHeight: '400px', borderRadius: '8px', backgroundColor: '#000' }} />
              ) : (
                <audio controls src={resultAudio} className="audio-player" style={{ width: '100%' }} />
              )}
              <a href={resultAudio} download={resultAudio.startsWith('data:video') ? "dubbed_video.mp4" : "dubbed_audio.mp3"} className="download-btn">
                💾 파일 다운로드
              </a>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
