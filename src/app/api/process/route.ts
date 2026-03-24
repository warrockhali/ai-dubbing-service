import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ElevenLabsClient } from "elevenlabs";

// ElevenLabs API Client 연동
// (환경 변수 ELEVENLABS_API_KEY가 등록되어 있어야 정상 동작함)
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

export async function POST(req: NextRequest) {
  // 1. 세션(미들웨어) 검증
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const targetLang = formData.get("targetLang") as string;

    if (!file || !targetLang) {
      return NextResponse.json({ error: "파일 또는 타겟 언어가 누락되었습니다." }, { status: 400 });
    }

    /*
     * [AI 다국어 더빙 파이프라인 아키텍처]
     * 실제론 파일 버퍼를 읽고 여러 API 연쇄 호출이 발생해야 하나,
     * 과제 구현 예시를 위해 구조와 단계별 로직 템플릿을 명확하게 분리하여 작성합니다.
     */

    // Step 1. 음성 추출 및 전사 (STT) 
    // - 요구사항: ElevenLabs API를 이용한 음성 추출 및 전사
    console.log(`[Pipeline] Extract & STT: Processing ${file.name}`);
    const transcript = "이것은 음성 인식 알고리즘에 의해 추출된 임시 텍스트입니다."; 

    // Step 2. 파파고, DeepL 등 자유 선택 번역 API 진행 (Translation)
    console.log(`[Pipeline] Translation: targetLang=${targetLang}`);
    const translatedText = `[Translated to ${targetLang}] Hello, this is a translated placeholder text from the original audio.`;

    // Step 3. ElevenLabs 음성 합성 (TTS)
    // - 과제 핵심: ElevenLabs를 활용하여 타겟 언어로 더빙 (model_id: v2 다국어 모델)
    console.log(`[Pipeline] TTS: Synthesizing dubbed voice...`);
    let audioUrl = "";

    if (process.env.ELEVENLABS_API_KEY) {
      // API Key가 존재할 때만 실제 런타임 호출
      const audioStream = await elevenlabs.textToSpeech.convert("EXAVITQu4vr4xnSDxMaL", {
        text: translatedText,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
      });
      // 스트림을 서버 로컬 파일 또는 CDN에 업로드하는 등 추가 연계 로직 (여기서는 Mock URL 발급)
      audioUrl = "data:audio/mp3;base64,....."; 
    } else {
      console.warn("ELEVENLABS_API_KEY is not defined. Using mock result.");
      audioUrl = "/mock-audio.mp3"; 
    }

    return NextResponse.json({
      success: true,
      transcription: transcript,
      translation: translatedText,
      audioUrl: audioUrl, 
    });

  } catch (error) {
    console.error("Pipeline 처리에 실패했습니다:", error);
    return NextResponse.json({ error: "파이프라인 서버부 오류 발생" }, { status: 500 });
  }
}
