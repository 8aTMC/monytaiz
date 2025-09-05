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
import { VideoQualityBadge } from './VideoQualityBadge';
import { getVideoMetadata, VideoQualityInfo } from '@/lib/videoQuality';
import { useSmartQuality, QualityLevel } from '@/hooks/useSmartQuality';
import { useOptimizedSecureMedia } from '@/hooks/useOptimizedSecureMedia';
import { useVideoQualityLoader } from '@/hooks/useVideoQualityLoader';

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
  const { availableQualities: processedQualities, loadQualities, getQualityByHeight } = useVideoQualityLoader(mediaId);

  // Load processed video qualities on mount
  useEffect(() => {
    if (mediaId) {
      loadQualities();
    }
  }, [mediaId, loadQualities]);

  // Load optimized video URL based on selected quality
  useEffect(() => {
    const loadOptimizedVideo = async () => {
      if (!storagePath) {
        setCurrentVideoUrl(src);
        return;
      }

      setQualityLoading(true);
      try {
        let videoUrl = src; // Default fallback

        // First, try to use processed quality variants
        if (processedQualities.length > 0) {
          const targetHeight = selectedQuality === '360p' ? 360 :
                              selectedQuality === '480p' ? 480 :
                              selectedQuality === '720p' ? 720 :
                              selectedQuality === '1080p' ? 1080 : 720;
          
          const bestQuality = getQualityByHeight(targetHeight);
          if (bestQuality?.url) {
            videoUrl = bestQuality.url;
            console.log(`Using processed quality: ${bestQuality.quality} for ${selectedQuality}`);
          }
        }

        // Fallback to image transforms if no processed qualities
        if (videoUrl === src && storagePath) {
          const transforms = qualityToTransforms(selectedQuality);
          const optimizedUrl = await getSecureUrl(storagePath, transforms, 'high');
          if (optimizedUrl) {
            videoUrl = optimizedUrl;
          }
        }

        setCurrentVideoUrl(videoUrl);
      } catch (error) {
        console.error('Failed to load optimized video:', error);
        setCurrentVideoUrl(src); // Final fallback
      } finally {
        setQualityLoading(false);
      }
    };

    loadOptimizedVideo();
  }, [src, storagePath, selectedQuality, processedQualities, getQualityByHeight, getSecureUrl]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(error => {
        console.error('Failed to play video:', error);
        onError?.(error);
      });
    }
  }, [isPlaying, onError]);

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
      if (video.videoWidth && video.videoHeight) {
        const calculatedAspectRatio = `${video.videoWidth}/${video.videoHeight}`;
        setVideoAspectRatio(calculatedAspectRatio);
        
        const qualityInfo = getVideoMetadata(video);
        setVideoQualityInfo(qualityInfo);
      }
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
        className="w-full h-full object-cover"
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
      {(isBuffering || qualityLoading || mediaLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
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
            {/* Quality Selector */}
            <Select
              value={isAutoMode ? 'auto' : selectedQuality}
              onValueChange={(value) => {
                if (value === 'auto') {
                  enableAutoQuality();
                } else {
                  setQuality(value as QualityLevel);
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
            {videoQualityInfo && (
              <VideoQualityBadge 
                qualityInfo={videoQualityInfo}
                className="text-white bg-black/50 border-white/20"
              />
            )}

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