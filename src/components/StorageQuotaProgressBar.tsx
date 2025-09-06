import React from 'react';
import { QuotaProgress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { HardDrive, AlertTriangle } from 'lucide-react';

// Storage constants - 7GB limit in binary (7 * 1024 * 1024 * 1024 bytes)
export const STORAGE_LIMIT_BYTES = 7 * 1024 * 1024 * 1024; // 7,516,192,768 bytes
export const STORAGE_LIMIT_MB = Math.floor(STORAGE_LIMIT_BYTES / (1024 * 1024)); // 7,168 MB

interface StorageQuotaProgressBarProps {
  totalSizeBytes: number;
  className?: string;
}

export function StorageQuotaProgressBar({ totalSizeBytes, className = "" }: StorageQuotaProgressBarProps) {
  const totalSizeMB = Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100;
  const percentage = Math.min((totalSizeBytes / STORAGE_LIMIT_BYTES) * 100, 100);
  
  // Color coding based on usage
  const getColorScheme = (): 'normal' | 'warning' | 'danger' => {
    if (percentage >= 95) return 'danger';
    if (percentage >= 85) return 'warning';
    return 'normal';
  };
  
  const getTextColor = () => {
    if (percentage >= 95) return 'text-destructive';
    if (percentage >= 85) return 'text-yellow-600';
    return 'text-primary';
  };
  
  const isNearLimit = percentage >= 85;
  const isOverLimit = totalSizeBytes > STORAGE_LIMIT_BYTES;

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Upload Limit</span>
            {isNearLimit && (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
          </div>
          <span className={`text-sm font-medium ${getTextColor()}`}>
            {totalSizeMB.toLocaleString()} MB / {STORAGE_LIMIT_MB.toLocaleString()} MB
          </span>
        </div>
        
        <div className="space-y-2">
          <QuotaProgress 
            value={percentage} 
            colorScheme={getColorScheme()}
            className="h-2"
          />
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {percentage.toFixed(1)}% used
            </span>
            {isOverLimit && (
              <span className="text-destructive font-medium">
                Exceeds limit by {((totalSizeBytes - STORAGE_LIMIT_BYTES) / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
            {isNearLimit && !isOverLimit && (
              <span className="text-yellow-600 font-medium">
                {((STORAGE_LIMIT_BYTES - totalSizeBytes) / (1024 * 1024)).toFixed(1)} MB remaining
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}