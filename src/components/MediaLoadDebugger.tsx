import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, X } from 'lucide-react';

interface MediaLoadDebuggerProps {
  storagePath?: string | null;
  currentUrl?: string | null;
  isLoading?: boolean;
  mediaError?: string | null;
  currentQuality?: string;
  usingFallback?: boolean;
  retryCount?: number;
}

export const MediaLoadDebugger: React.FC<MediaLoadDebuggerProps> = ({
  storagePath,
  currentUrl,
  isLoading,
  mediaError,
  currentQuality,
  usingFallback,
  retryCount = 0
}) => {
  if (process.env.NODE_ENV === 'production') return null;

  const getStatusIcon = () => {
    if (mediaError) return <X className="w-4 h-4 text-destructive" />;
    if (isLoading) return <Clock className="w-4 h-4 text-yellow-500" />;
    if (currentUrl) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <AlertCircle className="w-4 h-4 text-orange-500" />;
  };

  const getStatusText = () => {
    if (mediaError) return `Error: ${mediaError}`;
    if (isLoading) return 'Loading...';
    if (currentUrl) return 'Loaded successfully';
    return 'No URL available';
  };

  return (
    <div className="absolute top-2 right-2 z-50 bg-black/80 text-white p-2 rounded text-xs space-y-1 min-w-[200px]">
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>
      
      <div className="space-y-1 text-xs opacity-90">
        <div>Path: {storagePath || 'None'}</div>
        {currentQuality && (
          <div className="flex items-center gap-2">
            Quality: 
            <Badge variant="outline" className="text-xs h-auto py-0">
              {currentQuality.toUpperCase()}
            </Badge>
            {usingFallback && (
              <Badge variant="secondary" className="text-xs h-auto py-0">
                FALLBACK
              </Badge>
            )}
          </div>
        )}
        {retryCount > 0 && (
          <div>Retries: {retryCount}/3</div>
        )}
        {currentUrl && (
          <div className="break-all">
            URL: {currentUrl.substring(0, 50)}...
          </div>
        )}
      </div>
    </div>
  );
};