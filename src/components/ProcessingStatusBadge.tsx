import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, Server } from 'lucide-react';

interface ProcessingStatusBadgeProps {
  status: 'processing' | 'processed' | 'failed' | 'server_processing';
  path?: string;
  metrics?: {
    compression_ratio?: number;
    processing_time?: number;
  };
  className?: string;
}

export const ProcessingStatusBadge: React.FC<ProcessingStatusBadgeProps> = ({
  status,
  path,
  metrics,
  className
}) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'processing':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Processing...',
          variant: 'secondary' as const
        };
      
      case 'server_processing':
        return {
          icon: <Server className="h-3 w-3" />,
          text: 'Processing on server...',
          variant: 'secondary' as const
        };
      
      case 'processed':
        const pathLabel = getPathLabel(path);
        const compressionText = metrics?.compression_ratio 
          ? ` (-${metrics.compression_ratio}%)`
          : '';
        
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          text: `${pathLabel}${compressionText}`,
          variant: 'default' as const
        };
      
      case 'failed':
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: 'Processing failed',
          variant: 'destructive' as const
        };
      
      default:
        return {
          icon: null,
          text: 'Unknown status',
          variant: 'secondary' as const
        };
    }
  };

  const getPathLabel = (path?: string) => {
    switch (path) {
      case 'jpeg_passthrough':
        return 'JPEG detected';
      case 'webp_local':
        return 'Converted to WebP';
      case 'webp_server':
        return 'Converted to WebP (server)';
      case 'jpeg_fallback':
        return 'Converted to JPEG';
      default:
        return 'Processed';
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Badge 
      variant={statusInfo.variant}
      className={`inline-flex items-center gap-1 text-xs ${className}`}
    >
      {statusInfo.icon}
      {statusInfo.text}
    </Badge>
  );
};