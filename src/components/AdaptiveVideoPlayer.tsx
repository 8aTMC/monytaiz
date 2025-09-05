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
  SkipForward,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { VideoQualityBadge } from './VideoQualityBadge';
import { useAdaptiveQuality, QualityLevel } from '@/hooks/useAdaptiveQuality';
import { useProgressiveVideoLoading } from '@/hooks/useProgressiveVideoLoading';
import { useBandwidthDetection } from '@/hooks/useBandwidthDetection';
import { detectVideoQuality, VideoQualityInfo } from '@/lib/videoQuality';

interface AdaptiveVideoPlayerProps {
  mediaId: string;
  src?: string; // Fallback src if adaptive fails
  aspectRatio?: string;
  className?: string;
  onError?: (error: any) => void;
  autoPlay?: boolean;
  startQuality?: QualityLevel;
}

export const AdaptiveVideoPlayer: React.FC<AdaptiveVideoPlayerProps> = ({
  mediaId,
  src: fallbackSrc,
  aspectRatio: propAspectRatio,
  className = '',
  onError,
  autoPlay = false,
  startQuality = '480p'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State management
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
  const [showQualitySettings, setShowQualitySettings] = useState(false);

  // Adaptive streaming hooks
  const adaptiveQuality = useAdaptiveQuality(mediaId, videoRef.current);
  const progressiveLoading = useProgressiveVideoLoading(mediaId, startQuality);
  const { bandwidth, isDetecting } = useBandwidthDetection();

  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format bandwidth for display
  const formatBandwidth = (speed: number) => {
    return speed < 1 ? `${(speed * 1000).toFixed(0)} Kbps` : `${speed.toFixed(1)} Mbps`;
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
    } catch (error) {
      console.error('Failed to set playback rate:', error);
    }
  }, []);

  // Handle manual quality selection
  const handleQualityChange = useCallback((quality: string) => {
    const qualityLevel = quality as QualityLevel;
    adaptiveQuality.setManualQuality(qualityLevel);
    setShowQualitySettings(false);
  }, [adaptiveQuality]);

  // Switch video source when quality changes
  useEffect(() => {
    if (!videoRef.current || !progressiveLoading.primaryUrl) return;

    const video = videoRef.current;
    const wasPlaying = !video.paused;
    const currentTimeStamp = video.currentTime;

    // Use progressive loading URL for adaptive quality
    if (adaptiveQuality.currentQuality && progressiveLoading.isQualityReady(adaptiveQuality.currentQuality)) {
      progressiveLoading.getUrlForQuality(adaptiveQuality.currentQuality).then(url => {
        if (url && url !== video.src) {
          video.src = url;
          video.currentTime = currentTimeStamp;
          if (wasPlaying) {
            video.play().catch(console.error);
          }
        }
      });
    } else if (progressiveLoading.primaryUrl !== video.src) {
      // Use primary URL from progressive loading
      video.src = progressiveLoading.primaryUrl;
      video.currentTime = currentTimeStamp;
      if (wasPlaying) {
        video.play().catch(console.error);
      }
    }
  }, [adaptiveQuality.currentQuality, progressiveLoading.primaryUrl, progressiveLoading.isQualityReady]);

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
    const handleLoadedMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        const calculatedAspectRatio = `${video.videoWidth}/${video.videoHeight}`;
        setVideoAspectRatio(calculatedAspectRatio);
        
        const qualityInfo = detectVideoQuality(video.videoWidth, video.videoHeight);
        setVideoQualityInfo(qualityInfo);
      }
      setPlaybackRate(video.playbackRate || 1);
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
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

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

  // Auto-play when ready
  useEffect(() => {
    if (autoPlay && videoRef.current && progressiveLoading.primaryUrl && !isPlaying) {
      videoRef.current.play().catch(console.error);
    }
  }, [autoPlay, progressiveLoading.primaryUrl, isPlaying]);

  // Fallback to src if adaptive loading fails
  const videoSrc = progressiveLoading.primaryUrl || fallbackSrc || '';

  if (progressiveLoading.error && !fallbackSrc) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-xl p-8 ${className}`}>
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load video</p>
          <p className="text-sm text-muted-foreground">{progressiveLoading.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative group rounded-xl overflow-hidden bg-black ${className}`}
      style={{ aspectRatio: videoAspectRatio }}
      tabIndex={0}
    >
      <video 
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-cover"
        preload="metadata"
        onDoubleClick={toggleFullscreen}
        onClick={togglePlayPause}
      />

      {/* Loading/Buffering Overlay */}
      {(isBuffering || progressiveLoading.loadingQuality) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="text-center text-white">
            <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full mb-2 mx-auto" />
            {progressiveLoading.loadingQuality && (
              <p className="text-sm">Loading {progressiveLoading.loadingQuality}...</p>
            )}
          </div>
        </div>
      )}

      {/* Network Status Indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        {isDetecting ? (
          <Badge variant="secondary" className="bg-black/50 text-white border-white/20">
            <div className="animate-spin w-3 h-3 border border-white/30 border-t-white rounded-full mr-1" />
            Detecting...
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-black/50 text-white border-white/20">
            {bandwidth.quality === 'fast' ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {formatBandwidth(bandwidth.speed)}
          </Badge>
        )}
      </div>

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

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Playback Speed */}
            <div className="flex border border-white/20 rounded-md overflow-hidden">
              {playbackSpeeds.map((speed) => (
                <Button
                  key={speed}
                  variant={playbackRate === speed ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePlaybackRateChange(speed)}
                  className={`text-xs px-2 py-1 h-7 rounded-none border-r border-white/20 last:border-r-0 ${
                    playbackRate === speed 
                      ? 'bg-white text-black hover:bg-white/90' 
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  {speed}x
                </Button>
              ))}
            </div>

            {/* Quality Selector */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQualitySettings(!showQualitySettings)}
                className="text-white hover:bg-white/20 p-2"
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              {showQualitySettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg p-2 min-w-40">
                  <div className="text-xs text-white/70 mb-2">Quality</div>
                  {adaptiveQuality.availableQualities.map((quality) => (
                    <Button
                      key={quality.level}
                      variant={adaptiveQuality.currentQuality === quality.level ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleQualityChange(quality.level)}
                      className="w-full justify-start text-white hover:bg-white/20 mb-1"
                    >
                      {quality.level} • {quality.width}×{quality.height}
                      {progressiveLoading.isQualityReady(quality.level) && (
                        <span className="ml-auto text-green-400">✓</span>
                      )}
                    </Button>
                  ))}
                  
                  <div className="border-t border-white/20 pt-2 mt-2">
                    <Button
                      variant={adaptiveQuality.isAdaptive ? "default" : "ghost"}
                      size="sm"
                      onClick={() => adaptiveQuality.setManualQuality(null)}
                      className="w-full justify-start text-white hover:bg-white/20"
                    >
                      Auto ({adaptiveQuality.currentQuality})
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Badge */}
            {videoQualityInfo && (
              <VideoQualityBadge 
                qualityInfo={videoQualityInfo}
                className="text-white bg-black/50 border-white/20"
              />
            )}

            {/* Buffer Health Indicator */}
            <Badge 
              variant="outline" 
              className={`text-xs ${
                adaptiveQuality.bufferHealth.health === 'critical' ? 'border-red-500 text-red-400' :
                adaptiveQuality.bufferHealth.health === 'low' ? 'border-yellow-500 text-yellow-400' :
                'border-green-500 text-green-400'
              } bg-black/50 border-opacity-50`}
            >
              {adaptiveQuality.bufferHealth.buffered.toFixed(1)}s
            </Badge>

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

      {/* Quality switching indicator */}
      {adaptiveQuality.targetQuality !== adaptiveQuality.currentQuality && (
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="bg-blue-500/80 text-white border-blue-400/20">
            Switching to {adaptiveQuality.targetQuality}...
          </Badge>
        </div>
      )}
    </div>
  );
};