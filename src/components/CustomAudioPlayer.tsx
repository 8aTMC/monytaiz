import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw 
} from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { cn } from '@/lib/utils';

interface CustomAudioPlayerProps {
  src: string;
  className?: string;
  title?: string;
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({
  src,
  className,
  title
}) => {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isLoading,
    togglePlayPause,
    setVolume,
    toggleMute,
    seek,
    setPlaybackRate,
  } = useAudioPlayer(src);

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    seek(newTime);
  };

  const handleVolumeChange = (values: number[]) => {
    setVolume(values[0]);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const playbackRates = [1, 1.5, 2];

  return (
    <div className={cn("w-full max-w-md mx-auto bg-card border rounded-lg p-4 space-y-4", className)}>
      {/* Title */}
      {title && (
        <div className="text-sm font-medium text-center truncate text-foreground">
          {title}
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div 
          className="relative h-2 bg-muted rounded-full cursor-pointer group"
          onClick={handleProgressClick}
        >
          {/* Progress fill with gradient */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-150 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
          
          {/* Progress handle */}
          <div 
            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-primary border-2 border-background rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg"
            style={{ left: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Time display */}
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Play/Pause & Speed */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            disabled={isLoading}
            className="h-10 w-10 rounded-full shadow-md hover:scale-105 transition-transform"
          >
            {isLoading ? (
              <div className="animate-spin w-4 h-4 border-2 border-background border-t-transparent rounded-full" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>

          {/* Speed Control */}
          <div className="flex border rounded-md overflow-hidden">
            {playbackRates.map((rate) => (
              <Button
                key={rate}
                variant={playbackRate === rate ? "default" : "ghost"}
                size="sm"
                onClick={() => setPlaybackRate(rate)}
                className="text-xs px-2 py-1 h-7 rounded-none border-r last:border-r-0"
              >
                {rate}x
              </Button>
            ))}
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            className="h-8 w-8 p-0 hover:bg-muted"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          
          <div className="w-16">
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.1}
              className="cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Loading state overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading audio...</p>
          </div>
        </div>
      )}
    </div>
  );
};