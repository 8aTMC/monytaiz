import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Image,
  Video,
  Music,
  FileText,
  Download,
  Shield
} from 'lucide-react';

interface MediaFile {
  id: string;
  type: string;
  name: string;
  url?: string;
  preview?: string;
  size: number;
}

interface FullScreenMediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  files: MediaFile[];
  initialIndex: number;
  isDownloadAllowed?: boolean;
  showTypeCounters?: boolean;
}

export const FullScreenMediaViewer = ({ 
  isOpen, 
  onClose, 
  files, 
  initialIndex = 0,
  isDownloadAllowed = false,
  showTypeCounters = true
}: FullScreenMediaViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Group files by type and maintain order
  const groupedFiles = files.reduce((acc, file, index) => {
    if (!acc[file.type]) acc[file.type] = [];
    acc[file.type].push({ ...file, originalIndex: index });
    return acc;
  }, {} as Record<string, (MediaFile & { originalIndex: number })[]>);

  // Create ordered array: images first, then videos, then audio, then others
  const orderedFiles = [
    ...(groupedFiles.image || []),
    ...(groupedFiles.video || []),
    ...(groupedFiles.audio || []),
    ...(groupedFiles.document || [])
  ];

  const currentFile = orderedFiles[currentIndex];

  // Get type-specific counters
  const getTypeCounters = () => {
    const imageFiles = groupedFiles.image || [];
    const videoFiles = groupedFiles.video || [];
    const audioFiles = groupedFiles.audio || [];
    
    const currentFileType = currentFile?.type;
    
    if (currentFileType === 'image') {
      const currentImageIndex = imageFiles.findIndex(f => f.id === currentFile.id) + 1;
      return {
        current: `${currentImageIndex}/${imageFiles.length}`,
        currentIcon: Image,
        others: [
          { count: videoFiles.length, icon: Video },
          { count: audioFiles.length, icon: Music }
        ].filter(item => item.count > 0)
      };
    } else if (currentFileType === 'video') {
      const currentVideoIndex = videoFiles.findIndex(f => f.id === currentFile.id) + 1;
      return {
        current: `${currentVideoIndex}/${videoFiles.length}`,
        currentIcon: Video,
        others: [
          { count: imageFiles.length, icon: Image },
          { count: audioFiles.length, icon: Music }
        ].filter(item => item.count > 0)
      };
    } else if (currentFileType === 'audio') {
      const currentAudioIndex = audioFiles.findIndex(f => f.id === currentFile.id) + 1;
      return {
        current: `${currentAudioIndex}/${audioFiles.length}`,
        currentIcon: Music,
        others: [
          { count: imageFiles.length, icon: Image },
          { count: videoFiles.length, icon: Video }
        ].filter(item => item.count > 0)
      };
    }
    
    return null;
  };

  const typeCounters = showTypeCounters ? getTypeCounters() : null;

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          setCurrentIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          setCurrentIndex(prev => Math.min(orderedFiles.length - 1, prev + 1));
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, orderedFiles.length, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handlePrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(orderedFiles.length - 1, prev + 1));
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const handleDownload = () => {
    if (!isDownloadAllowed || !currentFile?.url) return;
    
    // Create download link
    const link = document.createElement('a');
    link.href = currentFile.url;
    link.download = currentFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {typeCounters && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-white/20 text-white">
                <typeCounters.currentIcon className="h-3 w-3 mr-1" />
                {typeCounters.current}
              </Badge>
              
              {typeCounters.others.map((other, index) => (
                <Badge key={index} variant="outline" className="border-white/40 text-white/70">
                  <other.icon className="h-3 w-3 mr-1" />
                  {other.count}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isDownloadAllowed && (
            <Badge variant="outline" className="border-red-400 text-red-400">
              <Shield className="h-3 w-3 mr-1" />
              Protected
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Media Content */}
      <div className="flex-1 flex items-center justify-center relative">
        {currentFile && (
          <>
            {currentFile.type === 'image' && (
              <img
                src={currentFile.url || currentFile.preview}
                alt={currentFile.name}
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain"
                onContextMenu={(e) => !isDownloadAllowed && e.preventDefault()}
                onDragStart={(e) => !isDownloadAllowed && e.preventDefault()}
                style={{ userSelect: isDownloadAllowed ? 'auto' : 'none' }}
              />
            )}
            
            {currentFile.type === 'video' && (
              <video
                src={currentFile.url}
                controls={isDownloadAllowed}
                controlsList={isDownloadAllowed ? "default" : "nodownload"}
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain"
                onContextMenu={(e) => !isDownloadAllowed && e.preventDefault()}
              >
                Your browser does not support the video tag.
              </video>
            )}
            
            {currentFile.type === 'audio' && (
              <div className="w-80 p-8 bg-gradient-to-br from-purple-900 to-blue-900 rounded-xl">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                    <Music className="h-10 w-10 text-white" />
                  </div>
                </div>
                <h3 className="text-white text-center text-lg font-medium mb-4">
                  {currentFile.name}
                </h3>
                <audio
                  src={currentFile.url}
                  controls={isDownloadAllowed}
                  controlsList={isDownloadAllowed ? "default" : "nodownload"}
                  className="w-full"
                  onContextMenu={(e) => !isDownloadAllowed && e.preventDefault()}
                >
                  Your browser does not support the audio tag.
                </audio>
              </div>
            )}
            
            {currentFile.type === 'document' && (
              <div className="w-96 p-8 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl text-center">
                <FileText className="h-16 w-16 text-white/60 mx-auto mb-4" />
                <h3 className="text-white text-lg font-medium mb-2">
                  {currentFile.name}
                </h3>
                <p className="text-white/60 mb-4">
                  Document preview not available
                </p>
                {isDownloadAllowed && currentFile.url && (
                  <Button onClick={handleDownload} variant="secondary">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {/* Navigation Controls */}
        {orderedFiles.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === orderedFiles.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="text-white/60 text-sm">
            {currentIndex + 1} of {orderedFiles.length}
          </div>
          
          <div className="text-white/60 text-sm">
            Press ESC to close • Arrow keys to navigate
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};