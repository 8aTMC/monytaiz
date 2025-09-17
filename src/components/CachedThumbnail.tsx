import { useOptimizedThumbnail } from '@/hooks/useOptimizedThumbnail';
import { Music, Video, Image, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CachedThumbnailProps {
  file: File;
  className?: string;
}

export const CachedThumbnail = ({ file, className }: CachedThumbnailProps) => {
  const { thumbnail, isLoading } = useOptimizedThumbnail(file);

  const getFileTypeFromExtension = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'].includes(ext)) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'].includes(ext)) return 'audio';
    return 'unknown';
  };

  const fileType = getFileTypeFromExtension(file.name);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted/20 animate-pulse">
          {fileType === 'image' && <Image className="w-6 h-6 text-muted-foreground/50" />}
          {fileType === 'video' && <Video className="w-6 h-6 text-muted-foreground/50" />}
          {fileType === 'audio' && <Music className="w-6 h-6 text-muted-foreground/50" />}
          {fileType === 'unknown' && <FileX className="w-6 h-6 text-muted-foreground/50" />}
        </div>
      );
    }

    if (thumbnail) {
      return (
        <img
          src={thumbnail}
          alt={file.name}
          className="w-full h-full object-cover"
          onError={() => {
            // Fallback to icon if thumbnail fails to load
          }}
        />
      );
    }

    // Fallback icons for different file types
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        {fileType === 'image' && <Image className="w-6 h-6 text-muted-foreground" />}
        {fileType === 'video' && <Video className="w-6 h-6 text-muted-foreground" />}
        {fileType === 'audio' && <Music className="w-6 h-6 text-muted-foreground" />}
        {fileType === 'unknown' && <FileX className="w-6 h-6 text-muted-foreground" />}
      </div>
    );
  };

  return (
    <div className={cn("rounded-md overflow-hidden border", className)}>
      {renderContent()}
    </div>
  );
};