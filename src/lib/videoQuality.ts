/**
 * Video quality detection utility
 * Determines video quality based on resolution dimensions
 */

export type VideoQuality = '480p' | '720p' | '1080p' | '1440p' | '4K' | 'Unknown';

export interface VideoQualityInfo {
  quality: VideoQuality;
  label: string;
  isStandard: boolean;
}

/**
 * Detects video quality based on width and height dimensions
 */
export function detectVideoQuality(width: number, height: number): VideoQualityInfo {
  // Handle portrait/vertical videos by using the larger dimension
  const maxDimension = Math.max(width, height);
  const minDimension = Math.min(width, height);
  
  // Standard resolutions - check both landscape and portrait orientations
  if ((width === 854 && height === 480) || (width === 480 && height === 854) || maxDimension <= 480) {
    return { quality: '480p', label: 'SD', isStandard: true };
  }
  
  if ((width === 1280 && height === 720) || (width === 720 && height === 1280) || (maxDimension <= 720 && maxDimension > 480)) {
    return { quality: '720p', label: 'HD', isStandard: true };
  }
  
  if ((width === 1920 && height === 1080) || (width === 1080 && height === 1920) || (maxDimension <= 1080 && maxDimension > 720)) {
    return { quality: '1080p', label: 'FHD', isStandard: true };
  }
  
  if ((width === 2560 && height === 1440) || (width === 1440 && height === 2560) || (maxDimension <= 1440 && maxDimension > 1080)) {
    return { quality: '1440p', label: '2K', isStandard: true };
  }
  
  if ((width === 3840 && height === 2160) || (width === 2160 && height === 3840) || maxDimension >= 2160) {
    return { quality: '4K', label: '4K', isStandard: true };
  }
  
  // Non-standard resolutions - categorize by closest standard
  if (maxDimension <= 480) {
    return { quality: '480p', label: 'SD', isStandard: false };
  } else if (maxDimension <= 720) {
    return { quality: '720p', label: 'HD', isStandard: false };
  } else if (maxDimension <= 1080) {
    return { quality: '1080p', label: 'FHD', isStandard: false };
  } else if (maxDimension <= 1440) {
    return { quality: '1440p', label: '2K', isStandard: false };
  } else {
    return { quality: '4K', label: '4K+', isStandard: false };
  }
}

/**
 * Gets video metadata from a video element when loaded
 */
export function getVideoMetadata(video: HTMLVideoElement): VideoQualityInfo | null {
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }
  
  return detectVideoQuality(video.videoWidth, video.videoHeight);
}

/**
 * Gets video metadata from a file (for upload preview)
 */
export function getVideoMetadataFromFile(file: File): Promise<VideoQualityInfo | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    
    video.preload = 'metadata';
    video.src = url;
    
    video.onloadedmetadata = () => {
      const metadata = getVideoMetadata(video);
      URL.revokeObjectURL(url);
      resolve(metadata);
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}