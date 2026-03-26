'use client';

import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Script from 'next/script';

declare global {
  interface Window {
    FFmpegWASM: any;
    FFmpegUtil: any;
    _ffmpegInstance: any;
  }
}

// --- 브라우저 네이티브 비디오 크롭 (WASM 차단 시 대체용) ---
async function cropVideoNative(file: File, durationSec: number = 20, onProgress?: (msg: string) => void): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true; // 무음 처리로 백그라운드 재생
    video.playsInline = true;
    video.setAttribute('style', 'position:fixed; top:-9999px; left:-9999px;');
    document.body.appendChild(video);

    video.onloadedmetadata = () => {
      const recordDuration = Math.min(video.duration, durationSec);
      let stream: MediaStream;
      
      try {
        stream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
      } catch (err) {
        cleanup();
        return reject(new Error("이 브라우저에서는 네이티브 비디오 추출(captureStream)이 지원되지 않습니다."));
      }

      // WebM 코덱 (대부분의 모던 브라우저 지원, 백엔드 FFmpeg 호환)
      const options = MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus') 
        ? { mimeType: 'video/webm; codecs=vp9,opus' } 
        : { mimeType: 'video/webm' };

      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        cleanup();
        resolve(new File([blob], `cropped_${file.name}.webm`, { type: 'video/webm' }));
      };

      video.play().then(() => {
        recorder.start();
        if (onProgress) onProgress(`네이티브 화면 캡처(크롭) 진행 중... (약 ${Math.ceil(recordDuration)}초 소요 대기)`);
        
        setTimeout(() => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
          video.pause();
        }, recordDuration * 1000);
      }).catch(err => {
        cleanup();
        reject(err);
      });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("비디오 로드에 실패했습니다. 올바른 포맷인지 확인해주세요."));
    };

    function cleanup() {
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
      URL.revokeObjectURL(url);
    }
  });
}

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
    setErrorMessage(null);

    try {
      let fileToUpload = file;
      const isLargeFile = file.size > 4.5 * 1024 * 1024; // 4.5MB 기준선

      // 파일크기 4.5MB 초과 및 테스트 모드 활성화 시 네이티브 크롭 진행
      if (testMode && isLargeFile) {
        console.log(`[Native Video Crop] 4.5MB 초과 감지. 파일: ${file.name} / ${file.size} bytes`);
        
        try {
          const croppedWebm = await cropVideoNative(file, 20, (msg) => setErrorMessage(msg));
          fileToUpload = croppedWebm;
          
          console.log(`[Success] 비디오 네이티브 크롭 성공: ${(croppedWebm.size / 1024 / 1024).toFixed(2)}MB`);
          setErrorMessage('20초 테스트 영상 분할 완료. 서버 전달을 시작합니다...');
        } catch (cropErr) {
          console.error("Video crop failed:", cropErr);
          throw new Error("브라우저 내 영상 분할(Crop) 중 오류가 발생했습니다. 지원되는 비디오 형식이 아닐 수 있습니다.");
        }
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('targetLang', targetLang);
      formData.append('testMode', testMode.toString());

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
        } else if (res.status === 504 || responseText.includes('TIMEOUT')) {
          throw new Error('서버 처리 시간이 지연되어 네트워크 응답이 끊어졌습니다(서버리스 함수 시간 초과). 더 짧은 영상이나 테스트 모드(20초 크롭)를 활용해 주세요.');
        } else if (res.status === 401 || res.status === 403) {
          throw new Error('보안 정책에 의해 차단되었습니다. 로그인 세션이 만료되었거나 화이트리스트 접근 권한이 없는 계정입니다.');
        } else if (res.status >= 500) {
          throw new Error('서버 내부에서 예상치 못한 심각한 장애가 발생했습니다. 잠시 후 폼을 새로고침하여 다시 시도해 주세요.');
        }
        throw new Error(`알 수 없는 응답 형식(비정상 JSON)을 서버로부터 받았습니다 (코드: ${res.status}). 원본: ${responseText.substring(0, 30)}...`);
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

          {(status === 'error' || (status === 'processing' && errorMessage)) && errorMessage && (
            <div className="error-message" style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: status === 'error' ? '#ffebe9' : '#fff8e1',
              color: status === 'error' ? '#cf222e' : '#7c5c00',
              borderRadius: '8px',
              border: `1px solid ${status === 'error' ? '#ff8182' : '#ffe082'}`,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>{status === 'error' ? '🚨' : '⏳'}</span>
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

      {/* 클라이언트 측 Web Worker CORS 제약 우회를 위한 로컬 스크립트 호스팅 */}
      <Script src="/ffmpeg/ffmpeg.js" strategy="afterInteractive" />
      <Script src="/ffmpeg/index.js" strategy="afterInteractive" />
    </div>
  );
}
