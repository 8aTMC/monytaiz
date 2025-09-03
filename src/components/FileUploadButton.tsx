import { useRef, useState } from 'react';
import { Upload, Image, Video, Music, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadButtonProps {
  onFilesSelected: (files: File[], type: string) => void;
  disabled?: boolean;
}

interface FileTypeConfig {
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accept: string;
  color: string;
}

const fileTypes: FileTypeConfig[] = [
  {
    type: 'images',
    icon: Image,
    label: 'Photos',
    accept: '.jpg,.jpeg,.png,.webp,.gif,.avif',
    color: 'text-blue-500'
  },
  {
    type: 'videos',
    icon: Video,
    label: 'Videos',
    accept: '.mp4,.mov,.webm,.avi,.mkv',
    color: 'text-purple-500'
  },
  {
    type: 'audio',
    icon: Music,
    label: 'Audio',
    accept: '.mp3,.wav,.aac,.ogg,.flac,.opus',
    color: 'text-green-500'
  },
  {
    type: 'documents',
    icon: FileText,
    label: 'Documents',
    accept: '.pdf,.doc,.docx,.txt,.rtf',
    color: 'text-orange-500'
  }
];

export const FileUploadButton = ({ onFilesSelected, disabled }: FileUploadButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = event.target.files;
    if (!files) return;
    
    const fileArray = Array.from(files);
    if (fileArray.length > 10) {
      alert('Maximum 10 files per batch allowed');
      return;
    }
    
    onFilesSelected(fileArray, type);
    // Reset input
    event.target.value = '';
  };

  const triggerFileInput = (type: string) => {
    const input = fileInputRefs.current[type];
    if (input) {
      input.click();
    }
  };

  return (
    <div className="relative">
      {/* Main Upload Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        title="Upload Media"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center text-muted-foreground hover:text-primary transition-colors"
      >
        <Upload className="h-4 w-4" />
      </Button>

      {/* Hover Menu */}
      {isHovered && (
        <div 
          className="absolute bottom-full left-0 mb-2 bg-background border border-border rounded-lg shadow-lg p-2 z-50"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex flex-col gap-1">
            {fileTypes.map((fileType) => {
              const IconComponent = fileType.icon;
              return (
                <Button
                  key={fileType.type}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => triggerFileInput(fileType.type)}
                  className={cn(
                    "flex items-center justify-start gap-2 w-full",
                    fileType.color,
                    "hover:bg-accent"
                  )}
                >
                  <IconComponent className="h-4 w-4" />
                  <span className="text-sm">{fileType.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      {fileTypes.map((fileType) => (
        <input
          key={fileType.type}
          ref={(el) => (fileInputRefs.current[fileType.type] = el)}
          type="file"
          multiple
          accept={fileType.accept}
          onChange={(e) => handleFileSelect(e, fileType.type)}
          className="hidden"
        />
      ))}
    </div>
  );
};