import { useRef, useEffect } from 'react';
import { X, Image, Video, Music, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface UploadingFile {
  id: string;
  file: File;
  type: string;
  progress: number;
  uploaded: boolean;
  preview?: string;
}

interface UploadProgressBarProps {
  files: UploadingFile[];
  onRemoveFile: (id: string) => void;
  onScroll?: () => void;
}

const getFileIcon = (type: string) => {
  switch (type) {
    case 'images':
      return Image;
    case 'videos':
      return Video;
    case 'audio':
      return Music;
    case 'documents':
      return FileText;
    default:
      return FileText;
  }
};

const getFileTypeColor = (type: string) => {
  switch (type) {
    case 'images':
      return 'border-blue-500';
    case 'videos':
      return 'border-purple-500';
    case 'audio':
      return 'border-green-500';
    case 'documents':
      return 'border-orange-500';
    default:
      return 'border-muted';
  }
};

export const UploadProgressBar = ({ files, onRemoveFile }: UploadProgressBarProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to the end when new files are added
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [files.length]);

  if (files.length === 0) return null;

  return (
    <div className="border-b border-border bg-background p-3">
      <div 
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {files.map((uploadingFile) => {
          const IconComponent = getFileIcon(uploadingFile.type);
          return (
            <div
              key={uploadingFile.id}
              className={cn(
                "relative flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-opacity duration-300",
                getFileTypeColor(uploadingFile.type),
                uploadingFile.uploaded ? "opacity-100" : "opacity-50"
              )}
            >
              {/* File Preview/Icon */}
              <div className="w-full h-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {uploadingFile.preview ? (
                  uploadingFile.type === 'images' ? (
                    <img 
                      src={uploadingFile.preview} 
                      alt={uploadingFile.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <IconComponent className="h-6 w-6 text-muted-foreground" />
                  )
                ) : (
                  <IconComponent className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              {/* Remove Button */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-1 -right-1 h-5 w-5"
                onClick={() => onRemoveFile(uploadingFile.id)}
              >
                <X className="h-3 w-3" />
              </Button>

              {/* Progress Bar */}
              {!uploadingFile.uploaded && (
                <div className="absolute bottom-0 left-0 right-0 p-1">
                  <Progress 
                    value={uploadingFile.progress} 
                    className="h-1 bg-background/80" 
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-2 text-xs text-muted-foreground text-center">
        {files.filter(f => f.uploaded).length}/{files.length} files uploaded
      </div>
    </div>
  );
};