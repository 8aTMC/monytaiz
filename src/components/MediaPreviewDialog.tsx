import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image, Video, FileAudio, FileText, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSidebar } from '@/components/Navigation';

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
  // Force recompilation to clear imageLoaded cache issue
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const sidebar = useSidebar();

  const getTypeValue = (type: string | any): string => {
    return typeof type === 'object' && type?.value ? type.value : type || 'unknown';
  };

  const getStoragePath = (path: string | any): string | null => {
    let storagePath: string | null = null;
    
    if (typeof path === 'string' && path.trim()) {
      storagePath = path;
    } else if (typeof path === 'object' && path?.value && typeof path.value === 'string') {
      storagePath = path.value;
    }
    
    if (storagePath) {
      // Remove 'content/' prefix if it exists since we'll add it in the bucket parameter
      return storagePath.startsWith('content/') ? storagePath.substring(8) : storagePath;
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

  useEffect(() => {
    const fetchMediaUrl = async () => {
      if (!item) {
        return;
      }

      const storagePath = getItemStoragePath(item);
      
      if (!storagePath) {
        setError('No storage path available');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const typeValue = getItemType(item);
        
        // For images, create both thumbnail and full quality URLs for faster loading
        if (typeValue === 'image') {
          // Create thumbnail URL with image transformation (smaller, lower quality)
          const { data: thumbnailData, error: thumbnailError } = await supabase.storage
            .from('content')
            .createSignedUrl(storagePath, 3600, {
              transform: {
                width: 400,
                height: 400,
                resize: 'contain',
                quality: 60
              }
            });
          
          if (!thumbnailError && thumbnailData) {
            setThumbnailUrl(thumbnailData.signedUrl);
          }
        }
        
        // Create full quality URL
        const { data, error } = await supabase.storage
          .from('content')
          .createSignedUrl(storagePath, 3600);

        if (error) {
          console.error('Error creating signed URL:', error);
          setError('Failed to load media');
        } else if (data) {
          setMediaUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error fetching media:', err);
        setError('Failed to load media');
      } finally {
        setLoading(false);
      }
    };

    if (open && item) {
      setThumbnailLoaded(false);
      setFullImageLoaded(false);
      setThumbnailUrl(null);
      fetchMediaUrl();
    } else {
      setMediaUrl(null);
      setThumbnailUrl(null);
      setError(null);
      setLoading(false);
      setThumbnailLoaded(false);
      setFullImageLoaded(false);
    }
  }, [open, item]);

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
            <div className="flex items-center justify-center h-full max-h-[70vh]">
              {loading && (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <X className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">{error}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    This media item may have corrupted data or the file may be missing.
                  </p>
                  <div className="text-xs text-muted-foreground/70 space-y-1 max-w-md">
                    <p><strong>Debug Info:</strong></p>
                    <p>Type: {getItemType(item)}</p>
                    <p>Storage path: {getItemStoragePath(item) || 'Missing/Invalid'}</p>
                    <p>Size: {itemSize} bytes</p>
                    <p>MIME: {item.mime || item.mime_type || 'Not specified'}</p>
                  </div>
                </div>
              )}

              {!loading && !error && (mediaUrl || thumbnailUrl) && (
                <>
                    {typeValue === 'image' && (
                      <div className="relative flex items-center justify-center w-full h-full">
                      
                        {/* Show tiny placeholder first for instant loading */}
                        {item.tiny_placeholder && !fullImageLoaded && (
                          <img 
                            src={item.tiny_placeholder} 
                            alt=""
                            className="max-w-full max-h-full w-auto h-auto object-contain rounded blur-md opacity-70 transition-all duration-300"
                          />
                        )}
                        
                         {/* High quality preview using signed URL */}
                        {mediaUrl && (
                          <img 
                            src={mediaUrl}
                            alt={item.title || 'Preview'} 
                            onLoad={() => setFullImageLoaded(true)}
                            className={`max-w-full max-h-full w-auto h-auto object-contain rounded transition-all duration-500 ${
                              fullImageLoaded ? 'opacity-100 blur-0' : 'opacity-0'
                            } ${!fullImageLoaded && item.tiny_placeholder ? 'absolute inset-0' : ''}`}
                          />
                        )}
                        
                        {!fullImageLoaded && !item.tiny_placeholder && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary/50"></div>
                          </div>
                        )}
                      </div>
                    )}

                  {typeValue === 'video' && (
                    <video 
                      src={mediaUrl!} 
                      controls 
                      className="max-w-full max-h-full w-auto h-auto object-contain rounded"
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}

                  {typeValue === 'audio' && (
                    <div className="flex flex-col items-center gap-4 p-8">
                      <FileAudio className="h-16 w-16 text-muted-foreground" />
                      <audio src={mediaUrl!} controls className="w-full max-w-md">
                        Your browser does not support the audio tag.
                      </audio>
                    </div>
                  )}

                </>
              )}

              {!loading && !error && !mediaUrl && !thumbnailUrl && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  {getContentTypeIcon(typeValue)}
                  <p className="text-muted-foreground mt-4 mb-2">No preview available</p>
                  <p className="text-sm text-muted-foreground">
                    This item may not have associated media content.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </DialogPortal>
    </Dialog>
  );
};