import { Badge } from '@/components/ui/badge';
import { VideoQuality, VideoQualityInfo } from '@/lib/videoQuality';

interface VideoQualityBadgeProps {
  qualityInfo: VideoQualityInfo;
  className?: string;
  showResolution?: boolean;
  width?: number;
  height?: number;
}

export const VideoQualityBadge = ({ 
  qualityInfo, 
  className = '',
  showResolution = false,
  width,
  height
}: VideoQualityBadgeProps) => {
  const getQualityColor = (quality: VideoQuality): string => {
    switch (quality) {
      case '480p':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case '720p':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case '1080p':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case '1440p':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case '4K':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const displayText = showResolution && width && height 
    ? `${qualityInfo.label} (${width}×${height})`
    : qualityInfo.label;

  return (
    <Badge 
      variant="outline"
      className={`${getQualityColor(qualityInfo.quality)} ${className}`}
    >
      {displayText}
      {!qualityInfo.isStandard && (
        <span className="ml-1 text-xs opacity-70">~</span>
      )}
    </Badge>
  );
};