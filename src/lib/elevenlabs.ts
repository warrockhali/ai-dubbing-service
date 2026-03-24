import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('[ElevenLabs] ELEVENLABS_API_KEY 환경변수가 설정되지 않았습니다.');
}

export const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// 지원 언어 목록 (ElevenLabs 다국어 모델 기준)
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', locale: 'en' },
  ja: { name: 'Japanese', locale: 'ja' },
  es: { name: 'Spanish', locale: 'es' },
  zh: { name: 'Chinese', locale: 'zh' },
  ko: { name: 'Korean', locale: 'ko' },
  fr: { name: 'French', locale: 'fr' },
  de: { name: 'German', locale: 'de' },
} as const;

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// 파일 확장자 → MIME 타입 매핑 (ElevenLabs STT 지원 포맷)
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
  };
  return mimeMap[ext ?? ''] ?? 'application/octet-stream';
}

/**
 * [STT] 오디오/비디오 파일을 텍스트로 전사합니다.
 * ElevenLabs의 Scribe v1 모델을 사용하며, 90+ 언어를 지원합니다.
 * File 객체를 직접 전달하여 불필요한 Buffer 변환으로 인한 데이터 손상을 방지합니다.
 */
export async function transcribeAudio(
  audioFile: File,
): Promise<{ text: string; languageCode: string }> {
  const result = await elevenLabsClient.speechToText.convert({
    file: audioFile,
    modelId: 'scribe_v1',
    tagAudioEvents: false,
  });

  if (!result.text) {
    console.error('[STT] API 응답 원본:', JSON.stringify(result, null, 2));
    throw new Error('[STT] 음성 전사 결과를 반환받지 못했습니다. 파일 포맷이나 내용을 확인해주세요.');
  }

  return {
    text: result.text,
    languageCode: result.languageCode ?? 'unknown',
  };
}

/**
 * [TTS] 번역된 텍스트를 음성으로 합성합니다.
 * ElevenLabs의 eleven_multilingual_v2 모델로 다국어 TTS를 수행합니다.
 */
export async function synthesizeSpeech(
  text: string,
  targetLanguage: SupportedLanguageCode,
  voiceId: string = 'EXAVITQu4vr4xnSDxMaL', // ElevenLabs 기본 목소리(Sarah)
): Promise<Buffer> {
  const audioStream = await elevenLabsClient.textToSpeech.convert(voiceId, {
    text,
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    languageCode: SUPPORTED_LANGUAGES[targetLanguage].locale,
  });

  // ReadableStream을 Buffer로 변환
  const chunks: Uint8Array[] = [];
  const reader = audioStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c)));
}
