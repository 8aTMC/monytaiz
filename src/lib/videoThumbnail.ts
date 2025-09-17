/**
 * Client-side video thumbnail generation utility
 */

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  timePosition?: number; // Time in seconds to capture thumbnail
}

export type ThumbnailError = 
  | 'video_corrupted' 
  | 'video_load_failed' 
  | 'invalid_metadata' 
  | 'canvas_error' 
  | 'timeout' 
  | 'unknown';

/**
 * Generate a thumbnail from a video file using HTML5 video and canvas
 */
export const generateVideoThumbnail = (
  file: File, 
  options: ThumbnailOptions = {}
): Promise<{ blob: Blob; dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const TIMEOUT_MS = 5000; // 5 second timeout for faster fallback
    let timeoutId: NodeJS.Timeout;
    const {
      width = 320,
      height = 180,
      quality = 0.8,
      timePosition = 1 // Capture at 1 second
    } = options;

    // Create video element
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      if (video.src) URL.revokeObjectURL(video.src);
      video.remove();
    };

    const onError = () => {
      cleanup();
      const error = new Error('Failed to load video for thumbnail generation - file may be corrupted') as Error & { type: ThumbnailError };
      error.type = 'video_corrupted';
      reject(error);
    };

    const onLoadedMetadata = () => {
      try {
        // Validate video duration
        if (!video.duration || video.duration <= 0 || !isFinite(video.duration)) {
          const error = new Error('Invalid video duration - file appears to be corrupted') as Error & { type: ThumbnailError };
          error.type = 'invalid_metadata';
          throw error;
        }
        
        // Set time position (but not beyond video duration)
        const seekTime = Math.min(timePosition, Math.max(0, video.duration - 0.1));
        video.currentTime = seekTime;
      } catch (error) {
        cleanup();
        const wrappedError = error instanceof Error && 'type' in error 
          ? error 
          : new Error('Failed to process video metadata') as Error & { type: ThumbnailError };
        if (!('type' in wrappedError)) {
          (wrappedError as any).type = 'invalid_metadata';
        }
        reject(wrappedError);
      }
    };

    const onSeeked = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          const error = new Error('Could not get canvas context') as Error & { type: ThumbnailError };
          error.type = 'canvas_error';
          throw error;
        }

        // Calculate dimensions maintaining aspect ratio
        const videoAspect = video.videoWidth / video.videoHeight;
        const targetAspect = width / height;

        let drawWidth = width;
        let drawHeight = height;

        if (videoAspect > targetAspect) {
          // Video is wider - fit to height
          drawHeight = height;
          drawWidth = height * videoAspect;
        } else {
          // Video is taller - fit to width
          drawWidth = width;
          drawHeight = width / videoAspect;
        }

        canvas.width = width;
        canvas.height = height;

        // Fill with black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Center the video frame
        const offsetX = (width - drawWidth) / 2;
        const offsetY = (height - drawHeight) / 2;

        // Draw video frame to canvas
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              const error = new Error('Failed to create thumbnail blob') as Error & { type: ThumbnailError };
              error.type = 'canvas_error';
              reject(error);
              return;
            }

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            cleanup();
            resolve({ blob, dataUrl });
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        cleanup();
        const wrappedError = error instanceof Error && 'type' in error 
          ? error 
          : new Error('Thumbnail generation failed') as Error & { type: ThumbnailError };
        if (!('type' in wrappedError)) {
          (wrappedError as any).type = 'unknown';
        }
        reject(wrappedError);
      }
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      cleanup();
      const error = new Error('Video thumbnail generation timed out - file may be corrupted') as Error & { type: ThumbnailError };
      error.type = 'timeout';
      reject(error);
    }, TIMEOUT_MS);

    // Set up event listeners
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    // Start loading video
    try {
      video.src = URL.createObjectURL(file);
    } catch (error) {
      cleanup();
      const wrappedError = new Error('Failed to create video URL - file may be corrupted') as Error & { type: ThumbnailError };
      wrappedError.type = 'video_load_failed';
      reject(wrappedError);
    }
  });
};