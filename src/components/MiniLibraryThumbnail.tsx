import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useThumbnailUrl } from '@/hooks/useThumbnailUrl';
interface MediaItem {
  id: string;
  title: string;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
  thumbnail_path?: string;
  tiny_placeholder?: string;
}

interface MiniLibraryThumbnailProps {
  file: MediaItem;
  fileIndex: number;
  onRemove: (fileId: string) => void;
  className?: string;
}

export const MiniLibraryThumbnail = ({ file, fileIndex, onRemove, className }: MiniLibraryThumbnailProps) => {
  // Determine which path to use for thumbnail URL generation
  const pathToSign = file.type === 'video'
    ? file.thumbnail_path ?? undefined
    : (file.thumbnail_path || file.storage_path);
  
  const { thumbnailUrl: signedUrl, loading } = useThumbnailUrl(pathToSign);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [file.id, signedUrl]);
  
  // For videos, fallback to tiny_placeholder if no signed URL available
  const displayedUrl = signedUrl || (file.type === 'video' ? file.tiny_placeholder ?? null : null);

  console.debug('MiniLibraryThumbnail:', {
    fileId: file.id,
    fileType: file.type,
    pathToSign,
    signedUrl,
    displayedUrl,
    loading,
    imgError
  });

  const renderContent = () => {
    if (loading) {
      return (
        <div className="w-full h-full bg-muted animate-pulse rounded" />
      );
    }

    if (!imgError && displayedUrl && (file.type === 'image' || file.type === 'gif' || file.type === 'video')) {
      return (
        <img
          src={displayedUrl}
          alt={file.title}
          className="w-full h-full object-cover block"
          onError={() => {
            console.warn('MiniLibraryThumbnail: image load failed, showing fallback', { displayedUrl, fileId: file.id });
            setImgError(true);
          }}
          loading="lazy"
        />
      );
    }

    // Fallback icons
    const getTypeIcon = () => {
      switch (file.type) {
        case 'audio':
          return '🎵';
        case 'video':
          return '🎥';
        case 'image':
        case 'gif':
          return '🖼️';
        default:
          return '📄';
      }
    };

    return (
      <div className="w-full h-full flex items-center justify-center text-lg bg-muted/30">
        {getTypeIcon()}
      </div>
    );
  };

  return (
    <div className={cn("relative group flex-shrink-0", className)}>
      <div className="w-12 h-12 rounded border border-border bg-card relative">
        {/* File index badge */}
        <div className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center z-20 text-[10px] font-medium shadow-sm">
          {fileIndex + 1}
        </div>
        
        {/* Thumbnail content */}
        <div className="relative w-full h-full z-10">
          {renderContent()}
        </div>
        
        {/* Remove button */}
        <Button
          size="sm"
          className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
          onClick={() => onRemove(file.id)}
          title="Remove file"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};