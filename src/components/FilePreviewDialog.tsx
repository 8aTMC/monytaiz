import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File;
}

export const FilePreviewDialog = ({
  open,
  onOpenChange,
  file,
}: FilePreviewDialogProps) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoQuality, setVideoQuality] = useState<'SD' | 'HD' | '4K'>('HD');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const getFileType = () => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension)) return 'image';
    if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(extension)) return 'video';
    if (['.mp3', '.wav', '.aac', '.ogg'].includes(extension)) return 'audio';
    return 'document';
  };

  const fileType = getFileType();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getResolutionFromSize = (width: number, height: number) => {
    if (width >= 3840 || height >= 2160) return '4K';
    if (width >= 1280 || height >= 720) return 'HD';
    return 'SD';
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{file.name}</span>
            <div className="flex items-center gap-2 ml-4">
              <Badge variant="outline">{formatFileSize(file.size)}</Badge>
              {fileType === 'video' && (
                <div className="flex gap-1">
                  <Button
                    variant={videoQuality === 'SD' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVideoQuality('SD')}
                  >
                    SD
                  </Button>
                  <Button
                    variant={videoQuality === 'HD' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVideoQuality('HD')}
                  >
                    HD
                  </Button>
                  <Button
                    variant={videoQuality === '4K' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVideoQuality('4K')}
                  >
                    4K
                  </Button>
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6">
          <div className="bg-black rounded-lg overflow-hidden relative">
            {fileType === 'image' && fileUrl && (
              <img
                src={fileUrl}
                alt={file.name}
                className="w-full h-auto max-h-[60vh] object-contain"
              />
            )}
            
            {fileType === 'video' && fileUrl && (
              <div className="relative">
                <video
                  ref={videoRef}
                  src={fileUrl}
                  className="w-full h-auto max-h-[60vh] object-contain"
                  controls={false}
                  muted={isMuted}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration);
                    }
                  }}
                />
                
                {/* Video Progress Bar */}
                <div className="absolute bottom-16 left-4 right-4 bg-black/50 rounded-lg p-3">
                  <div className="flex items-center gap-3 text-white text-sm">
                    <span className="text-xs font-mono">{formatTime(currentTime)}</span>
                    
                    {/* Seek Bar */}
                    <div 
                      className="flex-1 h-2 bg-white/30 rounded-full cursor-pointer relative"
                      onClick={handleSeek}
                    >
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                      {/* Seek handle */}
                      <div 
                        className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-lg transition-all"
                        style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, marginLeft: '-8px' }}
                      />
                    </div>
                    
                    <span className="text-xs font-mono">{formatTime(duration)}</span>
                  </div>
                </div>
                
                {/* Custom Video Controls Overlay */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (videoRef.current) {
                        if (isPlaying) {
                          videoRef.current.pause();
                        } else {
                          videoRef.current.play();
                        }
                      }
                    }}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                        setIsMuted(!isMuted);
                      }
                    }}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  
                  <Badge variant="secondary">
                    {videoQuality}
                  </Badge>
                </div>
                
                {/* Fullscreen Button */}
                <div className="absolute bottom-4 right-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (videoRef.current && videoRef.current.requestFullscreen) {
                        videoRef.current.requestFullscreen();
                      }
                    }}
                  >
                    <Maximize className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {fileType === 'audio' && fileUrl && (
              <div className="p-8 text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <Volume2 className="w-12 h-12 text-muted-foreground" />
                </div>
                <audio
                  src={fileUrl}
                  className="w-full"
                  controls
                />
              </div>
            )}
            
            {fileType === 'document' && (
              <div className="p-8 text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground">
                    {file.name.split('.').pop()?.toUpperCase()}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Document preview not available
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  File will be uploaded as-is
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};