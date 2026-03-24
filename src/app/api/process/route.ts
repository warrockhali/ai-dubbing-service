import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { transcribeAudio, synthesizeSpeech, type SupportedLanguageCode } from "@/lib/elevenlabs";
import { extractAudioToMp3 } from "@/lib/ffmpeg";

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

    // 오디오를 Base64로 인코딩하여 클라이언트로 전달
    const audioBase64 = audioBuffer2.toString('base64');
    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

    return NextResponse.json({
      success: true,
      transcription: transcript,
      translation: translatedText,
      detectedLanguage: languageCode,
      audioUrl,
    });

  } catch (error) {
    console.error("[Pipeline Error]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "파이프라인 처리 중 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
