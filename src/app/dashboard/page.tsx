'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState('en');
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [resultAudio, setResultAudio] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('processing');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLang', targetLang);

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Server Error');

      setResultAudio(data.audioUrl || null);
      setStatus('done');
    } catch (err) {
      console.error(err);
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

            <button 
              type="submit" 
              className={`submit-btn ${status === 'processing' ? 'processing' : ''}`}
              disabled={status === 'processing' || !file}
            >
              {status === 'processing' ? '더빙 파이프라인 진행 중...' : '더빙 시작'}
            </button>
          </form>

          {status === 'error' && (
            <div className="error-message" style={{ marginTop: '20px' }}>
              파이프라인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
            </div>
          )}
        </section>

        {status === 'done' && resultAudio && (
          <section className="result-section">
            <h3>🎉 더빙 완료!</h3>
            <div className="audio-player-wrapper">
              <audio controls src={resultAudio} className="audio-player" />
              <a href={resultAudio} download="dubbed_audio.mp3" className="download-btn">
                💾 파일 다운로드
              </a>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
