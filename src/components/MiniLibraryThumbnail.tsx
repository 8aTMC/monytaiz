import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOptimizedSecureMedia } from '@/hooks/useOptimizedSecureMedia';
import { cn } from '@/lib/utils';

interface MediaItem {
  id: string;
  title: string;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
}

interface MiniLibraryThumbnailProps {
  file: MediaItem;
  fileIndex: number;
  onRemove: (fileId: string) => void;
  className?: string;
}

export const MiniLibraryThumbnail = ({ file, fileIndex, onRemove, className }: MiniLibraryThumbnailProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getSecureUrl } = useOptimizedSecureMedia();

  useEffect(() => {
    const loadThumbnail = async () => {
      setIsLoading(true);
      
      try {
        if (file.type === 'image' || file.type === 'gif') {
          // For images, get the secure URL directly
          const url = await getSecureUrl(file.storage_path, {
            width: 128,
            height: 128,
            quality: 80
          });
          setThumbnailUrl(url);
        } else if (file.type === 'video') {
          // For videos, try to get a thumbnail if it exists
          const thumbnailPath = file.storage_path.replace(/\.[^/.]+$/, '_thumbnail.jpg');
          const url = await getSecureUrl(thumbnailPath, {
            width: 128,
            height: 128,
            quality: 80
          });
          setThumbnailUrl(url);
        }
      } catch (error) {
        console.error('Error loading thumbnail:', error);
        setThumbnailUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadThumbnail();
  }, [file.storage_path, file.type, getSecureUrl]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="w-full h-full bg-muted animate-pulse rounded" />
      );
    }

    if (thumbnailUrl && (file.type === 'image' || file.type === 'gif' || file.type === 'video')) {
      return (
        <img
          src={thumbnailUrl}
          alt={file.title}
          className="w-full h-full object-cover rounded"
          onError={() => setThumbnailUrl(null)}
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
      <div className="w-full h-full flex items-center justify-center text-lg">
        {getTypeIcon()}
      </div>
    );
  };

  return (
    <div className={cn("relative group flex-shrink-0", className)}>
      <div className="w-16 h-16 rounded border border-border bg-muted/50 relative overflow-hidden">
        {/* File index badge */}
        <div className="absolute -top-2 -left-2 bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center z-10 text-[11px] font-medium">
          {fileIndex + 1}
        </div>
        
        {/* Thumbnail content */}
        {renderContent()}
        
        {/* Remove button */}
        <Button
          size="sm"
          className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black text-white hover:bg-gray-800"
          onClick={() => onRemove(file.id)}
          title="Remove file"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};