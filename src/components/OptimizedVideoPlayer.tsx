import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings,
  SkipBack,
  SkipForward,
  Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { SpeedSelector } from './ui/speed-selector';
import { VolumeControl } from './ui/volume-control';
import { VideoQualityBadge } from './VideoQualityBadge';
import { getVideoMetadata, VideoQualityInfo } from '@/lib/videoQuality';
import { useSmartQuality, QualityLevel } from '@/hooks/useSmartQuality';
import { useOptimizedSecureMedia } from '@/hooks/useOptimizedSecureMedia';
import { useVideoQualityLoader } from '@/hooks/useVideoQualityLoader';
import { useAdaptiveStreaming } from '@/hooks/useAdaptiveStreaming';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

import { QualityTransitionNotification } from './QualityTransitionNotification';

interface OptimizedVideoPlayerProps {
  src: string;
  storagePath?: string;
  mediaId?: string;
  aspectRatio?: string;
  className?: string;
  onError?: (error: any) => void;
  autoQuality?: boolean;
}

const qualityToTransforms = (quality: QualityLevel) => {
  const transforms: { width?: number; height?: number; quality?: number } = {};
  
  switch (quality) {
    case '360p':
      transforms.height = 360;
      transforms.quality = 70;
      break;
    case '480p':
      transforms.height = 480;
      transforms.quality = 75;
      break;
    case '720p':
      transforms.height = 720;
      transforms.quality = 80;
      break;
    case '1080p':
      transforms.height = 1080;
      transforms.quality = 85;
      break;
    case '1440p':
      transforms.height = 1440;
      transforms.quality = 90;
      break;
    case '4k':
      transforms.height = 2160;
      transforms.quality = 95;
      break;
  }
  
  return transforms;
};

