import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image, Video, FileAudio, FileText, X } from 'lucide-react';
import { useSidebar } from '@/components/Navigation';
import { useSecureMedia } from '@/hooks/useSecureMedia';

interface MediaItem {
  id: string;
  title: string | null;
  type?: any;
  content_type?: string;
  storage_path?: string;
  file_path?: string;
  mime?: string;
  mime_type?: string;
  size_bytes?: number;
  file_size?: number;
  tiny_placeholder?: string;
  width?: number;
  height?: number;
}

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaItem | null;
}

export const MediaPreviewDialog = ({
  open,
  onOpenChange,
  item,
}: MediaPreviewDialogProps) => {
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [secureUrl, setSecureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sidebar = useSidebar();
  const { getSecureUrl } = useSecureMedia();

  const getTypeValue = (type: string | any): string => {
    return typeof type === 'object' && type?.value ? type.value : type || 'unknown';
  };

  const getStoragePath = (path: string | any): string | null => {
    if (typeof path === 'string' && path.trim()) {
      // Remove 'content/' prefix since we'll add it in the URL
      return path.startsWith('content/') ? path.substring(8) : path;
    }
    if (typeof path === 'object' && path?.value && typeof path.value === 'string') {
      const pathStr = path.value;
      return pathStr.startsWith('content/') ? pathStr.substring(8) : pathStr;
    }
    return null;
  };

  // Helper functions to handle both data formats
  const getItemType = (item: MediaItem): string => {
    return getTypeValue(item.type) || item.content_type || 'unknown';
  };

  const getItemStoragePath = (item: MediaItem): string | null => {
    return getStoragePath(item.storage_path) || getStoragePath(item.file_path);
  };

  const getItemSize = (item: MediaItem): number => {
    return item.size_bytes || item.file_size || 0;
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      
      default: return <FileText className="h-8 w-8" />;
    }
  };

  // Load secure URL when dialog opens
  useEffect(() => {
    if (open && item) {
      const storagePath = getItemStoragePath(item);
      if (storagePath) {
        setLoading(true);
        setSecureUrl(null);
        setFullImageLoaded(false);
        
        getSecureUrl(storagePath)
          .then(url => {
            setSecureUrl(url);
          })
          .catch(err => {
            console.error('Failed to get secure URL:', err);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [open, item, getSecureUrl]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!item) return null;

  const typeValue = getItemType(item);
  const itemSize = getItemSize(item);

  // Dynamic sizing based on sidebar state
  const getModalSize = () => {
    if (sidebar.isCollapsed) {
      return "max-w-5xl"; // Larger when sidebar is collapsed
    }
    return "max-w-3xl"; // Smaller when sidebar is expanded
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Custom overlay that will properly cover everything */}
        <div 
          className="fixed inset-0 bg-black/80 z-[200]" 
          onClick={() => onOpenChange(false)}
        />
        <div className={`fixed left-[50%] top-[50%] z-[210] grid w-full ${getModalSize()} max-h-[90vh] translate-x-[-50%] translate-y-[-50%] gap-4 border-0 bg-background/95 backdrop-blur-sm p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg overflow-hidden`}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                {getContentTypeIcon(typeValue)}
                {item.title || 'Untitled'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{typeValue}</Badge>
                {itemSize > 0 && (
                  <Badge variant="outline">{formatFileSize(itemSize)}</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-center h-full max-h-[70vh] bg-muted/20 rounded-lg">
              {/* Error handling */}
              {!getItemStoragePath(item) && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <X className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No storage path available</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    This media item may have corrupted data or the file may be missing.
                  </p>
                </div>
              )}

              {getItemStoragePath(item) && (
                <>
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary/60"></div>
                    </div>
                  )}

                  {typeValue === 'image' && (
                    <div className="relative flex items-center justify-center w-full h-full">
                      {/* Show tiny placeholder first for instant loading */}
                      {item.tiny_placeholder && !fullImageLoaded && !loading && (
                        <img 
                          src={item.tiny_placeholder} 
                          alt=""
                          className="max-w-full max-h-full w-auto h-auto object-contain rounded blur-sm opacity-60"
                        />
                      )}
                      
                      {/* High quality preview using secure URL */}
                      {secureUrl && (
                        <img 
                          src={secureUrl}
                          alt={item.title || 'Preview'} 
                          onLoad={() => setFullImageLoaded(true)}
                          onError={(e) => {
                            console.error('Failed to load secure image:', e);
                          }}
                          className={`max-w-full max-h-full w-auto h-auto object-contain rounded transition-opacity duration-300 ${
                            fullImageLoaded ? 'opacity-100' : 'opacity-0'
                          } ${!fullImageLoaded && item.tiny_placeholder ? 'absolute inset-0' : ''}`}
                        />
                      )}
                    </div>
                  )}

                  {typeValue === 'video' && secureUrl && (
                    <video 
                      src={secureUrl}
                      controls 
                      className="max-w-full max-h-full w-auto h-auto object-contain rounded"
                      preload="metadata"
                      onError={(e) => {
                        console.error('Failed to load secure video:', e);
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}

                  {typeValue === 'audio' && secureUrl && (
                    <div className="flex flex-col items-center gap-4 p-8">
                      <FileAudio className="h-16 w-16 text-muted-foreground" />
                      <audio 
                        src={secureUrl} 
                        controls 
                        className="w-full max-w-md" 
                        preload="metadata"
                        onError={(e) => {
                          console.error('Failed to load secure audio:', e);
                        }}
                      >
                        Your browser does not support the audio tag.
                      </audio>
                    </div>
                  )}

                  {typeValue !== 'image' && typeValue !== 'video' && typeValue !== 'audio' && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      {getContentTypeIcon(typeValue)}
                      <p className="text-muted-foreground mt-4 mb-2">No preview available</p>
                      <p className="text-sm text-muted-foreground">
                        This file type cannot be previewed directly.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </DialogPortal>
    </Dialog>
  );
};