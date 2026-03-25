import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import Ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';

// @ffmpeg-installer로 번들된 ffmpeg 경로를 fluent-ffmpeg에 등록
Ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * 영상/오디오 파일에서 오디오 트랙을 MP3로 추출합니다.
 * ElevenLabs STT가 특정 코덱이나 AI 생성 영상을 거부하는 문제를 
 * ffmpeg 리인코딩으로 해결합니다.
 */
export async function extractAudioToMp3(inputFile: File, cropSeconds?: number): Promise<File> {
  const inputId = randomUUID();
  const ext = inputFile.name.split('.').pop() ?? 'mp4';
  const inputPath = join(tmpdir(), `${inputId}_input.${ext}`);
  const outputPath = join(tmpdir(), `${inputId}_output.mp3`);

  try {
    // 1. 업로드된 File 객체를 임시 파일로 저장
    const inputBytes = Buffer.from(await inputFile.arrayBuffer());
    await writeFile(inputPath, inputBytes);

    // 2. ffmpeg으로 오디오 트랙만 MP3로 추출 (16kHz 모노, STT 최적화 설정)
    await new Promise<void>((resolve, reject) => {
      const cmd = Ffmpeg(inputPath);
      if (cropSeconds) {
        cmd.setDuration(cropSeconds);
      }
      cmd.outputOptions([
          '-vn',          // 비디오 스트림 제거
          '-ar', '16000', // 샘플레이트 16kHz (STT 최적화)
          '-ac', '1',     // 모노 채널 (불필요한 스테레오 데이터 제거)
          '-ab', '64k',   // 비트레이트
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`ffmpeg 오디오 추출 실패: ${err.message}`)))
        .run();
    });

    // 3. 추출된 MP3를 읽어 File 객체로 반환
    const outputBytes = await readFile(outputPath);
    const outputFile = new File([outputBytes], 'extracted_audio.mp3', { type: 'audio/mpeg' });
    return outputFile;

  } finally {
    // 임시 파일 정리 (에러 발생 시에도 반드시 실행)
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * 원본 비디오에 새로운 오디오(더빙버전)를 씌웁니다 (Muxing).
 */
export async function mergeAudioToVideo(originalVideoFile: File, newAudioBuffer: Buffer, cropSeconds?: number): Promise<Buffer> {
  const inputId = randomUUID();
  const videoExt = originalVideoFile.name.split('.').pop() ?? 'mp4';
  const videoPath = join(tmpdir(), `${inputId}_video.${videoExt}`);
  const audioPath = join(tmpdir(), `${inputId}_audio.mp3`);
  const outputPath = join(tmpdir(), `${inputId}_output.mp4`);

  try {
    const videoBytes = Buffer.from(await originalVideoFile.arrayBuffer());
    await writeFile(videoPath, videoBytes);
    await writeFile(audioPath, newAudioBuffer);

    await new Promise<void>((resolve, reject) => {
      const cmd = Ffmpeg()
        .input(videoPath)
        .input(audioPath);
        
      if (cropSeconds) {
        cmd.setDuration(cropSeconds);
      }
      
      cmd.outputOptions([
          '-map', '0:v:0',     // 첫 번째 스트림(비디오)
          '-map', '1:a:0',     // 두 번째 스트림(새로운 오디오)
          '-c:v', 'copy',      // 비디오 인코딩 생략 (속도 최적화)
          '-c:a', 'aac',       // 오디오 포맷 MP4 범용 AAC 맞춤
          '-shortest',         // 비디오 길이에 오디오 맞춤 (오디오가 더 길면 자름)
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`비디오/오디오 병합 실패: ${err.message}`)))
        .run();
    });

    return await readFile(outputPath);
  } finally {
    await unlink(videoPath).catch(() => {});
    await unlink(audioPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
