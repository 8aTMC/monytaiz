import { useState, useEffect, useCallback } from 'react';
import { X, Image, Video, Music, FileX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MiniFileThumbnailProps {
  file: File;
  fileIndex: number;
  onRemove: (index: number) => void;
  className?: string;
}

export const MiniFileThumbnail = ({ file, fileIndex, onRemove, className }: MiniFileThumbnailProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('unknown');
  const [isLoading, setIsLoading] = useState(true);

  // Removed console logging to reduce noise

  const generateVideoThumbnail = useCallback(async (videoFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        URL.revokeObjectURL(video.src);
      };

      const onLoadedMetadata = () => {
        canvas.width = 32;
        canvas.height = 32;
        
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        
        try {
          // Calculate dimensions for center crop
          const videoAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = 1; // Square thumbnail
          
          let sourceX = 0, sourceY = 0, sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;
          
          if (videoAspect > canvasAspect) {
            // Video is wider, crop sides
            sourceWidth = video.videoHeight;
            sourceX = (video.videoWidth - sourceWidth) / 2;
          } else {
            // Video is taller, crop top/bottom
            sourceHeight = video.videoWidth;
            sourceY = (video.videoHeight - sourceHeight) / 2;
          }
          
          ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 32, 32);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve(url);
            } else {
              reject(new Error('Failed to create blob'));
            }
            cleanup();
          }, 'image/jpeg', 0.8);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      const onError = () => {
        cleanup();
        reject(new Error('Video loading failed'));
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      
      video.src = URL.createObjectURL(videoFile);
      video.load();
    });
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    
    const processFile = async () => {
      setIsLoading(true);
      
      try {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(extension)) {
          setFileType('image');
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setThumbnailUrl(e.target.result as string);
            }
            setIsLoading(false);
          };
          reader.readAsDataURL(file);
          
          cleanup = () => {
            reader.abort();
          };
        } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(extension)) {
          setFileType('video');
          try {
            const videoThumbnail = await generateVideoThumbnail(file);
            setThumbnailUrl(videoThumbnail);
            
            cleanup = () => {
              if (videoThumbnail) {
                URL.revokeObjectURL(videoThumbnail);
              }
            };
          } catch (error) {
            console.warn('Failed to generate video thumbnail:', error);
          }
          setIsLoading(false);
        } else if (['mp3', 'wav', 'aac', 'ogg', 'opus'].includes(extension)) {
          setFileType('audio');
          setIsLoading(false);
        } else {
          setFileType('unknown');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error processing file:', error);
        setFileType('unknown');
        setIsLoading(false);
      }
    };

    processFile();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [file, generateVideoThumbnail]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-muted/30 animate-pulse">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/20"></div>
        </div>
      );
    }

    if (thumbnailUrl && (fileType === 'image' || fileType === 'video')) {
      return (
        <img
          src={thumbnailUrl}
          alt={`${fileType} thumbnail`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      );
    }

    // Fallback icons
    switch (fileType) {
      case 'audio':
        return <Music className="w-4 h-4 text-green-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-purple-500" />;
      case 'image':
        return <Image className="w-4 h-4 text-blue-500" />;
      default:
        return <FileX className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn("relative group", className)}>
      <div className="w-12 h-12 rounded-md border border-border bg-card flex items-center justify-center relative">
        <div className="relative w-full h-full z-10">
          {renderContent()}
        </div>
      </div>
      
      {/* File index badge */}
      <div className="absolute -top-2 -left-2 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium z-20 shadow-sm text-[10px]">
        {fileIndex + 1}
      </div>
      
      {/* Remove button */}
      <Button
        variant="destructive"
        size="sm"
        className="absolute -top-2 -right-2 w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
        onClick={() => onRemove(fileIndex)}
      >
        <X className="w-3 h-3" />
      </Button>
      
      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border z-40 shadow-lg">
        {file.name}
        <br />
        <span className="text-muted-foreground">
          {(file.size / (1024 * 1024)).toFixed(1)}MB
        </span>
      </div>
    </div>
  );
};