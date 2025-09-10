import { useState, useEffect } from 'react';
import { Image, Video, Music, FileText, FileIcon } from 'lucide-react';
import { usePersistentMediaCache } from '@/hooks/usePersistentMediaCache';

interface DatabaseFile {
  id: string;
  original_filename: string;
  title?: string;
  mime_type: string;
  original_size_bytes?: number;
  optimized_size_bytes?: number;
  processed_path?: string;
  thumbnail_path?: string;
  created_at: string;
  processing_status: string;
}

interface DatabaseThumbnailProps {
  file: DatabaseFile;
  label: string;
  className?: string;
}

export const DatabaseThumbnail = ({ file, label, className = "w-12 h-12" }: DatabaseThumbnailProps) => {
  const { getSecureMediaUrl } = usePersistentMediaCache();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadThumbnail = async () => {
      setLoading(true);
      
      // Try to get thumbnail first, then fall back to processed_path if it's an image
      const pathToLoad = file.thumbnail_path || (file.mime_type?.startsWith('image/') ? file.processed_path : null);
      
      if (pathToLoad) {
        try {
          const url = await getSecureMediaUrl(pathToLoad, { width: 48, height: 48 });
          setThumbnailUrl(url);
        } catch (error) {
          console.log('Failed to load thumbnail:', error);
          setThumbnailUrl(null);
        }
      }
      
      setLoading(false);
    };

    loadThumbnail();
  }, [file.processed_path, file.thumbnail_path, file.mime_type, getSecureMediaUrl]);

  const getFileIcon = (mimeType: string) => {
    const iconClass = "w-6 h-6";
    
    if (mimeType?.startsWith('image/')) {
      return <Image className={`${iconClass} text-blue-500`} />;
    }
    if (mimeType?.startsWith('video/')) {
      return <Video className={`${iconClass} text-purple-500`} />;
    }
    if (mimeType?.startsWith('audio/')) {
      return <Music className={`${iconClass} text-green-500`} />;
    }
    if (mimeType?.includes('text') || mimeType?.includes('document')) {
      return <FileText className={`${iconClass} text-orange-500`} />;
    }
    return <FileIcon className={`${iconClass} text-muted-foreground`} />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`${className} rounded overflow-hidden bg-background border flex-shrink-0 flex items-center justify-center`}>
        {loading ? (
          <div className="w-6 h-6 animate-pulse bg-muted rounded" />
        ) : thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={file.title || file.original_filename}
            className="w-full h-full object-cover"
            onError={() => setThumbnailUrl(null)}
          />
        ) : (
          getFileIcon(file.mime_type)
        )}
      </div>
      <div className="text-xs text-center">
        <div className="font-medium truncate max-w-20" title={file.title || file.original_filename}>
          {file.title || file.original_filename}
        </div>
        <div className="text-muted-foreground">{formatFileSize(file.optimized_size_bytes || file.original_size_bytes)}</div>
      </div>
    </div>
  );
};