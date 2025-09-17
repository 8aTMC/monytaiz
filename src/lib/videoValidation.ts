/**
 * Video corruption detection utility
 */

export interface VideoValidationResult {
  isValid: boolean;
  isCorrupted: boolean;
  error?: string;
  errorType?: 'corruption' | 'format' | 'timeout' | 'metadata';
}

/**
 * Validate a video file to detect corruption
 */
export const validateVideoFile = (
  file: File,
  options: { timeoutMs?: number } = {}
): Promise<VideoValidationResult> => {
  return new Promise((resolve) => {
    const { timeoutMs = 8000 } = options;
    
    // Create video element for validation
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    
    let timeoutId: NodeJS.Timeout;
    let hasResolved = false;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('seeked', onSeeked);
      if (video.src) URL.revokeObjectURL(video.src);
      video.remove();
    };
    
    const resolveOnce = (result: VideoValidationResult) => {
      if (hasResolved) return;
      hasResolved = true;
      cleanup();
      resolve(result);
    };
    
    // Timeout handler
    timeoutId = setTimeout(() => {
      resolveOnce({
        isValid: false,
        isCorrupted: true,
        error: 'Video validation timed out - file may be corrupted',
        errorType: 'timeout'
      });
    }, timeoutMs);
    
    // Error handler - immediate corruption detection
    const onError = () => {
      resolveOnce({
        isValid: false,
        isCorrupted: true,
        error: 'Failed to load video - file appears to be corrupted',
        errorType: 'corruption'
      });
    };
    
    // Metadata loaded - check basic properties
    const onLoadedMetadata = () => {
      try {
        // Check for invalid duration
        if (!video.duration || video.duration <= 0 || !isFinite(video.duration)) {
          resolveOnce({
            isValid: false,
            isCorrupted: true,
            error: 'Video has invalid duration - file may be corrupted',
            errorType: 'metadata'
          });
          return;
        }
        
        // Check for invalid dimensions
        if (!video.videoWidth || !video.videoHeight || video.videoWidth <= 0 || video.videoHeight <= 0) {
          resolveOnce({
            isValid: false,
            isCorrupted: true,
            error: 'Video has invalid dimensions - file may be corrupted',
            errorType: 'metadata'
          });
          return;
        }
        
        // Try to seek to test if video data is accessible
        const seekTime = Math.min(1, Math.max(0, video.duration - 0.1));
        video.currentTime = seekTime;
      } catch (error) {
        resolveOnce({
          isValid: false,
          isCorrupted: true,
          error: 'Failed to process video metadata - file may be corrupted',
          errorType: 'metadata'
        });
      }
    };
    
    // Seek completed - video appears playable
    const onSeeked = () => {
      resolveOnce({
        isValid: true,
        isCorrupted: false
      });
    };
    
    // Can play - additional validation check
    const onCanPlay = () => {
      // If we can play but haven't tested seeking yet, wait for seek
      if (video.currentTime === 0) {
        return;
      }
      
      // If we're here after seeking, video is valid
      resolveOnce({
        isValid: true,
        isCorrupted: false
      });
    };
    
    // Set up event listeners
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('canplay', onCanPlay, { once: true });
    
    // Start loading video
    try {
      video.src = URL.createObjectURL(file);
    } catch (error) {
      resolveOnce({
        isValid: false,
        isCorrupted: true,
        error: 'Failed to create video URL - file may be corrupted',
        errorType: 'format'
      });
    }
  });
};

/**
 * Validate multiple video files for corruption
 */
export const validateVideoFiles = async (
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ file: File; result: VideoValidationResult }[]> => {
  const results: { file: File; result: VideoValidationResult }[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length, file.name);
    
    const result = await validateVideoFile(file);
    results.push({ file, result });
  }
  
  return results;
};