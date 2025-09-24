import { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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

interface LibraryAttachmentRowProps {
  files: MediaItem[];
  onRemoveFile: (fileId: string) => void;
  className?: string;
}

export const LibraryAttachmentRow = ({ files, onRemoveFile, className }: LibraryAttachmentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollability();
    
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkScrollability);
      return () => scrollElement.removeEventListener('scroll', checkScrollability);
    }
  }, [files]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ 
        left: -120, 
        behavior: 'smooth' 
      });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ 
        left: 120, 
        behavior: 'smooth' 
      });
    }
  };

  const getFileTypeIcon = (type: string, mime: string) => {
    if (type === 'image' || mime.startsWith('image/')) return '🖼️';
    if (type === 'video' || mime.startsWith('video/')) return '🎥';
    if (type === 'audio' || mime.startsWith('audio/')) return '🎵';
    if (type === 'gif') return '🎞️';
    return '📄';
  };

  if (files.length === 0) return null;

  return (
    <div className={cn("mb-2 p-2 bg-muted/30 rounded-lg border border-border", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground">
          {files.length} file{files.length !== 1 ? 's' : ''} attached
        </div>
        
        {files.length > 10 && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={scrollLeft}
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={scrollRight}
              disabled={!canScrollRight}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
      
      <ScrollArea className="w-full">
        <div 
          ref={scrollRef}
          className="flex gap-2 pb-2"
          style={{ scrollBehavior: 'smooth' }}
        >
          {files.map((file) => (
            <div key={file.id} className="flex-shrink-0 relative group">
              <div className="w-16 h-16 rounded-lg border border-border bg-muted/50 flex items-center justify-center relative overflow-hidden">
                {/* File type icon */}
                <span className="text-lg" title={file.mime}>
                  {getFileTypeIcon(file.type, file.mime)}
                </span>
                
                {/* Remove button */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveFile(file.id)}
                  title="Remove file"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {/* File title */}
              <div className="mt-1 text-xs text-center text-muted-foreground truncate w-16" title={file.title}>
                {file.title || 'Untitled'}
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};