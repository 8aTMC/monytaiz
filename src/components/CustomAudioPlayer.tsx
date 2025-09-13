import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { SpeedSelector } from '@/components/ui/speed-selector';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomAudioPlayerProps {
  src: string;
  className?: string;
  title?: string;
  onError?: (error: any) => void;
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({
  src,
  className,
  title,
  onError
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      setIsLoading(false);
      console.error('Audio loading failed:', e, 'URL:', src);
      onError?.(e);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [src]);

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audio.currentTime = newTime;
  };

  const handleVolumeChange = (values: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newVolume = values[0];
    setVolume(newVolume);
    audio.volume = newVolume;
    
    if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
      audio.muted = true;
    } else if (newVolume > 0 && isMuted) {
      setIsMuted(false);
      audio.muted = false;
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    audio.muted = newMutedState;
  };

  const setSpeed = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    setPlaybackRate(rate);
    audio.playbackRate = rate;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playbackRates = [1, 1.5, 2];

  if (!src) {
    return (
      <div className={cn("w-full max-w-md mx-auto bg-card border rounded-lg p-4", className)}>
        <div className="text-center text-muted-foreground">
          No audio source provided
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-md mx-auto bg-card border rounded-lg p-4 space-y-4", className)}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
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
          <SpeedSelector
            currentSpeed={playbackRate}
            onSpeedChange={setSpeed}
            speeds={playbackRates}
            variant="audio"
          />
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

      {/* Loading state */}
      {isLoading && (
        <div className="text-center p-2 bg-muted/50 rounded">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Loading audio...</p>
        </div>
      )}
    </div>
  );
};