import { MiniFileThumbnail } from '@/components/MiniFileThumbnail';
import { cn } from '@/lib/utils';

interface FileAttachmentRowProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  className?: string;
}

export const FileAttachmentRow = ({ files, onRemoveFile, className }: FileAttachmentRowProps) => {

  if (files.length === 0) return null;

  return (
    <div className={cn("relative z-10 p-1 bg-muted/30 rounded-lg border border-border", className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-muted-foreground">
          {files.length} file{files.length !== 1 ? 's' : ''} attached
        </div>
      </div>
      
      <div className="overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
        <div className="flex gap-2 pb-1 h-16 py-2 items-center">
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
      </div>
    </div>
  );
};