/**
 * Client-side video thumbnail generation utility
 */

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  timePosition?: number; // Time in seconds to capture thumbnail
}

/**
 * Generate a thumbnail from a video file using HTML5 video and canvas
 */
export const generateVideoThumbnail = (
  file: File, 
  options: ThumbnailOptions = {}
): Promise<{ blob: Blob; dataUrl: string }> => {
  return new Promise((resolve, reject) => {
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
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      URL.revokeObjectURL(video.src);
    };

    const onError = () => {
      cleanup();
      reject(new Error('Failed to load video for thumbnail generation'));
    };

    const onLoadedMetadata = () => {
      // Set time position (but not beyond video duration)
      const seekTime = Math.min(timePosition, video.duration - 0.1);
      video.currentTime = seekTime;
    };

    const onSeeked = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
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
              reject(new Error('Failed to create thumbnail blob'));
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
        reject(error);
      }
    };

    // Set up event listeners
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    // Start loading video
    video.src = URL.createObjectURL(file);
  });
};