'use client';

import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Script from 'next/script';
import AudioPlayer from '@/components/AudioPlayer';

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
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 상태 변경 (결과값 저장용)
  const [resultData, setResultData] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setOriginalVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalVideoUrl(null);
    }
  }, [file]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('processing');
    setErrorMessage(null);
    setUploadProgress(0);

    try {
      // 1. Vercel Blob 청크 업로드
      const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
      const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const chunkUrls: string[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        const formData = new FormData();
        formData.append("chunk", chunk, `chunk_${i}`);
        formData.append("uploadId", uploadId);
        formData.append("partNumber", String(i));

        const res = await fetch("/api/upload-chunk", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `파일 업로드 실패 (${i + 1}/${totalChunks})`);
        }
        const { chunkUrl } = await res.json();
        chunkUrls.push(chunkUrl);
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      setErrorMessage("파일 업로드 완료. STT / 번역 / TTS 처리 중입니다...");

      // 2. /api/dub 서버리스 호출
      const response = await fetch("/api/dub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chunkUrls, 
          targetLanguage: targetLang, 
          fileName: file.name, 
          mimeType: file.type 
        }),
      });

      if (!response.ok) {
        let errData;
        try {
          errData = await response.json();
        } catch(e) {
          throw new Error('서버 처리 시간이 지연되어 네트워크 응답이 끊어졌습니다(서버리스 함수 시간 초과).');
        }
        throw new Error(errData.error || "더빙 처리 중 오류가 발생했습니다");
      }

      const data = await response.json();
      setResultData({
        ...data,
        originalVideoUrl: originalVideoUrl
      });
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
          <button onClick={() => signOut({ callbackUrl: '/' })} className="logout-btn">
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

            <button
              type="submit"
              className={`submit-btn ${status === 'processing' ? 'processing' : ''}`}
              disabled={status === 'processing' || !file}
            >
              {status === 'processing' ? `처리 중... (업로드 ${uploadProgress}%)` : '더빙 시작'}
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

        {status === 'done' && resultData && (
          <section className="result-section" style={{ marginTop: '30px' }}>
            <h3>🎉 더빙 완료!</h3>
            <div style={{ padding: '20px', backgroundColor: '#1a1a2e', borderRadius: '12px' }}>
              <AudioPlayer 
                audioUrl={resultData.audioUrl}
                fileName={resultData.fileName || file?.name || 'dubbed_audio.mp3'}
                transcription={resultData.transcription}
                translatedText={resultData.translatedText}
                targetLanguage={targetLang}
                originalVideoUrl={resultData.originalVideoUrl}
                subtitles={resultData.subtitles}
                syncMap={resultData.syncMap}
              />
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
