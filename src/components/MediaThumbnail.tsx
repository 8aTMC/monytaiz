import { useState, useEffect } from 'react';
import { Image, Video, FileAudio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MediaThumbnailProps {
  item: {
    type?: string;
    content_type?: string;
    storage_path?: string;
    file_path?: string;
    title: string | null;
    tiny_placeholder?: string;
    width?: number;
    height?: number;
  };
  className?: string;
}

export const MediaThumbnail = ({ item, className = "" }: MediaThumbnailProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);

  // Helper to get type from either format
  const getItemType = () => item.type || item.content_type || 'unknown';
  
  // Helper to get storage path from either format  
  const getStoragePath = () => {
    const path = item.storage_path || item.file_path || '';
    // Remove content/ prefix if exists since supabase client adds bucket name
    return path.startsWith('content/') ? path.substring(8) : path;
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      default: return <Image className="h-8 w-8" />;
    }
  };

  const itemType = getItemType();
  const storagePath = getStoragePath();

  // Generate signed URL for images
  useEffect(() => {
    const generateSignedUrl = async () => {
      if (itemType === 'image' && storagePath && !signedUrl && !isGeneratingUrl) {
        setIsGeneratingUrl(true);
        try {
          const { data, error } = await supabase.storage
            .from('content')
            .createSignedUrl(storagePath, 3600, {
              transform: {
                width: 256,
                height: 256,
                resize: 'cover',
                quality: 75
              }
            });

          if (error) {
            console.error('Error creating signed URL for thumbnail:', error);
            setHasError(true);
          } else if (data?.signedUrl) {
            setSignedUrl(data.signedUrl);
          }
        } catch (err) {
          console.error('Error generating signed URL:', err);
          setHasError(true);
        } finally {
          setIsGeneratingUrl(false);
        }
      }
    };

    generateSignedUrl();
  }, [itemType, storagePath, signedUrl, isGeneratingUrl]);

  // For non-image types, show icon
  if (itemType !== 'image') {
    return (
      <div className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}>
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon(itemType)}
          <span className="text-xs text-muted-foreground capitalize">
            {itemType}
          </span>
        </div>
      </div>
    );
  }

  // Calculate aspect ratio for layout stability
  const aspectWidth = item.width ? Math.min(item.width, 256) : 256;
  const aspectHeight = item.height ? Math.round((aspectWidth / (item.width ?? 1)) * (item.height ?? 256)) : 256;

  return (
    <div className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}>
      {/* Loading state */}
      {isGeneratingUrl && !hasError && (
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      )}

      {/* Tiny placeholder */}
      {item.tiny_placeholder && !imageLoaded && !hasError && signedUrl && (
        <img
          src={item.tiny_placeholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-md transition-all duration-300"
          style={{ filter: 'blur(8px)' }}
        />
      )}
      
      {/* Main image */}
      {signedUrl && !hasError && (
        <img
          src={signedUrl}
          alt={item.title || 'Thumbnail'}
          className={`w-full h-full object-cover transition-all duration-300 ${
            imageLoaded ? 'opacity-100 blur-0' : 'opacity-0'
          }`}
          loading="lazy"
          decoding="async"
          width={aspectWidth}
          height={aspectHeight}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            console.error('Failed to load image:', signedUrl);
            setHasError(true);
          }}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon('image')}
          <span className="text-xs text-muted-foreground">Failed to load</span>
        </div>
      )}
    </div>
  );
};