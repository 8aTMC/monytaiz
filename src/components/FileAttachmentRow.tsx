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
    <div className={cn("relative z-10 mb-3", className)}>
      <div className="bg-background/80 backdrop-blur-sm rounded-lg border border-border p-3 shadow-sm">
        <div className="text-xs text-muted-foreground mb-2 font-medium">
          {files.length} file{files.length !== 1 ? 's' : ''} attached
        </div>
        <div className="overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
          <div className="flex gap-2 items-center py-1">
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
    </div>
  );
};