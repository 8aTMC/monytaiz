import { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MiniLibraryThumbnail } from '@/components/MiniLibraryThumbnail';
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

  if (files.length === 0) return null;

  return (
    <div className={cn("mb-2 relative h-24", className)}>
      {/* Navigation arrows for many files */}
      {files.length > 6 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0 z-10 bg-background/80 backdrop-blur-sm"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0 z-10 bg-background/80 backdrop-blur-sm"
            onClick={scrollRight}
            disabled={!canScrollRight}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </>
      )}
      
      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto h-20 pt-2 pb-1 px-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {files.map((file, index) => (
          <MiniLibraryThumbnail
            key={file.id}
            file={file}
            fileIndex={index}
            onRemove={onRemoveFile}
          />
        ))}
      </div>
    </div>
  );
};