export const OptimizedVideoPlayer: React.FC<OptimizedVideoPlayerProps> = ({
  src,
  storagePath,
  mediaId,
  aspectRatio: propAspectRatio,
  className = '',
  onError,
  autoQuality = true
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
  const [currentVideoUrl, setCurrentVideoUrl] = useState(src);
  const [qualityLoading, setQualityLoading] = useState(false);

  const { selectedQuality, setQuality, enableAutoQuality, isAutoMode, config } = useSmartQuality({
    auto: autoQuality,
    availableQualities: ['360p', '480p', '720p', '1080p']
  });

  const { getSecureUrl, preloadMultipleQualities, loading: mediaLoading } = useOptimizedSecureMedia();
  
  // Performance monitoring
  const { 
    startTracking, 
    stopTracking, 
    trackVideoEvent, 
    trackBehaviorEvent,
    getDeviceInfo 
  } = usePerformanceMonitor();
  
  // Load available video qualities
  const { availableQualities: videoQualities, loading: qualitiesLoading, loadQualities } = useVideoQualityLoader(mediaId);
  
  // Adaptive streaming with network monitoring and quality management
  const {
    currentQuality: adaptiveQuality,
    recommendedQuality,
    bufferHealth,
    adaptiveEnabled,
    setManualQuality,
    enableAutoMode,
    lastDecision
  } = useAdaptiveStreaming(videoRef.current, config.availableQualities);

  // Load video qualities and setup adaptive streaming
  useEffect(() => {
    if (mediaId) {
      loadQualities();
    }
  }, [mediaId, loadQualities]);

  // Handle quality changes from adaptive streaming
  useEffect(() => {
    if (adaptiveEnabled && adaptiveQuality !== selectedQuality) {
      setQuality(adaptiveQuality);
      setQualityLoading(true);
      
      // Track quality change
      trackVideoEvent('qualitychange', { 
        from: selectedQuality,
        to: adaptiveQuality,
        automatic: true
      });
      
      // Generate new URL for the selected quality
      if (storagePath) {
        const transforms = qualityToTransforms(adaptiveQuality);
        getSecureUrl(storagePath, transforms, 'normal').then(url => {
          if (url && url !== currentVideoUrl) {
            setCurrentVideoUrl(url);
            setQualityLoading(false);
            trackVideoEvent('cachehit', { quality: adaptiveQuality });
          }
        });
      }
    }
  }, [adaptiveQuality, adaptiveEnabled, selectedQuality, setQuality, storagePath, getSecureUrl, currentVideoUrl, trackVideoEvent]);

  // Fallback URL update when not using adaptive mode
  useEffect(() => {
    if (!adaptiveEnabled && src !== currentVideoUrl) {
      setCurrentVideoUrl(src);
    }
  }, [adaptiveEnabled, src, currentVideoUrl]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      // Track pause event
      trackBehaviorEvent({
        eventType: 'pause',
        mediaId,
        interactionData: { 
          currentTime: videoRef.current.currentTime,
          position: (videoRef.current.currentTime / duration) * 100
        },
        pageUrl: window.location.href,
        deviceInfo: getDeviceInfo()
      });
    } else {
      videoRef.current.play().then(() => {
        // Track play event
        trackBehaviorEvent({
          eventType: 'play',
          mediaId,
          interactionData: { 
            currentTime: videoRef.current?.currentTime || 0,
            quality: selectedQuality
          },
          pageUrl: window.location.href,
          deviceInfo: getDeviceInfo()
        });
      }).catch(error => {
        console.error('Failed to play video:', error);
        onError?.(error);
        // Track error
        trackVideoEvent('error', { error: error.message });
      });
    }
  }, [isPlaying, onError, trackBehaviorEvent, trackVideoEvent, mediaId, getDeviceInfo, duration, selectedQuality]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

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

  const handleProgressChange = useCallback((value: number[]) => {
    if (!videoRef.current) return;
    const newTime = (value[0] / 100) * duration;
    videoRef.current.currentTime = newTime;
    setProgress(value);
  }, [duration]);

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

  const seek = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
  }, [currentTime, duration]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    if (!videoRef.current) return;
    
    try {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      trackVideoEvent('playbackratechange', { rate });
    } catch (error) {
      console.error('Failed to set playback rate:', error);
    }
  }, [trackVideoEvent]);

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
    const handleWaiting = () => {
      setIsBuffering(true);
      trackVideoEvent('waiting');
    };
    const handleCanPlay = () => {
      setIsBuffering(false);
      trackVideoEvent('canplaythrough');
    };
    const handleError = (e: Event) => {
      setIsBuffering(false);
      trackVideoEvent('error', { error: (e.target as HTMLVideoElement)?.error });
      onError?.(e);
    };
    const handleLoadedMetadata = () => {
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
        
        const qualityInfo = getVideoMetadata(video);
        setVideoQualityInfo(qualityInfo);
        
        // Track metadata loaded
        trackVideoEvent('loadedmetadata', { 
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      }
      // Initialize playback rate from video element
      setPlaybackRate(video.playbackRate || 1);
    };
    const handleLoadStart = () => {
      trackVideoEvent('loadstart');
      // Start performance tracking when video begins loading
      if (mediaId) {
        startTracking(mediaId);
      }
    };
    const handleEnded = () => {
      const completionPercentage = (video.currentTime / video.duration) * 100;
      stopTracking(video.currentTime, completionPercentage);
    };
    const handleRateChange = () => {
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
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('ended', handleEnded);
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
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('ratechange', handleRateChange);
    };
  }, [onError, trackVideoEvent, startTracking, stopTracking, mediaId]);

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
      style={{ aspectRatio: videoAspectRatio }}
      tabIndex={0}
    >
      <video 
        ref={videoRef}
        src={currentVideoUrl}
        className="w-full h-full object-contain"
        preload="metadata"
        playsInline
        webkit-playsinline="true"
        onDoubleClick={toggleFullscreen}
        onClick={togglePlayPause}
        style={{
          willChange: 'auto',
          backfaceVisibility: 'hidden',
          perspective: '1000px'
        }}
      />

      {/* Loading/Buffering Overlay */}
      {(isBuffering || qualityLoading || mediaLoading || qualitiesLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
            {adaptiveEnabled && lastDecision && (
              <span className="text-sm text-white/80">
                {lastDecision.shouldSwitch ? 'Switching quality...' : 'Optimizing...'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quality Transition Notifications */}
      {lastDecision && lastDecision.shouldSwitch && (
        <QualityTransitionNotification 
          transition={{
            from: selectedQuality,
            to: lastDecision.recommendedQuality,
            timestamp: Date.now()
          }}
        />
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
              variant="video"
            />

            {/* Quality Selector */}
            <Select
              value={adaptiveEnabled ? 'auto' : selectedQuality}
              onValueChange={(value) => {
                if (value === 'auto') {
                  enableAutoMode();
                } else {
                  setManualQuality(value as QualityLevel);
                }
              }}
            >
              <SelectTrigger className="w-20 h-7 text-xs text-white border-white/20 bg-black/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                {config.availableQualities.map((quality) => (
                  <SelectItem key={quality} value={quality}>
                    {quality.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quality Badge */}
            <div className="flex items-center gap-2">
              {videoQualityInfo && (
                <VideoQualityBadge 
                  qualityInfo={videoQualityInfo}
                  className="text-white bg-black/50 border-white/20"
                />
              )}
              {/* Current Quality Indicator */}
              <div className="px-2 py-1 text-xs font-medium text-white bg-black/50 border border-white/20 rounded">
                {(adaptiveEnabled ? adaptiveQuality : selectedQuality).toUpperCase()}
                {adaptiveEnabled && lastDecision?.shouldSwitch && (
                  <span className="ml-1 text-green-400">↗</span>
                )}
              </div>
              
              {/* Network monitoring has been simplified */}
              <div className="text-xs text-white/70">
                Network Status: Connected
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20 p-2"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};