import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Settings,
  SkipBack,
  SkipForward
} from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { SpeedSelector } from './ui/speed-selector';
import { VolumeControl } from './ui/volume-control';
import { VideoQualityBadge } from './VideoQualityBadge';
import { getVideoMetadata, VideoQualityInfo } from '@/lib/videoQuality';

interface EnhancedVideoPlayerProps {
  src: string;
  aspectRatio?: string;
  className?: string;
  onError?: (error: any) => void;
}

export const EnhancedVideoPlayer: React.FC<EnhancedVideoPlayerProps> = ({
  src,
  aspectRatio: propAspectRatio,
  className = '',
  onError
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([1]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState([0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(propAspectRatio || '16/9');
  const [videoQualityInfo, setVideoQualityInfo] = useState<VideoQualityInfo | null>(null);

  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 5];

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
      videoRef.current.play();
    }
  }, [isPlaying]);

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
    if (!videoRef.current) return;
    const newTime = (value[0] / 100) * duration;
    videoRef.current.currentTime = newTime;
    setProgress(value);
  }, [duration]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  // Seek forward/backward
  const seek = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
  }, [currentTime, duration]);

  // Handle playback rate change
  const handlePlaybackRateChange = useCallback((rate: number) => {
    if (!videoRef.current) return;
    
    try {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      console.log('Playback rate changed to:', rate);
    } catch (error) {
      console.error('Failed to set playback rate:', error);
    }
  }, []);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress([(video.currentTime / video.duration) * 100]);
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
      onError?.(e);
    };
    const handleLoadedMetadata = () => {
      // Update aspect ratio based on video's natural dimensions
      if (video.videoWidth && video.videoHeight) {
        const isVertical = video.videoHeight > video.videoWidth;
        const isSquare = Math.abs(video.videoWidth - video.videoHeight) < 10;
        
        let calculatedAspectRatio;
        if (isSquare) {
          calculatedAspectRatio = '1/1';
        } else if (isVertical) {
          // Common vertical ratios
          const ratio = video.videoWidth / video.videoHeight;
          if (ratio > 0.5) calculatedAspectRatio = '9/16';
          else if (ratio > 0.4) calculatedAspectRatio = '2/3';
          else calculatedAspectRatio = `${video.videoWidth}/${video.videoHeight}`;
        } else {
          // Horizontal videos
          calculatedAspectRatio = `${video.videoWidth}/${video.videoHeight}`;
        }
        
        setVideoAspectRatio(calculatedAspectRatio);
        
        // Get video quality info
        const qualityInfo = getVideoMetadata(video);
        setVideoQualityInfo(qualityInfo);
      }
      // Initialize playback rate from video element
      setPlaybackRate(video.playbackRate || 1);
    };
    const handleRateChange = () => {
      // Sync playback rate state with actual video playback rate
      setPlaybackRate(video.playbackRate);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ratechange', handleRateChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ratechange', handleRateChange);
    };
  }, [onError]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'ArrowLeft':
          seek(-10);
          break;
        case 'ArrowRight':
          seek(10);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [togglePlayPause, toggleMute, toggleFullscreen, seek]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const resetTimeout = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', resetTimeout);
      container.addEventListener('mouseenter', resetTimeout);
      
      return () => {
        container.removeEventListener('mousemove', resetTimeout);
        container.removeEventListener('mouseenter', resetTimeout);
        clearTimeout(timeout);
      };
    }
  }, [isPlaying]);

  return (
    <div 
      ref={containerRef}
      className={`relative group rounded-xl overflow-hidden bg-black ${className}`}
      tabIndex={0}
      style={{
        aspectRatio: propAspectRatio || videoAspectRatio
      }}
    >
      <video 
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        preload="metadata"
        onDoubleClick={toggleFullscreen}
        onClick={togglePlayPause}
      />

      {/* Loading/Buffering Overlay */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
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
          {/* Left Controls */}
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
              onClick={() => seek(-10)}
              className="text-white hover:bg-white/20 p-2"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => seek(10)}
              className="text-white hover:bg-white/20 p-2"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <VolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              variant="video"
            />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Playback Speed Controls */}
            <SpeedSelector
              currentSpeed={playbackRate}
              onSpeedChange={handlePlaybackRateChange}
              speeds={playbackSpeeds}
              variant="video"
            />

            {/* Video Quality Badge */}
            {videoQualityInfo && (
              <div className="flex items-center">
                <VideoQualityBadge 
                  qualityInfo={videoQualityInfo}
                  className="text-white bg-black/50 border-white/20"
                />
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20 p-2"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};