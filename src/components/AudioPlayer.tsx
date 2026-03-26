"use client";

import { useRef, useState } from "react";

interface SubtitleCue {
  start: number;
  end: number;
  original: string;
  translated: string;
}

interface AudioPlayerProps {
  audioUrl: string;
  fileName: string;
  transcription: string;
  translatedText: string;
  targetLanguage: string;
  originalVideoUrl?: string;
  subtitles?: SubtitleCue[];
  syncMap?: any[];
}

const LANGUAGE_LABELS: Record<string, string> = {
  ko: "한국어", en: "English", ja: "日本語", es: "Español",
  fr: "Français", de: "Deutsch", zh: "中文", ar: "العربية",
  it: "Italiano", pt: "Português",
};

// SRT 형식 생성
function toSRT(cues: SubtitleCue[], mode: "original" | "translated"): string {
  return cues.map((c, i) => {
    const fmt = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      const ms = Math.round((s % 1) * 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
    };
    const text = mode === "original" ? c.original : c.translated;
    return `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${text}\n`;
  }).join("\n");
}

function downloadSRT(cues: SubtitleCue[], mode: "original" | "translated") {
  const blob = new Blob([toSRT(cues, mode)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `subtitles_${mode}.srt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AudioPlayer({
  audioUrl,
  fileName,
  transcription,
  translatedText,
  targetLanguage,
  originalVideoUrl,
  subtitles,
}: AudioPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dubVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);

  // 동기화 재생: 원본 영상(음소거) + 더빙 오디오를 같이 재생
  // 원본 영상의 원래 음성이 더빙 오디오와 섞이지 않도록 동기화 중에는 음소거 처리
  const handleSyncPlay = () => {
    const video = videoRef.current;       // 왼쪽 원본 영상
    const dubVideo = dubVideoRef.current; // 오른쪽 더빙 영상 (항상 muted)
    const audio = audioRef.current;       // 더빙 오디오
    if (!video || !dubVideo || !audio) return;

    if (isSyncing) {
      // 정지: 원본 영상 음소거 해제, 모두 정지
      video.muted = false;
      video.pause();
      dubVideo.pause();
      audio.pause();
      setIsSyncing(false);
    } else {
      // 재생: 원본 영상 음소거 후 양쪽 영상 + 더빙 오디오 동기화 재생
      video.currentTime = 0;
      dubVideo.currentTime = 0;
      audio.currentTime = 0;
      video.muted = true; // 원본 음성 차단 - 더빙 오디오만 들리도록
      video.play();
      dubVideo.play();
      audio.play();
      setIsSyncing(true);
    }
  };

  // 더빙 영상 다운로드: Canvas + AudioContext + MediaRecorder로
  // 원본 영상(무음 프레임)과 더빙 오디오를 실시간 합성 녹화 후 webm 저장
  const handleDownloadDubbedVideo = async () => {
    const video = dubVideoRef.current;  // 원본 영상(muted)
    const audio = audioRef.current;      // 더빙 오디오
    if (!video || !audio || isRecording) return;

    setIsRecording(true);
    setRecordProgress(0);

    // Canvas에 video 프레임을 실시간으로 그려 VideoStream 생성
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsRecording(false);
      return;
    }
    
    // captureStream: 브라우저 호환성을 위해 any 캐스팅 (일부 브라우저에서 stream/mozCaptureStream 지원)
    const v = canvas as any;
    const videoStream = (v.captureStream || v.mozCaptureStream).call(v, 30); // 30fps

    // AudioContext에서 더빙 오디오 소스를 추출해 MediaStream으로 변환
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioSrc = audioCtx.createMediaElementSource(audio);
    const dest = audioCtx.createMediaStreamDestination();
    audioSrc.connect(dest);
    audioSrc.connect(audioCtx.destination); // 캡처하는 동안 재생음도 들리게 유지

    // 비디오 + 오디오 트랙 합성
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    let options = { mimeType: "video/webm" };
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
      options.mimeType = "video/webm;codecs=vp9,opus";
    }

    const recorder = new MediaRecorder(combinedStream, options);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    // 녹화 완료 시 파일 저장
    recorder.onstop = () => {
      audioCtx.close();
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // 확장자 제거 후 webm 붙임
      const finalName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "dubbed_video";
      a.download = `${finalName}_dubbed.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsRecording(false);
      setRecordProgress(0);
    };

    // Canvas 프레임 루프
    let animId: number;
    const drawLoop = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      animId = requestAnimationFrame(drawLoop);
    };

    // 영상 + 오디오 동기화 후 녹화 시작
    recorder.start(100);
    video.currentTime = 0;
    audio.currentTime = 0;
    await Promise.all([video.play(), audio.play()]);
    drawLoop();

    // 오디오 종료 시 녹화 종료
    const duration = audio.duration || 60;
    audio.onended = () => {
      cancelAnimationFrame(animId);
      recorder.stop();
      video.pause();
    };

    // 진행률 업데이트 (UI 표시용)
    const progressInterval = setInterval(() => {
      if (!audio.paused && duration > 0) {
        setRecordProgress(Math.round((audio.currentTime / duration) * 100));
      }
      if (audio.ended) clearInterval(progressInterval);
    }, 500);
  };

  const s: Record<string, React.CSSProperties> = {
    container: { display: "flex", flexDirection: "column", gap: "20px", padding: "4px 0" },
    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
    label: { fontSize: "0.73rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: "10px", display: "block" },
    badge: { display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 600, marginLeft: "8px" },
    videoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
    videoBox: { background: "#0f0f0f", borderRadius: "10px", overflow: "hidden", border: "1px solid #333" },
    videoLabel: { padding: "8px 12px", background: "#1a1a2e", color: "#94a3b8", fontSize: "0.78rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" },
    videoEl: { width: "100%", display: "block", aspectRatio: "16/9", objectFit: "contain" as const, background: "#000" },
    audioRow: { display: "flex", flexDirection: "column" as const, gap: "12px" },
    row: { display: "flex", flexWrap: "wrap" as const, gap: "10px", alignItems: "center" },
    btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, transition: "opacity 0.15s" },
    btnPrimary: { background: "#4f46e5", color: "#fff" },
    btnSecondary: { background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0" },
    btnGreen: { background: "#059669", color: "#fff" },
    textBlock: { background: "#f8fafc", borderRadius: "8px", padding: "14px", fontSize: "0.9rem", lineHeight: "1.7", color: "#374151", whiteSpace: "pre-wrap" as const, maxHeight: "180px", overflowY: "auto" as const },
    syncBadge: { background: isSyncing ? "#10b981" : "#6366f1", color: "#fff", padding: "2px 8px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700 },
  };

  const isVideo = !!originalVideoUrl;

  return (
    <div style={s.container}>
      {/* ── 헤더 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "1.3rem" }}>🎉</span>
        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1e293b" }}>더빙 완료</span>
        <span style={{ ...s.badge, background: "#ede9fe", color: "#7c3aed" }}>
          {LANGUAGE_LABELS[targetLanguage] || targetLanguage}
        </span>
      </div>

      {/* ── 비디오 모드 ── */}
      {isVideo && (
        <div style={s.card}>
          <span style={s.label}>영상 미리보기</span>
          <div style={s.videoGrid}>
            {/* 원본 (음소거 없음) */}
            <div style={s.videoBox}>
              <div style={s.videoLabel}>
                <span>🎬</span><span>원본 영상</span>
              </div>
              <video ref={videoRef} src={originalVideoUrl} controls style={s.videoEl} playsInline />
            </div>
            {/* 더빙: 원본 영상 무음 + 더빙 오디오 */}
            <div style={s.videoBox}>
              <div style={s.videoLabel}>
                <span>🔊</span>
                <span>더빙 영상</span>
                <span style={s.syncBadge}>{isSyncing ? "동기화 중" : "대기"}</span>
              </div>
              <video ref={dubVideoRef} src={originalVideoUrl} muted style={s.videoEl} playsInline />
              <audio ref={audioRef} src={audioUrl} />
            </div>
          </div>
          {/* 동기화 재생 및 다운로드 버튼 */}
          <div style={{ ...s.row, marginTop: "14px" }}>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={handleSyncPlay} disabled={isRecording}>
              {isSyncing ? "⏸ 동기화 정지" : "▶ 동기화 재생 (원본+더빙)"}
            </button>
            <button style={{ ...s.btn, ...s.btnGreen }} onClick={handleDownloadDubbedVideo} disabled={isRecording}>
              {isRecording ? `녹화 중... ${recordProgress}%` : "📸 더빙 영상 다운로드 (.webm)"}
            </button>
          </div>
        </div>
      )}

      {/* ── 더빙 오디오 ── */}
      <div style={s.card}>
        <span style={s.label}>더빙 오디오</span>
        <div style={s.audioRow}>
          <audio controls src={audioUrl} style={{ width: "100%", borderRadius: "8px" }} />
          <div style={s.row}>
            <a href={audioUrl} download={fileName} style={{ textDecoration: "none" }}>
              <button style={{ ...s.btn, ...s.btnGreen }}>💾 MP3 다운로드</button>
            </a>
            {subtitles && subtitles.length > 0 && (
              <>
                <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => downloadSRT(subtitles!, "original")}>
                  📄 원본 자막 (.srt)
                </button>
                <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => downloadSRT(subtitles!, "translated")}>
                  📄 번역 자막 (.srt)
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 원문 / 번역 텍스트 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={s.card}>
          <span style={s.label}>원본 텍스트 <span style={{ ...s.badge, background: "#f1f5f9", color: "#64748b" }}>STT</span></span>
          <div style={s.textBlock}>{transcription || "(인식된 텍스트 없음)"}</div>
        </div>
        <div style={s.card}>
          <span style={s.label}>
            번역 텍스트
            <span style={{ ...s.badge, background: "#ede9fe", color: "#7c3aed" }}>
              {LANGUAGE_LABELS[targetLanguage] || targetLanguage}
            </span>
          </span>
          <div style={s.textBlock}>{translatedText || "(번역 텍스트 없음)"}</div>
        </div>
      </div>

      {/* ── 자막 목록 ── */}
      {subtitles && subtitles.length > 0 && (
        <div style={s.card}>
          <span style={s.label}>자막 세그먼트 ({subtitles.length}개)</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" }}>
            {subtitles.map((cue, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: "8px", padding: "8px 10px", background: "#f8fafc", borderRadius: "6px", fontSize: "0.82rem" }}>
                <span style={{ color: "#94a3b8", fontFamily: "monospace", paddingTop: "2px" }}>
                  {cue.start.toFixed(1)}s
                </span>
                <span style={{ color: "#374151" }}>{cue.original}</span>
                <span style={{ color: "#7c3aed" }}>{cue.translated}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
