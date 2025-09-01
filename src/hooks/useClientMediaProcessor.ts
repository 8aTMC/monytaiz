import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ProcessingProgress {
  phase: 'analyzing' | 'encoding' | 'uploading' | 'finalizing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface ProcessedMedia {
  id: string;
  originalFile: File;
  processedFiles: {
    image?: Blob;
    video_480p?: Blob;
    video_720p?: Blob;
    video_1080p?: Blob;
    audio?: Blob;
    thumbnail?: Blob;
  };
  metadata: {
    width: number;
    height: number;
    duration?: number;
    format: string;
    compressionRatio?: number;
    qualityInfo?: {
      [key: string]: {
        size: number;
        bitrate?: string;
        compressionRatio: number;
      };
    };
  };
  tinyPlaceholder: string;
}

interface FFmpegWorkerMessage {
  type: 'ready' | 'progress' | 'complete' | 'error';
  data?: any;
  progress?: number;
  error?: string;
}

export const useClientMediaProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<ProcessedMedia[]>([]);
  const [progress, setProgress] = useState<ProcessingProgress>({
    phase: 'analyzing',
    progress: 0,
    message: 'Starting...'
  });
  
  const { toast } = useToast();
  const ffmpegWorkerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize canvas for image processing
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  // Check if ffmpeg.wasm is supported with extensive logging
  const checkFFmpegSupport = useCallback(() => {
    try {
      const hasWorker = typeof Worker !== 'undefined';
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
      const isCrossOriginIsolated = crossOriginIsolated;
      const hasWebAssembly = typeof WebAssembly !== 'undefined';
      
      console.log('🔍 FFmpeg Support Diagnostic:', {
        hasWorker,
        hasSharedArrayBuffer,
        isCrossOriginIsolated,
        hasWebAssembly,
        userAgent: navigator.userAgent,
        location: window.location.href,
        headers: {
          'Cross-Origin-Embedder-Policy': document.querySelector('meta[http-equiv="Cross-Origin-Embedder-Policy"]')?.getAttribute('content'),
          'Cross-Origin-Opener-Policy': document.querySelector('meta[http-equiv="Cross-Origin-Opener-Policy"]')?.getAttribute('content')
        }
      });
      
      // Additional detailed checks
      if (!hasSharedArrayBuffer) {
        console.warn('❌ SharedArrayBuffer unavailable - requires COOP/COEP headers');
      }
      if (!isCrossOriginIsolated) {
        console.warn('❌ Cross-Origin Isolation disabled - SharedArrayBuffer will not work');
      }
      
      const isSupported = hasWorker && hasSharedArrayBuffer && isCrossOriginIsolated && hasWebAssembly;
      console.log(`🎥 Client-side video processing: ${isSupported ? '✅ AVAILABLE' : '❌ UNAVAILABLE - using server fallback'}`);
      
      return isSupported;
    } catch (error) {
      console.error('❌ FFmpeg support check failed:', error);
      return false;
    }
  }, []);

  // Check video dimensions and file size
  const getVideoInfo = useCallback((file: File): Promise<{ width: number; height: number; duration: number }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        });
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video metadata'));
      };
      
      video.src = url;
    });
  }, []);

  // Validate if we can process this video
  const canProcessVideo = useCallback(async (file: File): Promise<{ canProcess: boolean; reason?: string; info?: any }> => {
    const maxFileSize = 9216 * 1024 * 1024; // 9GB limit (9,216 MB)
    const maxResolution = 4096; // 4K width limit (will be downscaled to 1080p)
    
    if (file.size > maxFileSize) {
      return { 
        canProcess: false, 
        reason: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum: 9,216MB` 
      };
    }

    try {
      const info = await getVideoInfo(file);
      
      if (info.width > maxResolution || info.height > maxResolution) {
        return { 
          canProcess: false, 
          reason: `Resolution too high (${info.width}x${info.height}). Maximum: 4096x4096` 
        };
      }

      if (!checkFFmpegSupport()) {
        return { 
          canProcess: false, 
          reason: 'Client-side video processing unavailable. Server-side processing will be used instead.',
          info 
        };
      }

      return { canProcess: true, info };
    } catch (error) {
      return { 
        canProcess: false, 
        reason: 'Failed to analyze video file' 
      };
    }
  }, [checkFFmpegSupport, getVideoInfo]);

  // Fallback processing - DO NOT USE ORIGINAL FILE
  const processVideoFallback = useCallback(async (file: File): Promise<{
    video_480p?: Blob;
    video_720p?: Blob;
    video_1080p?: Blob;
    thumbnail?: Blob;
    width: number;
    height: number;
    duration?: number;
    compressionRatio: number;
    qualityInfo: any;
  }> => {
    // This should never be called now - we validate before processing
    throw new Error('Video processing fallback should not be used. Use server-side processing instead.');
  }, []);

  // Fallback processing for audio without FFmpeg
  const processAudioFallback = useCallback(async (file: File): Promise<{
    audio?: Blob;
    compressionRatio: number;
    qualityInfo: any;
  }> => {
    console.log('Using fallback audio processing (server-side)');
    
    // For audio fallback, return original file
    return {
      audio: file,
      compressionRatio: 0,
      qualityInfo: {
        audio: { size: file.size, bitrate: 'original' }
      }
    };
  }, []);

  // Create tiny base64 placeholder
  const createTinyPlaceholder = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = getCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
        return;
      }

      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          canvas.width = 8;
          canvas.height = 8;
          ctx.drawImage(img, 0, 0, 8, 8);
          resolve(canvas.toDataURL('image/png'));
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => {
          // Generate colored placeholder based on filename
          canvas.width = 8;
          canvas.height = 8;
          const hash = file.name.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0);
          const hue = Math.abs(hash) % 360;
          ctx.fillStyle = `hsl(${hue}, 30%, 80%)`;
          ctx.fillRect(0, 0, 8, 8);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = URL.createObjectURL(file);
      } else {
        // Non-image files get a simple colored square
        canvas.width = 8;
        canvas.height = 8;
        const hash = file.name.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        const hue = Math.abs(hash) % 360;
        ctx.fillStyle = `hsl(${hue}, 50%, 60%)`;
        ctx.fillRect(0, 0, 8, 8);
        resolve(canvas.toDataURL('image/png'));
      }
    });
  }, [getCanvas]);

  // Process image using Canvas/WebCodecs with WebP fallback
  const processImage = useCallback(async (file: File): Promise<{ blob: Blob; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = getCanvas();
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }

        // Calculate optimal size (max 1920px on longest side)
        const maxSize = 1920;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        const width = Math.round(img.width * ratio);
        const height = Math.round(img.height * ratio);

        canvas.width = width;
        canvas.height = height;

        // Draw with quality optimizations
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP encoding first (best compression)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ blob, width, height });
          } else {
            // Fallback to high-quality JPEG
            canvas.toBlob((jpegBlob) => {
              if (jpegBlob) {
                resolve({ blob: jpegBlob, width, height });
              } else {
                reject(new Error('Failed to encode image'));
              }
            }, 'image/jpeg', 0.85);
          }
        }, 'image/webp', 0.80);

        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }, [getCanvas]);

  // Initialize FFmpeg worker
  const initFFmpegWorker = useCallback((): Promise<Worker> => {
    return new Promise((resolve, reject) => {
      if (ffmpegWorkerRef.current) {
        resolve(ffmpegWorkerRef.current);
        return;
      }

      try {
        // Create enhanced worker with ffmpeg.wasm for video/audio processing
        const workerCode = `
          import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/esm/index.js';
          import { toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

          let ffmpeg = null;
          let initialized = false;

          self.onmessage = async function(e) {
            const { type, data } = e.data;
            
            try {
              if (type === 'init') {
                if (!initialized) {
                  ffmpeg = new FFmpeg();
                  ffmpeg.on('progress', ({ progress }) => {
                    self.postMessage({ type: 'progress', progress: Math.round(progress * 100) });
                  });

                  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm';
                  await ffmpeg.load({
                    coreURL: await toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
                    wasmURL: await toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm'),
                  });
                  initialized = true;
                }
                self.postMessage({ type: 'ready' });
                
              } else if (type === 'process_video') {
                const { fileData, fileName } = data;
                
                // Write input file (try different extensions based on original)
                const inputExt = fileName.split('.').pop().toLowerCase();
                const inputFile = 'input.' + (inputExt || 'mp4');
                await ffmpeg.writeFile(inputFile, new Uint8Array(fileData));
                
                const outputs = [];
                const qualityInfo = {};
                
                // Extract thumbnail first (1 second mark or first frame)
                try {
                  await ffmpeg.exec([
                    '-i', inputFile,
                    '-ss', '00:00:01',
                    '-vframes', '1',
                    '-q:v', '2',
                    '-vf', 'scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2',
                    '-y',
                    'thumbnail.jpg'
                  ]);
                  
                  const thumbnailData = await ffmpeg.readFile('thumbnail.jpg');
                  outputs.push({ quality: 'thumbnail', data: thumbnailData });
                } catch (thumbError) {
                  console.warn('Thumbnail extraction failed, trying first frame');
                  try {
                    await ffmpeg.exec([
                      '-i', inputFile,
                      '-vframes', '1',
                      '-q:v', '2',
                      '-vf', 'scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2',
                      '-y',
                      'thumbnail.jpg'
                    ]);
                    const thumbnailData = await ffmpeg.readFile('thumbnail.jpg');
                    outputs.push({ quality: 'thumbnail', data: thumbnailData });
                  } catch {
                    console.warn('Both thumbnail extraction methods failed');
                  }
                }
                
                // 480p WebM (default quality - maximum compression)
                await ffmpeg.exec([
                  '-i', inputFile,
                  '-c:v', 'libvpx-vp9',
                  '-crf', '32',
                  '-b:v', '500k',
                  '-vf', 'scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2',
                  '-c:a', 'libopus',
                  '-b:a', '64k',
                  '-deadline', 'good',
                  '-cpu-used', '1',
                  '-row-mt', '1',
                  'output_480p.webm'
                ]);
                
                const output480p = await ffmpeg.readFile('output_480p.webm');
                outputs.push({ quality: '480p', data: output480p });
                qualityInfo['480p'] = { size: output480p.byteLength, bitrate: '500k' };
                
                // 720p WebM
                await ffmpeg.exec([
                  '-i', inputFile,
                  '-c:v', 'libvpx-vp9',
                  '-crf', '30',
                  '-b:v', '1000k',
                  '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
                  '-c:a', 'libopus',
                  '-b:a', '96k',
                  '-deadline', 'good',
                  '-cpu-used', '1',
                  '-row-mt', '1',
                  'output_720p.webm'
                ]);
                
                const output720p = await ffmpeg.readFile('output_720p.webm');
                outputs.push({ quality: '720p', data: output720p });
                qualityInfo['720p'] = { size: output720p.byteLength, bitrate: '1000k' };
                
                // 1080p WebM
                await ffmpeg.exec([
                  '-i', inputFile,
                  '-c:v', 'libvpx-vp9',
                  '-crf', '28',
                  '-b:v', '2000k',
                  '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
                  '-c:a', 'libopus',
                  '-b:a', '128k',
                  '-deadline', 'good',
                  '-cpu-used', '1',
                  '-row-mt', '1',
                  'output_1080p.webm'
                ]);
                
                const output1080p = await ffmpeg.readFile('output_1080p.webm');
                outputs.push({ quality: '1080p', data: output1080p });
                qualityInfo['1080p'] = { size: output1080p.byteLength, bitrate: '2000k' };
                
                // Get video metadata
                try {
                  await ffmpeg.exec(['-i', inputFile, '-f', 'null', '-']);
                } catch (e) {
                  // Expected to fail, we just want the metadata from stderr
                }
                
                self.postMessage({ 
                  type: 'complete', 
                  data: { 
                    outputs,
                    qualityInfo,
                    metadata: { width: 1920, height: 1080, format: 'webm' }
                  }
                });
                
              } else if (type === 'process_audio') {
                const { fileData, fileName } = data;
                
                // Detect input format and use appropriate extension
                const inputExt = fileName.split('.').pop().toLowerCase();
                const inputFile = 'input.' + (inputExt || 'mp3');
                await ffmpeg.writeFile(inputFile, new Uint8Array(fileData));
                
                // Convert to WebM with Opus codec (maximum compression for audio)
                await ffmpeg.exec([
                  '-i', inputFile,
                  '-c:a', 'libopus',
                  '-b:a', '64k',
                  '-application', 'voip',
                  '-vbr', 'on',
                  '-compression_level', '10',
                  'output.webm'
                ]);
                
                const outputData = await ffmpeg.readFile('output.webm');
                
                self.postMessage({ 
                  type: 'complete', 
                  data: { 
                    output: outputData,
                    metadata: { width: 800, height: 800, format: 'webm' },
                    qualityInfo: { audio: { size: outputData.byteLength, bitrate: '64k' } }
                  }
                });
              }
              
            } catch (error) {
              self.postMessage({ type: 'error', error: error.message });
            }
          };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
        
        worker.onmessage = (e: MessageEvent<FFmpegWorkerMessage>) => {
          if (e.data.type === 'ready') {
            ffmpegWorkerRef.current = worker;
            resolve(worker);
          } else if (e.data.type === 'error') {
            reject(new Error(e.data.error || 'FFmpeg initialization failed'));
          }
        };

        worker.onerror = (error) => {
          reject(new Error(`Worker error: ${error.message}`));
        };

        // Initialize FFmpeg
        worker.postMessage({ type: 'init' });
        
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  // Process video using FFmpeg worker with multiple qualities and thumbnail
  const processVideo = useCallback(async (file: File): Promise<{
    video_480p?: Blob;
    video_720p?: Blob;
    video_1080p?: Blob;
    thumbnail?: Blob;
    width: number;
    height: number;
    duration?: number;
    compressionRatio: number;
    qualityInfo: any;
  }> => {
    const worker = await initFFmpegWorker();
    
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const fileData = fileReader.result as ArrayBuffer;
        
        const onMessage = (e: MessageEvent<FFmpegWorkerMessage>) => {
          if (e.data.type === 'progress') {
            setProgress(prev => ({
              ...prev,
              progress: Math.min(e.data.progress || 0, 90),
              message: `Encoding video... ${e.data.progress || 0}%`
            }));
          } else if (e.data.type === 'complete') {
            worker.removeEventListener('message', onMessage);
            const { outputs, metadata, qualityInfo } = e.data.data;
            
            const result: any = {
              width: metadata.width,
              height: metadata.height,
              duration: metadata.duration,
              qualityInfo: qualityInfo || {},
              compressionRatio: 0
            };
            
            let totalProcessedSize = 0;
            let smallestSize = file.size;
            
            outputs.forEach((output: any) => {
              if (output.quality === 'thumbnail') {
                result.thumbnail = new Blob([output.data], { type: 'image/jpeg' });
              } else if (output.quality === '480p') {
                result.video_480p = new Blob([output.data], { type: 'video/webm' });
                totalProcessedSize += output.data.byteLength;
                smallestSize = Math.min(smallestSize, output.data.byteLength);
              } else if (output.quality === '720p') {
                result.video_720p = new Blob([output.data], { type: 'video/webm' });
                totalProcessedSize += output.data.byteLength;
              } else if (output.quality === '1080p') {
                result.video_1080p = new Blob([output.data], { type: 'video/webm' });
                totalProcessedSize += output.data.byteLength;
              }
            });
            
            // Calculate compression ratio based on smallest variant
            result.compressionRatio = Math.round(((file.size - smallestSize) / file.size) * 100);
            
            resolve(result);
          } else if (e.data.type === 'error') {
            worker.removeEventListener('message', onMessage);
            reject(new Error(e.data.error || 'Video processing failed'));
          }
        };
        
        worker.addEventListener('message', onMessage);
        worker.postMessage({
          type: 'process_video',
          data: {
            fileData,
            fileName: file.name
          }
        });
      };
      
      fileReader.onerror = () => reject(new Error('Failed to read file'));
      fileReader.readAsArrayBuffer(file);
    });
  }, [initFFmpegWorker]);

  // Process audio using FFmpeg worker
  const processAudio = useCallback(async (file: File): Promise<{
    audio?: Blob;
    compressionRatio: number;
    qualityInfo: any;
  }> => {
    const worker = await initFFmpegWorker();
    
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const fileData = fileReader.result as ArrayBuffer;
        
        const onMessage = (e: MessageEvent<FFmpegWorkerMessage>) => {
          if (e.data.type === 'progress') {
            setProgress(prev => ({
              ...prev,
              progress: Math.min(e.data.progress || 0, 90),
              message: `Encoding audio... ${e.data.progress || 0}%`
            }));
          } else if (e.data.type === 'complete') {
            worker.removeEventListener('message', onMessage);
            const { output, metadata, qualityInfo } = e.data.data;
            
            const audioBlob = new Blob([output], { type: 'audio/webm' });
            const compressionRatio = Math.round(((file.size - output.byteLength) / file.size) * 100);
            
            resolve({
              audio: audioBlob,
              compressionRatio,
              qualityInfo: qualityInfo || {}
            });
          } else if (e.data.type === 'error') {
            worker.removeEventListener('message', onMessage);
            reject(new Error(e.data.error || 'Audio processing failed'));
          }
        };
        
        worker.addEventListener('message', onMessage);
        worker.postMessage({
          type: 'process_audio',
          data: {
            fileData,
            fileName: file.name
          }
        });
      };
      
      fileReader.onerror = () => reject(new Error('Failed to read audio file'));
      fileReader.readAsArrayBuffer(file);
    });
  }, [initFFmpegWorker]);

  // Main processing function
  const processFiles = useCallback(async (files: File[]): Promise<ProcessedMedia[]> => {
    if (isProcessing) return [];
    
    setIsProcessing(true);
    const processedFiles: ProcessedMedia[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileProgress = (i / files.length) * 100;
        
        setProgress({
          phase: 'analyzing',
          progress: fileProgress,
          message: `Processing ${file.name} (${i + 1}/${files.length})`
        });

        // Create tiny placeholder first
        const tinyPlaceholder = await createTinyPlaceholder(file);
        
        const processedMedia: ProcessedMedia = {
          id: `${Date.now()}-${i}`,
          originalFile: file,
          processedFiles: {},
          metadata: { width: 0, height: 0, format: '' },
          tinyPlaceholder
        };

        if (file.type.startsWith('image/')) {
          setProgress({
            phase: 'encoding',
            progress: fileProgress + 10,
            message: `Encoding image ${file.name}...`
          });

          try {
            const { blob, width, height } = await processImage(file);
            processedMedia.processedFiles.image = blob;
            processedMedia.metadata = { width, height, format: 'webp' };
          } catch (error) {
            console.warn('Image processing failed, using original:', error);
            processedMedia.processedFiles.image = file;
            processedMedia.metadata = { width: 1920, height: 1080, format: 'original' };
          }
          
        } else if (file.type.startsWith('video/')) {
          const ffmpegSupported = checkFFmpegSupport();
          
          setProgress({
            phase: 'encoding',
            progress: fileProgress + 10,
            message: ffmpegSupported 
              ? `Converting video to WebM (480p, 720p, 1080p)...`
              : `Preparing video for server-side processing...`
          });

          try {
            let videoResult;
            if (ffmpegSupported) {
              videoResult = await processVideo(file);
            } else {
              videoResult = await processVideoFallback(file);
            }
            
            processedMedia.processedFiles.video_480p = videoResult.video_480p;
            processedMedia.processedFiles.video_720p = videoResult.video_720p;
            processedMedia.processedFiles.video_1080p = videoResult.video_1080p;
            processedMedia.processedFiles.thumbnail = videoResult.thumbnail;
            processedMedia.metadata = {
              width: videoResult.width,
              height: videoResult.height,
              duration: videoResult.duration,
              format: ffmpegSupported ? 'webm' : 'original',
              compressionRatio: videoResult.compressionRatio,
              qualityInfo: videoResult.qualityInfo
            };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Video processing failed';
            throw new Error(`Cannot process video: ${errorMsg}. Video format may not be supported or file may be corrupted.`);
          }
          
        } else if (file.type.startsWith('audio/')) {
          const ffmpegSupported = checkFFmpegSupport();
          
          setProgress({
            phase: 'encoding',
            progress: fileProgress + 10,
            message: ffmpegSupported 
              ? `Converting audio to WebM/Opus...`
              : `Preparing audio for server-side processing...`
          });

          try {
            let audioResult;
            if (ffmpegSupported) {
              audioResult = await processAudio(file);
            } else {
              audioResult = await processAudioFallback(file);
            }
            
            processedMedia.processedFiles.audio = audioResult.audio;
            processedMedia.metadata = {
              width: 800,
              height: 800,
              format: ffmpegSupported ? 'webm' : 'original',
              compressionRatio: audioResult.compressionRatio,
              qualityInfo: audioResult.qualityInfo
            };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Audio processing failed';
            throw new Error(`Cannot process audio: ${errorMsg}. Audio format may not be supported or file may be corrupted.`);
          }
        }

        processedFiles.push(processedMedia);
      }

      setProgress({
        phase: 'complete',
        progress: 100,
        message: 'Processing complete!'
      });

      setProcessingQueue(processedFiles);
      return processedFiles;
      
    } catch (error) {
      console.error('File processing error:', error);
      setProgress({
        phase: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Processing failed'
      });
      
      toast({
        title: "Processing Error",
        description: "Some files couldn't be processed. They'll be uploaded as originals.",
        variant: "destructive"
      });
      
      return [];
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, createTinyPlaceholder, processImage, checkFFmpegSupport, processVideo, processAudio, toast]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (ffmpegWorkerRef.current) {
      ffmpegWorkerRef.current.terminate();
      ffmpegWorkerRef.current = null;
    }
    setProcessingQueue([]);
  }, []);

  return {
    processFiles,
    isProcessing,
    progress,
    processingQueue,
    checkFFmpegSupport,
    canProcessVideo,
    cleanup
  };
};
