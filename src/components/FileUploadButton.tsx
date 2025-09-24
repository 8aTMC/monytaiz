import { useRef, useState } from 'react';
import { Upload, Image, Video, Music, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadButtonProps {
  onFilesSelected: (files: File[], type: string) => void;
  disabled?: boolean;
  currentFiles?: File[];
  maxFiles?: number;
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
    accept: '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif',
    color: 'text-blue-500'
  },
  {
    type: 'videos',
    icon: Video,
    label: 'Videos',
    accept: '.mp4,.mov,.webm,.mkv',
    color: 'text-purple-500'
  },
  {
    type: 'audio',
    icon: Music,
    label: 'Audio',
    accept: '.mp3,.wav,.aac,.ogg,.opus',
    color: 'text-green-500'
  }
];

export const FileUploadButton = ({ onFilesSelected, disabled, currentFiles = [], maxFiles = 40 }: FileUploadButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Determine current file type restrictions
  const getCurrentFileTypes = () => {
    if (currentFiles.length === 0) return 'all';
    
    const firstFile = currentFiles[0];
    const extension = firstFile.name.split('.').pop()?.toLowerCase() || '';
    
    if (['mp3', 'wav', 'aac', 'ogg', 'opus'].includes(extension)) {
      return 'audio';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'mp4', 'mov', 'webm', 'mkv', 'avi'].includes(extension)) {
      return 'visual';
    }
    
    return 'all';
  };

  const currentFileTypeCategory = getCurrentFileTypes();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = event.target.files;
    if (!files) return;
    
    const fileArray = Array.from(files);
    
    // Check file type compatibility
    const selectedExtensions = fileArray.map(file => file.name.split('.').pop()?.toLowerCase() || '');
    const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'opus'];
    const visualExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'mp4', 'mov', 'webm', 'mkv', 'avi'];
    
    const hasAudio = selectedExtensions.some(ext => audioExtensions.includes(ext));
    const hasVisual = selectedExtensions.some(ext => visualExtensions.includes(ext));
    
    // Validate file type compatibility with current files
    if (currentFileTypeCategory === 'audio' && hasVisual) {
      alert('Cannot mix audio files with images/videos');
      event.target.value = '';
      return;
    }
    
    if (currentFileTypeCategory === 'visual' && hasAudio) {
      alert('Cannot mix images/videos with audio files');
      event.target.value = '';
      return;
    }
    
    // Check if mixing audio and visual in this selection
    if (hasAudio && hasVisual) {
      alert('Cannot select both audio and visual files in the same batch');
      event.target.value = '';
      return;
    }
    
    // Audio files can only be 1 at a time
    if (hasAudio && (fileArray.length > 1 || currentFiles.length > 0)) {
      alert('Audio files must be sent one at a time');
      event.target.value = '';
      return;
    }
    
    // Check total file limit
    const totalFiles = currentFiles.length + fileArray.length;
    if (hasAudio && totalFiles > 1) {
      alert('Audio files must be sent one at a time');
      event.target.value = '';
      return;
    }
    
    if (hasVisual && totalFiles > maxFiles) {
      alert(`Maximum ${maxFiles} files per batch allowed for images/videos`);
      event.target.value = '';
      return;
    }
    
    onFilesSelected(fileArray, type);
    // Reset input
    event.target.value = '';
  };

  const triggerFileInput = (type: string) => {
    // Check if this type is disabled
    if (isTypeDisabled(type)) return;
    
    const input = fileInputRefs.current[type];
    if (input) {
      input.click();
    }
  };

  const isTypeDisabled = (type: string) => {
    if (currentFileTypeCategory === 'all') return false;
    
    if (currentFileTypeCategory === 'audio') {
      return type !== 'audio';
    }
    
    if (currentFileTypeCategory === 'visual') {
      return type === 'audio';
    }
    
    return false;
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
                    isTypeDisabled(fileType.type) ? "text-muted-foreground/50 cursor-not-allowed" : fileType.color,
                    !isTypeDisabled(fileType.type) && "hover:bg-accent"
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