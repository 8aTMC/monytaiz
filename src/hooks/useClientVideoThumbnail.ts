import { useState, useEffect, useRef } from 'react';

// Simple client-side video thumbnail hook specifically for message attachments
export const useClientVideoThumbnail = (videoUrl?: string) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setThumbnail(null);
      return;
    }

    // Cleanup previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const generateThumbnail = async () => {
      if (abortController.signal.aborted) return;
      
      setIsGenerating(true);
      
      try {
        const thumbnailDataUrl = await generateVideoThumbnailFromUrl(videoUrl, abortController.signal);
        if (!abortController.signal.aborted && thumbnailDataUrl) {
          setThumbnail(thumbnailDataUrl);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.warn('Client thumbnail generation failed:', error);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsGenerating(false);
        }
      }
    };

    generateThumbnail();

    return () => {
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, [videoUrl]);

  return { thumbnail, isGenerating };
};

async function generateVideoThumbnailFromUrl(
  videoUrl: string, 
  signal: AbortSignal
): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve(null);
      return;
    }

    // Set canvas size for message thumbnails (16:9 aspect ratio)
    canvas.width = 320;
    canvas.height = 180;
    
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    const cleanup = () => {
      try {
        video.remove();
        canvas.remove();
      } catch (e) {
        // Elements might already be removed
      }
    };
    
    const onAbort = () => {
      cleanup();
      resolve(null);
    };
    
    if (signal.aborted) {
      resolve(null);
      return;
    }
    
    signal.addEventListener('abort', onAbort);
    
    video.onloadedmetadata = () => {
      if (signal.aborted) return;
      // Seek to 1 second or 10% of duration
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    
    video.onseeked = () => {
      if (signal.aborted) return;
      
      try {
        // Fill background with black
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate scaling to fit video in canvas (letterbox if needed)
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;
        
        // For vertical videos (portrait), use letterboxing to preserve full video
        if (videoAspect < 1) {
          // Video is taller than wide (portrait) - fit to height with black bars on sides
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoAspect;
          offsetX = (canvas.width - drawWidth) / 2;
        } else if (videoAspect > canvasAspect) {
          // Video is wider than canvas - crop sides (for horizontal videos)
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoAspect;
          offsetX = (canvas.width - drawWidth) / 2;
        } else {
          // Video is similar aspect or taller - fit to width
          drawWidth = canvas.width;
          drawHeight = canvas.width / videoAspect;
          offsetY = (canvas.height - drawHeight) / 2;
        }
        
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        signal.removeEventListener('abort', onAbort);
        cleanup();
        resolve(thumbnailDataUrl);
      } catch (error) {
        signal.removeEventListener('abort', onAbort);
        cleanup();
        resolve(null);
      }
    };
    
    video.onerror = () => {
      signal.removeEventListener('abort', onAbort);  
      cleanup();
      resolve(null);
    };
    
    video.src = videoUrl;
    video.load();
  });
}