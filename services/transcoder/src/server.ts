import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { transcodeToWebm } from './transcode';
import { downloadFile, uploadFile, updateMediaRecord } from './supabase';
import { logger } from './logger';

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '20mb' }));
app.use(cors());

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Main transcoding endpoint
app.post('/jobs/transcode', async (req, res) => {
  const startTime = Date.now();
  const { bucket, path: srcPath, mediaId, crf } = req.body;
  
  logger.info('Transcode job started', { 
    mediaId, 
    bucket, 
    srcPath, 
    crf: crf || 30 
  });

  // Validate request
  if (!bucket || !srcPath || !mediaId) {
    logger.warn('Invalid request parameters', { bucket, srcPath, mediaId });
    return res.status(400).json({ 
      ok: false, 
      error: 'Missing required parameters: bucket, path, mediaId' 
    });
  }

  let workDir: string | null = null;

  try {
    // Update status to processing
    await updateMediaRecord(mediaId, {
      processing_status: 'processing'
    });

    // Create temporary working directory
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcode-'));
    logger.info('Created working directory', { workDir });

    const srcFile = path.join(workDir, 'input');
    
    // Download source file
    logger.info('Downloading source file...');
    const fileData = await downloadFile(bucket, srcPath);
    await fs.writeFile(srcFile, Buffer.from(fileData));
    logger.info('Source file downloaded', { size: fileData.byteLength });

    // Transcode the video
    logger.info('Starting transcoding...');
    const result = await transcodeToWebm(srcFile, workDir, crf ?? Number(process.env.DEFAULT_CRF ?? 30));
    
    // Prepare output paths
    const baseName = srcPath.replace(/^raw\//, 'processed/').replace(/\.[^.]+$/, '');
    const webmOutputPath = `${baseName}.webm`;
    const posterOutputPath = `${baseName}.jpg`;

    // Upload processed files
    logger.info('Uploading processed files...');
    const webmBuffer = await fs.readFile(result.webmPath);
    const posterBuffer = await fs.readFile(result.posterPath);

    await Promise.all([
      uploadFile(bucket, webmOutputPath, webmBuffer, 'video/webm'),
      uploadFile(bucket, posterOutputPath, posterBuffer, 'image/jpeg')
    ]);

    // Update database record with final results
    await updateMediaRecord(mediaId, {
      processing_status: 'processed',
      processed_path: webmOutputPath,
      thumbnail_path: posterOutputPath,
      width: result.info.width,
      height: result.info.height,
      duration_seconds: Math.round(result.info.duration),
      optimized_size_bytes: result.webmSize,
      processed_at: new Date().toISOString()
    });

    const processingTime = Date.now() - startTime;
    logger.info('Transcode job completed successfully', { 
      mediaId, 
      processingTime: `${processingTime}ms`,
      compressionRatio: `${result.compressionRatio}%`,
      originalSize: result.originalSize,
      webmSize: result.webmSize
    });

    res.status(200).json({
      ok: true,
      mediaId,
      processingTime,
      result: {
        webmPath: webmOutputPath,
        posterPath: posterOutputPath,
        compressionRatio: result.compressionRatio,
        originalSize: result.originalSize,
        webmSize: result.webmSize,
        dimensions: `${result.info.width}x${result.info.height}`,
        duration: result.info.duration
      }
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('Transcode job failed', { 
      mediaId, 
      processingTime: `${processingTime}ms`,
      error: error.message,
      stack: error.stack 
    });

    // Update database with error status
    try {
      await updateMediaRecord(mediaId, {
        processing_status: 'failed',
        processing_error: error.message
      });
    } catch (dbError: any) {
      logger.error('Failed to update error status in database', { 
        mediaId, 
        dbError: dbError.message 
      });
    }

    res.status(500).json({
      ok: false,
      mediaId,
      processingTime,
      error: error.message
    });

  } finally {
    // Cleanup temporary directory
    if (workDir) {
      try {
        await fs.rm(workDir, { recursive: true, force: true });
        logger.info('Cleaned up working directory', { workDir });
      } catch (cleanupError: any) {
        logger.warn('Failed to cleanup working directory', { 
          workDir, 
          error: cleanupError.message 
        });
      }
    }
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { 
    error: error.message, 
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    ok: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', { url: req.url, method: req.method });
  res.status(404).json({
    ok: false,
    error: 'Route not found'
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(port, () => {
  logger.info('Video transcoder service started', {
    port,
    nodeEnv: process.env.NODE_ENV,
    pid: process.pid
  });
});

export default app;