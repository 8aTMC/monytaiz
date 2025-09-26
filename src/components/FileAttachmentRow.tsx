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
    <div className={cn("mb-1 p-2 bg-muted/30 rounded-lg border border-border", className)}>
      <div className="text-xs text-muted-foreground mb-1">
        {files.length} file{files.length !== 1 ? 's' : ''} attached
      </div>
      
      <div 
        className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/50 hover:scrollbar-thumb-border/80"
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
    </div>
  );
};