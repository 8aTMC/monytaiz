import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
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
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadThumbnail = async () => {
      setIsLoading(true);
      
      try {
        if (file.type === 'image' || file.type === 'gif') {
          // For images, get the secure URL directly
          const { data, error } = await supabase.storage
            .from('content')
            .createSignedUrl(file.storage_path, 3600);
          
          if (error) {
            console.error('Error generating image URL:', error);
            setThumbnailUrl(null);
          } else {
            setThumbnailUrl(data.signedUrl);
          }
        } else if (file.type === 'video') {
          // For videos, try thumbnail_path first
          let foundUrl: string | null = null;
          
          if (file.thumbnail_path) {
            const { data, error } = await supabase.storage
              .from('content')
              .createSignedUrl(file.thumbnail_path, 3600);
            
            if (!error && data?.signedUrl) {
              foundUrl = data.signedUrl;
            }
          }
          
          // If no thumbnail found but tiny_placeholder exists, use it
          if (!foundUrl && file.tiny_placeholder) {
            foundUrl = file.tiny_placeholder;
          }
          
          setThumbnailUrl(foundUrl);
        }
      } catch (error) {
        console.error('Error loading thumbnail:', error);
        setThumbnailUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadThumbnail();
  }, [file.storage_path, file.type, file.thumbnail_path, file.tiny_placeholder]);

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
          className="w-full h-full object-cover rounded overflow-hidden"
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
      <div className="w-full h-full flex items-center justify-center text-lg overflow-hidden rounded">
        {getTypeIcon()}
      </div>
    );
  };

  return (
    <div className={cn("relative group flex-shrink-0", className)}>
      <div className="w-12 h-12 rounded border border-border bg-card relative overflow-hidden">
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