import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings
} from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';

interface SimpleAdaptiveVideoPlayerProps {
  src: string;
  aspectRatio?: string;
  className?: string;
  onError?: (error: any) => void;
  autoPlay?: boolean;
}

export const SimpleAdaptiveVideoPlayer: React.FC<SimpleAdaptiveVideoPlayerProps> = ({
  src,
  aspectRatio = '16/9',
  className = '',
  onError,
  autoPlay = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Basic state management
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([1]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState([0]);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(error => {
        console.error('Play failed:', error);
        onError?.(error);
      });
    }
  }, [isPlaying, onError]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    if (!videoRef.current) return;
    const newVolume = value[0];
    videoRef.current.volume = newVolume;
    setVolume([newVolume]);
    if (newVolume === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  }, [isMuted]);

  // Handle progress change
  const handleProgressChange = useCallback((value: number[]) => {
    if (!videoRef.current || !duration) return;
    const newTime = (value[0] / 100) * duration;
    videoRef.current.currentTime = newTime;
    setProgress(value);
  }, [duration]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration) {
        setProgress([(video.currentTime / video.duration) * 100]);
      }
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleVolumeChange = () => {
      setVolume([video.volume]);
      setIsMuted(video.muted);
    };
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleError = (e: Event) => {
      setIsBuffering(false);
      console.error('Video error:', e);
      onError?.(e);
    };

    // Add event listeners
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [onError]);

  return (
    <div 
      ref={containerRef}
      className={`relative group rounded-xl overflow-hidden bg-black ${className}`}
      style={{ aspectRatio }}
    >
      <video 
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        preload="metadata"
        autoPlay={autoPlay}
        onClick={togglePlayPause}
      />

      {/* Loading/Buffering Overlay */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
        </div>
      )}

      {/* Status Badge */}
      <div className="absolute top-4 left-4">
        <Badge variant="secondary" className="bg-black/50 text-white border-white/20">
          Stable Player
        </Badge>
      </div>

      {/* Controls Overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
        {/* Progress Bar */}
        <div className="mb-4">
          <Slider
            value={progress}
            onValueChange={handleProgressChange}
            max={100}
            step={0.1}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-white/70 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlayPause}
              className="text-white hover:bg-white/20 p-2"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="text-white hover:bg-white/20 p-2"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>

            <div className="w-20">
              <Slider
                value={volume}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.01}
                className="cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};