import { useState, useEffect } from 'react';
import { Image, Video, FileAudio, FileText, Play, Music, FileX } from 'lucide-react';

interface FileUploadThumbnailProps {
  file: File;
  className?: string;
}

export const FileUploadThumbnail = ({ file, className = "w-12 h-12" }: FileUploadThumbnailProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'audio' | 'document' | 'unknown'>('unknown');

  useEffect(() => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    // Determine file type
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension)) {
      setFileType('image');
      // Create thumbnail for images
      const url = URL.createObjectURL(file);
      setThumbnailUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(extension)) {
      setFileType('video');
      // Create video thumbnail with proper aspect ratio
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.onloadeddata = () => {
        video.currentTime = 1; // Seek to 1 second
      };
      
      video.onseeked = () => {
        if (ctx && video.videoWidth && video.videoHeight) {
          // Calculate thumbnail dimensions based on video aspect ratio
          const videoAspect = video.videoWidth / video.videoHeight;
          let thumbWidth, thumbHeight;
          
          if (videoAspect > 1) {
            // Horizontal video
            thumbWidth = 120;
            thumbHeight = 80;
          } else if (videoAspect < 1) {
            // Vertical video
            thumbWidth = 80;
            thumbHeight = 120;
          } else {
            // Square video
            thumbWidth = 120;
            thumbHeight = 120;
          }
          
          canvas.width = thumbWidth;
          canvas.height = thumbHeight;
          
          // Draw video frame maintaining aspect ratio
          ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
          const url = canvas.toDataURL();
          setThumbnailUrl(url);
        }
      };
      
      video.src = URL.createObjectURL(file);
      return () => URL.revokeObjectURL(video.src);
    } else if (['.mp3', '.wav', '.aac', '.ogg'].includes(extension)) {
      setFileType('audio');
    } else if (['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(extension)) {
      setFileType('document');
    }
  }, [file]);

  const renderContent = () => {
    if (thumbnailUrl && (fileType === 'image' || fileType === 'video')) {
      return (
        <div className="relative">
          <img 
            src={thumbnailUrl} 
            alt={file.name}
            className="w-full h-full object-cover rounded"
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
      case 'document':
        return (
          <div className="bg-muted rounded flex items-center justify-center w-full h-full">
            <FileText className={iconClass} />
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