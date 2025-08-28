import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Info } from 'lucide-react';
import { SimpleMediaItem } from '@/hooks/useSimpleMedia';

interface SimpleMediaPreviewAsyncProps {
  item: SimpleMediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  getFullUrlAsync: (item: SimpleMediaItem) => Promise<string | null>;
}

export const SimpleMediaPreviewAsync: React.FC<SimpleMediaPreviewAsyncProps> = ({
  item,
  isOpen,
  onClose,
  getFullUrlAsync
}) => {
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item || !isOpen) {
      setFullUrl(null);
      return;
    }

    const loadUrl = async () => {
      if (!getFullUrlAsync || typeof getFullUrlAsync !== 'function') {
        console.error('getFullUrlAsync is not a function:', typeof getFullUrlAsync);
        setFullUrl(null);
        return;
      }

      setLoading(true);
      try {
        const url = await getFullUrlAsync(item);
        setFullUrl(url);
      } catch (error) {
        console.error('Failed to load media URL:', error);
        setFullUrl(null);
      } finally {
        setLoading(false);
      }
    };

    loadUrl();
  }, [item, isOpen, getFullUrlAsync]);

  if (!item) return null;

  const handleDownload = () => {
    if (fullUrl) {
      window.open(fullUrl, '_blank');
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Custom overlay that covers EVERYTHING including sidebar */}
      <div 
        className="media-overlay"
        onClick={onClose}
      />
      
      {/* Dialog content positioned above everything */}
      <div 
        className="media-dialog w-full max-w-4xl max-h-[90vh] border bg-background shadow-lg rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sr-only" id="media-preview-description">
          Preview dialog for media file: {item?.title || item?.original_filename || 'Unknown file'}
        </div>
        
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold truncate pr-4">
              {item?.title || item?.original_filename || 'Untitled'}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={!fullUrl || loading}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Media Display */}
          <div className="flex items-center justify-center bg-muted/20" style={{ minHeight: '400px' }}>
            {loading ? (
              <div className="text-center text-muted-foreground">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Loading media...</p>
              </div>
            ) : fullUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                {item?.media_type === 'image' && (
                  <img
                    src={fullUrl}
                    alt={item.title || item.original_filename}
                    className="max-w-full max-h-[70vh] object-contain"
                    style={{ 
                      width: 'auto', 
                      height: 'auto',
                      aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : 'auto'
                    }}
                    onError={(e) => {
                      console.error('Failed to load image:', e);
                      setFullUrl(null);
                    }}
                  />
                )}
                {item?.media_type === 'video' && (
                  <video
                    src={fullUrl}
                    controls
                    className="max-w-full max-h-[70vh] object-contain"
                    style={{
                      aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : '16/9'
                    }}
                    preload="metadata"
                    onError={(e) => {
                      console.error('Failed to load video:', e);
                      setFullUrl(null);
                    }}
                  >
                    Your browser does not support video playback.
                  </video>
                )}
                {item?.media_type === 'audio' && (
                  <div className="w-full max-w-md p-8">
                    <audio
                      src={fullUrl}
                      controls
                      className="w-full"
                      preload="metadata"
                      onError={(e) => {
                        console.error('Failed to load audio:', e);
                        setFullUrl(null);
                      }}
                    >
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Info className="w-12 h-12 mx-auto mb-4" />
                <p>Media not available</p>
              </div>
            )}
          </div>

          {/* Footer with file info */}
          {item && (
            <div className="p-4 border-t bg-muted/20">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Type:</span>
                  <br />
                  <span className="capitalize">{item.media_type || 'Unknown'}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Size:</span>
                  <br />
                  <span>{formatFileSize(item.original_size_bytes || 0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};