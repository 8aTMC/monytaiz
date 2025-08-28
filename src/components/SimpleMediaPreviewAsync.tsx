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

  // Determine orientation and aspect ratio
  const isVertical = item?.width && item?.height && item.height > item.width;
  const aspectRatio = isVertical ? '9/16' : '16/9';
  const containerWidth = isVertical ? '400px' : '700px';
  const containerHeight = isVertical ? '711px' : '394px';

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
        className="media-dialog border bg-background shadow-lg rounded-lg overflow-hidden flex flex-col"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'fit-content',
          height: 'fit-content',
          maxWidth: '90vw',
          maxHeight: '90vh',
          minWidth: '400px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sr-only" id="media-preview-description">
          Preview dialog for media file: {item?.title || item?.original_filename || 'Unknown file'}
        </div>
        
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
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
          
          {/* File Info Tags */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-medium">Type:</span>
              <span className="capitalize bg-muted px-2 py-1 rounded text-xs">
                {item.media_type || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Size:</span>
              <span className="bg-muted px-2 py-1 rounded text-xs">
                {formatFileSize(item.original_size_bytes || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
           {/* Media Display with Fixed Aspect Ratio */}
           <div className="p-4">
             {loading ? (
               <div 
                 className="flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg"
                 style={{
                   width: containerWidth,
                   height: containerHeight,
                   aspectRatio: aspectRatio
                 }}
               >
                 <div className="text-center">
                   <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                   <p>Loading media...</p>
                 </div>
               </div>
             ) : fullUrl ? (
               <div 
                 className="flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden"
                 style={{
                   width: containerWidth,
                   height: containerHeight,
                   aspectRatio: aspectRatio
                 }}
               >
                 {item?.media_type === 'image' && (
                   <img
                     src={fullUrl}
                     alt={item.title || item.original_filename}
                     className="w-full h-full object-contain"
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
                     className="w-full h-full object-contain"
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
                   <div className="flex items-center justify-center w-full h-full">
                     <audio
                       src={fullUrl}
                       controls
                       className="w-3/4"
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
               <div 
                 className="flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg"
                 style={{
                   width: containerWidth,
                   height: containerHeight,
                   aspectRatio: aspectRatio
                 }}
               >
                 <div className="text-center">
                   <Info className="w-12 h-12 mx-auto mb-4" />
                   <p>Media not available</p>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>
    </>
  );
};