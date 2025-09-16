import { useState, useEffect, useRef, useCallback } from 'react';
import { Image, Video, FileAudio, FileText, Play, Music, FileX } from 'lucide-react';
import { useBlobUrl } from '@/hooks/useBlobUrl';

interface FileUploadThumbnailProps {
  file: File;
  className?: string;
}

export const FileUploadThumbnail = ({ file, className = "w-12 h-12" }: FileUploadThumbnailProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'audio' | 'gif' | 'unknown'>('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const { createBlobUrl, revokeBlobUrl, revokeAllBlobUrls } = useBlobUrl();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate video thumbnail with proper cleanup
  const generateVideoThumbnail = useCallback(async (videoFile: File, signal: AbortSignal): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(null);
        return;
      }

      let blobUrl: string | null = null;
      let timeoutId: number | null = null;

      const cleanup = () => {
        // Clear the src before revoking to avoid file-not-found during teardown
        try { (video as HTMLVideoElement).src = ''; } catch {}
        if (blobUrl) {
          revokeBlobUrl(blobUrl);
          blobUrl = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        video.remove();
      };

      // Handle abort signal
      if (signal.aborted) {
        cleanup();
        resolve(null);
        return;
      }

      signal.addEventListener('abort', () => {
        cleanup();
        resolve(null);
      });

      // Timeout after 10 seconds
      timeoutId = window.setTimeout(() => {
        console.warn('Video thumbnail generation timeout for:', videoFile.name);
        cleanup();
        resolve(null);
      }, 10000);

      video.onloadedmetadata = () => {
        if (signal.aborted) return;
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        if (signal.aborted) return;
        
        try {
          if (video.videoWidth && video.videoHeight) {
            // Calculate thumbnail dimensions
            const videoAspect = video.videoWidth / video.videoHeight;
            let thumbWidth, thumbHeight;
            
            if (videoAspect > 1) {
              thumbWidth = 120;
              thumbHeight = 80;
            } else if (videoAspect < 1) {
              thumbWidth = 80;
              thumbHeight = 120;
            } else {
              thumbWidth = 120;
              thumbHeight = 120;
            }
            
            canvas.width = thumbWidth;
            canvas.height = thumbHeight;
            
            ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            cleanup();
            resolve(dataUrl);
          } else {
            cleanup();
            resolve(null);
          }
        } catch (error) {
          console.error('Error drawing video frame:', error);
          cleanup();
          resolve(null);
        }
      };

      video.onerror = () => {
        console.error('Error loading video for thumbnail:', videoFile.name);
        cleanup();
        resolve(null);
      };

      try {
        blobUrl = createBlobUrl(videoFile);
        video.src = blobUrl;
        video.muted = true;
        video.load();
      } catch (error) {
        console.error('Error creating video thumbnail:', error);
        cleanup();
        resolve(null);
      }
    });
  }, [createBlobUrl, revokeBlobUrl]);

  useEffect(() => {
    // Clear previous thumbnail and abort any ongoing operations
    setThumbnailUrl(null);
    setIsLoading(false);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    // Determine file type
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'].includes(extension)) {
      setFileType('image');
      setIsLoading(true);
      
      // Use data URLs for images to avoid blob URL lifecycle issues
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && !abortControllerRef.current?.signal.aborted) {
          setThumbnailUrl(e.target.result as string);
        }
        setIsLoading(false);
      };
      reader.onerror = () => {
        console.error('Error reading image file:', file.name);
        setThumbnailUrl(null);
        setIsLoading(false);
      };
      
      if (!abortControllerRef.current.signal.aborted) {
        reader.readAsDataURL(file);
      }
    } else if (['.mp4', '.mov', '.webm', '.mkv'].includes(extension)) {
      setFileType('video');
      setIsLoading(true);
      
      generateVideoThumbnail(file, abortControllerRef.current.signal)
        .then(dataUrl => {
          if (!abortControllerRef.current?.signal.aborted) {
            setThumbnailUrl(dataUrl);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (['.mp3', '.wav', '.aac', '.ogg', '.opus'].includes(extension)) {
      setFileType('audio');
    }

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      revokeAllBlobUrls();
    };
  }, [file, generateVideoThumbnail, revokeAllBlobUrls]);

  const renderContent = () => {
    // Show loading indicator while processing
    if (isLoading) {
      return (
        <div className="bg-muted rounded flex items-center justify-center w-full h-full">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (thumbnailUrl && (fileType === 'image' || fileType === 'video')) {
      return (
        <div className="relative">
          <img 
            src={thumbnailUrl} 
            alt={file.name}
            className="w-full h-full object-cover rounded"
            onError={() => {
              console.warn('Failed to load thumbnail for:', file.name);
              setThumbnailUrl(null);
            }}
          />
          {fileType === 'video' && (
            <Play className="absolute bottom-1 left-1 w-3 h-3 text-white bg-black/50 rounded-sm p-0.5" />
          )}
        </div>
      );
    }

    // Fallback icons
    const iconClass = "w-6 h-6 text-muted-foreground";
    switch (fileType) {
      case 'audio':
        return (
          <div className="bg-muted rounded flex items-center justify-center w-full h-full">
            <Music className={iconClass} />
          </div>
        );
      case 'video':
        return (
          <div className="bg-muted rounded flex items-center justify-center w-full h-full">
            <Video className={iconClass} />
          </div>
        );
      case 'image':
        return (
          <div className="bg-muted rounded flex items-center justify-center w-full h-full">
            <Image className={iconClass} />
          </div>
        );
      default:
        return (
          <div className="bg-muted rounded flex items-center justify-center w-full h-full">
            <FileX className={iconClass} />
          </div>
        );
    }
  };

  return (
    <div className={className}>
      {renderContent()}
    </div>
  );
};