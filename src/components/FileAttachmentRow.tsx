import { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MiniFileThumbnail } from '@/components/MiniFileThumbnail';
import { cn } from '@/lib/utils';

interface FileAttachmentRowProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  className?: string;
}

export const FileAttachmentRow = ({ files, onRemoveFile, className }: FileAttachmentRowProps) => {
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
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex-shrink-0">
              <MiniFileThumbnail
                file={file}
                fileIndex={index}
                onRemove={onRemoveFile}
              />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};