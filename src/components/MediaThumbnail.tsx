import { useState, useEffect } from 'react';
import { Image, Video, FileAudio, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MediaThumbnailProps {
  item: {
    type: string;
    storage_path: string;
    title: string | null;
  };
  className?: string;
}

export const MediaThumbnail = ({ item, className = "" }: MediaThumbnailProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      default: return <FileText className="h-8 w-8" />;
    }
  };

  useEffect(() => {
    if (item.type === 'image' && item.storage_path) {
      setLoading(true);
      
      // Get signed URL for the image
      supabase.storage
        .from('content')
        .createSignedUrl(item.storage_path, 3600) // 1 hour expiry
        .then(({ data, error }) => {
          if (error) {
            console.error('Error creating signed URL:', error);
          } else if (data?.signedUrl) {
            setThumbnailUrl(data.signedUrl);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [item.storage_path, item.type]);

  return (
    <div className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}>
      {loading ? (
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      ) : thumbnailUrl && item.type === 'image' ? (
        <img 
          src={thumbnailUrl} 
          alt={item.title || 'Thumbnail'} 
          className="w-full h-full object-cover"
          onError={() => setThumbnailUrl(null)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon(item.type)}
          <span className="text-xs text-muted-foreground capitalize">
            {item.type}
          </span>
        </div>
      )}
    </div>
  );
};