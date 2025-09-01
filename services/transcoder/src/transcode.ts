import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { promises as fs } from "fs";
import path from "path";
import { logger } from "./logger";

// Set FFmpeg binary paths
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath?.path) {
  ffmpeg.setFfprobePath(ffprobePath.path);
}

export interface MediaInfo {
  width: number;
  height: number;
  duration: number;
  bitrate?: number;
  codec?: string;
}

export interface TranscodeResult {
  webmPath: string;
  posterPath: string;
  info: MediaInfo;
  originalSize: number;
  webmSize: number;
  compressionRatio: number;
}

export async function getMediaInfo(inputPath: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        logger.error('FFprobe error:', err);
        return reject(err);
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        return reject(new Error('No video stream found'));
      }

      resolve({
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        duration: metadata.format.duration || 0,
        bitrate: metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) : undefined,
        codec: videoStream.codec_name
      });
    });
  });
}

export async function transcodeToWebm(
  inputPath: string, 
  outputDir: string, 
  crf: number = 30
): Promise<TranscodeResult> {
  const webmPath = path.join(outputDir, 'output.webm');
  const posterPath = path.join(outputDir, 'poster.jpg');

  // Get original file size and info
  const originalStats = await fs.stat(inputPath);
  const originalSize = originalStats.size;
  const mediaInfo = await getMediaInfo(inputPath);

  logger.info('Starting transcode', {
    input: inputPath,
    output: webmPath,
    originalSize,
    dimensions: `${mediaInfo.width}x${mediaInfo.height}`,
    duration: mediaInfo.duration,
    crf
  });

  // Transcode to WebM
  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .outputOptions([
        '-c:v libvpx-vp9',
        '-b:v 0',
        `-crf ${crf}`,
        '-row-mt 1',
        '-g 240',
        '-pix_fmt yuv420p',
        `-vf scale='min(1920,iw)':'-2':flags=lanczos`,
        '-c:a libopus',
        '-b:a 96k',
        '-ac 2',
        '-ar 48000',
        '-movflags +faststart'
      ])
      .on('start', (commandLine) => {
        logger.info('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        logger.debug('Transcode progress:', {
          percent: progress.percent,
          currentFps: progress.currentFps,
          targetSize: progress.targetSize
        });
      })
      .on('end', () => {
        logger.info('WebM transcode completed');
        resolve();
      })
      .on('error', (err) => {
        logger.error('WebM transcode error:', err);
        reject(err);
      });

    command.save(webmPath);
  });

  // Generate poster frame at 1 second
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(1) // Seek to 1 second
      .outputOptions([
        '-vframes 1',
        '-q:v 2',
        '-f image2'
      ])
      .on('end', () => {
        logger.info('Poster generation completed');
        resolve();
      })
      .on('error', (err) => {
        logger.error('Poster generation error:', err);
        reject(err);
      })
      .save(posterPath);
  });

  // Calculate compression ratio
  const webmStats = await fs.stat(webmPath);
  const webmSize = webmStats.size;
  const compressionRatio = Math.round(((originalSize - webmSize) / originalSize) * 100);

  logger.info('Transcode completed', {
    originalSize,
    webmSize,
    compressionRatio: `${compressionRatio}%`,
    savedBytes: originalSize - webmSize
  });

  return {
    webmPath,
    posterPath,
    info: mediaInfo,
    originalSize,
    webmSize,
    compressionRatio
  };
}