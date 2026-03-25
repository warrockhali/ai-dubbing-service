import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { transcribeAudio, synthesizeSpeech, type SupportedLanguageCode } from "@/lib/elevenlabs";
import { extractAudioToMp3, mergeAudioToVideo } from "@/lib/ffmpeg";

export async function POST(req: NextRequest) {
  // 1. 인증 검증 (미들웨어 이중 확인)
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const targetLang = formData.get("targetLang") as SupportedLanguageCode;

    if (!file || !targetLang) {
      return NextResponse.json({ error: "파일 또는 타겟 언어가 누락되었습니다." }, { status: 400 });
    }

    // 파일 크기 제한 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기가 50MB를 초과합니다." }, { status: 413 });
    }

    console.log(`[Pipeline Start] 파일: ${file.name} (${(file.size / 1024).toFixed(1)}KB), 타겟 언어: ${targetLang}`);

    // [전처리] 미디어 파일을 ffmpeg으로 MP3 규격(16kHz/Mono) 강제 변환
    console.log("[Pre-processing] 미디어 파일 MP3 추출 변환 시작...");
    const processedFile = await extractAudioToMp3(file);

    // Step 1. 음성 추출 및 전사 (STT) - ElevenLabs Scribe v1
    console.log("[Step 1] STT 전사 시작...");
    const { text: transcript, languageCode } = await transcribeAudio(processedFile);
    console.log(`[Step 1] 전사 완료. 감지된 언어: ${languageCode}, 글자수: ${transcript.length}`);

    // Step 2. 텍스트 번역 (Google Translate 무료 API 활용)
    console.log(`[Step 2] 번역 시작... (${languageCode} → ${targetLang})`);
    const translateRes = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(transcript)}`
    );
    if (!translateRes.ok) {
      throw new Error(`Translate API Limit: ${translateRes.statusText}`);
    }
    const translateData = await translateRes.json();
    // Google 번역 API 응답 파싱
    const translatedText: string = translateData[0]
      .map((item: [string]) => item[0])
      .filter(Boolean)
      .join('');
    console.log(`[Step 2] 번역 완료. 글자수: ${translatedText.length}`);

    // Step 3. 음성 합성 (TTS) - ElevenLabs Multilingual v2
    console.log("[Step 3] TTS 합성 시작...");
    const audioBuffer2 = await synthesizeSpeech(translatedText, targetLang);
    console.log(`[Step 3] TTS 완료. 오디오 크기: ${(audioBuffer2.length / 1024).toFixed(1)}KB`);

    // [후처리] 원본 파일이 비디오일 경우 병합(Muxing) 수행
    const isVideo = !!(file.name.match(/\.(mp4|mov|avi|webm)$/i) || file.type.startsWith('video/'));
    let finalBase64: string;
    let finalMimeType: string;

    if (isVideo) {
      console.log("[Post-processing] 원본 비디오와 더빙 오디오 병합 중...");
      const dubbedVideoBuffer = await mergeAudioToVideo(file, audioBuffer2);
      finalBase64 = dubbedVideoBuffer.toString('base64');
      finalMimeType = 'video/mp4';
      console.log(`[Post-processing] 비디오 병합 완료. 영상 크기: ${(dubbedVideoBuffer.length / 1024).toFixed(1)}KB`);
    } else {
      finalBase64 = audioBuffer2.toString('base64');
      finalMimeType = 'audio/mp3';
    }

    // 미디어를 Base64로 인코딩하여 클라이언트로 전달
    const audioUrl = `data:${finalMimeType};base64,${finalBase64}`;

    return NextResponse.json({
      success: true,
      transcription: transcript,
      translation: translatedText,
      detectedLanguage: languageCode,
      audioUrl,
    });

  } catch (error: any) {
    console.error("[Pipeline Error]", error);

    // 에러 원인을 분석하여 사용자 친화적인 메시지로 변환
    let userMessage = "파이프라인 처리 중 알 수 없는 오류가 발생했습니다.";
    let statusCode = 500;
    const errString = (error instanceof Error ? error.message : String(error)).toLowerCase();

    if (errString.includes("quota") || errString.includes("rate limit") || errString.includes("insufficient")) {
      userMessage = "AI API 서비스(ElevenLabs)의 사용 한도(토큰)를 모두 소진했습니다. 관리자에게 문의하거나 결제 플랜을 확인해주세요.";
      statusCode = 429;
    } else if (errString.includes("translate api limit") || errString.includes("429") || errString.includes("too many requests")) {
      userMessage = "번역 API 서버에 트래픽이 몰려 요청 한도를 초과했습니다. 잠시 후 다시 시도해주시거나 공식 API 플랜으로 업그레이드해주세요.";
      statusCode = 429;
    } else if (errString.includes("ffmpeg") || errString.includes("extract")) {
      userMessage = "업로드한 미디어 파일에서 음성을 추출할 수 없습니다. 형식이 잘못되었거나 파일이 손상되었을 수 있습니다.";
      statusCode = 400;
    } else if (errString.includes("timeout") || errString.includes("timed out")) {
      userMessage = "미디어 처리 시간이 너무 오래 걸려 중단되었습니다. 파일 길이나 용량을 줄여서 다시 시도해주세요.";
      statusCode = 504;
    } else if (error instanceof Error) {
      userMessage = `처리 중 다음 이유로 중단되었습니다: ${error.message}`;
    }

    return NextResponse.json(
      { error: userMessage },
      { status: statusCode }
    );
  }
}
