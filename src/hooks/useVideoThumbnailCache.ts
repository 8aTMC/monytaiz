import { useEffect, useState } from 'react';
import { useClientVideoThumbnail } from './useClientVideoThumbnail';

interface MessageFile {
  id: string;
  type: string;
  url: string;
}

// Hook to pre-generate thumbnails for all videos in a file pack
export const useVideoThumbnailCache = (files: MessageFile[]) => {
  const [isPreloading, setIsPreloading] = useState(false);
  
  const videoFiles = files.filter(file => file.type === 'video');
  
  useEffect(() => {
    if (videoFiles.length === 0) return;
    
    setIsPreloading(true);
    
    // Pre-generate thumbnails for all videos
    const preloadPromises = videoFiles.map(async (file) => {
      // This will trigger thumbnail generation and caching
      return new Promise<void>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = file.url;
        video.onloadedmetadata = () => {
          video.remove();
          resolve();
        };
        video.onerror = () => {
          video.remove();
          resolve();
        };
      });
    });
    
    Promise.all(preloadPromises).finally(() => {
      setIsPreloading(false);
    });
  }, [videoFiles.length]);
  
  return { isPreloading };
};