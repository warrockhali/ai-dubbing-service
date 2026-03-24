import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('[ElevenLabs] ELEVENLABS_API_KEY 환경변수가 설정되지 않았습니다.');
}

export const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// 지원 언어 목록 (ElevenLabs 다국어 모델 기준)
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', locale: 'en-US' },
  ja: { name: 'Japanese', locale: 'ja-JP' },
  es: { name: 'Spanish', locale: 'es-ES' },
  zh: { name: 'Chinese', locale: 'zh-CN' },
  ko: { name: 'Korean', locale: 'ko-KR' },
  fr: { name: 'French', locale: 'fr-FR' },
  de: { name: 'German', locale: 'de-DE' },
} as const;

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES;

/**
 * [STT] 오디오/비디오 파일을 텍스트로 전사합니다.
 * ElevenLabs의 Scribe v2 모델을 사용하며, 90+ 언어를 지원합니다.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string = 'upload.mp3',
): Promise<{ text: string; languageCode: string }> {
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

  const result = await elevenLabsClient.speechToText.convert({
    audio: audioBlob,
    model_id: 'scribe_v1', // 최신 전사 모델
    tag_audio_events: false,
  });

  return {
    text: result.text,
    languageCode: result.language_code ?? 'unknown',
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
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
    language_code: SUPPORTED_LANGUAGES[targetLanguage].locale,
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
