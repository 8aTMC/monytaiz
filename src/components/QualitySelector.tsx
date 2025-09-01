import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface QualitySelectorProps {
  qualities: {
    '480p'?: string;
    '720p'?: string;
    '1080p'?: string;
  };
  currentQuality: string;
  onQualityChange: (quality: string) => void;
  className?: string;
}

export const QualitySelector = ({ 
  qualities, 
  currentQuality, 
  onQualityChange, 
  className = "" 
}: QualitySelectorProps) => {
  const availableQualities = Object.keys(qualities).filter(q => qualities[q as keyof typeof qualities]);
  
  if (availableQualities.length <= 1) {
    return null; // Don't show selector if only one quality available
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium text-muted-foreground">Quality:</span>
      <div className="flex items-center gap-1">
        {availableQualities.map((quality) => (
          <Button
            key={quality}
            variant={currentQuality === quality ? "default" : "outline"}
            size="sm"
            onClick={() => onQualityChange(quality)}
            className="text-xs px-3 py-1 h-7"
          >
            {quality}
          </Button>
        ))}
      </div>
      {currentQuality === '480p' && (
        <Badge variant="secondary" className="text-xs">
          Fast Loading
        </Badge>
      )}
    </div>
  );
};