import { Badge } from '@/components/ui/badge';
import { ArrowRight, Zap, CheckCircle } from 'lucide-react';

interface ConversionStatusBadgeProps {
  fileType: 'audio' | 'image' | 'video' | 'document';
  needsConversion?: boolean;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'paused' | 'cancelled';
  originalFormat?: string;
}

export const ConversionStatusBadge = ({ 
  fileType, 
  needsConversion, 
  status, 
  originalFormat 
}: ConversionStatusBadgeProps) => {
  if (!needsConversion) return null;

  const getTargetFormat = (type: typeof fileType) => {
    switch (type) {
      case 'audio': return 'WebM';
      case 'image': return 'WebP';
      case 'video': return 'Original';
      default: return 'Original';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'uploading': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-amber-600 bg-amber-50 border-amber-200';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      case 'uploading': return <Zap className="h-3 w-3 animate-pulse" />;
      default: return <ArrowRight className="h-3 w-3" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed': return 'Converted';
      case 'uploading': return 'Converting';
      default: return 'Will Convert';
    }
  };

  return (
    <Badge variant="outline" className={`text-xs ${getStatusColor()}`}>
      <div className="flex items-center gap-1">
        {getIcon()}
        <span>{originalFormat?.toUpperCase()}</span>
        <ArrowRight className="h-3 w-3" />
        <span>{getTargetFormat(fileType)}</span>
      </div>
    </Badge>
  );
};