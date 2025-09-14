import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Upload, Clock, HardDrive, Server } from 'lucide-react';

interface QualityProgress {
  resolution: string;
  targetSize?: number;
  actualSize?: number;
  compressionRatio?: number;
  encodingProgress: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

interface DetailedUploadProgress {
  phase: 'processing' | 'uploading' | 'complete' | 'queued_for_processing';
  progress: number;
  message: string;
  originalSize?: number;
  processedSize?: number;
  compressionRatio?: number;
  bytesUploaded?: number;
  totalBytes?: number;
  uploadSpeed?: string;
  eta?: string;
  qualityProgress?: Record<string, QualityProgress>;
}

interface DetailedUploadProgressBarProps {
  fileName: string;
  fileType: string;
  progress: DetailedUploadProgress;
  isActive: boolean;
}

const formatFileSize = (bytes: number) => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export const DetailedUploadProgressBar = ({ 
  fileName, 
  fileType, 
  progress, 
  isActive 
}: DetailedUploadProgressBarProps) => {
  const isVideo = fileType.startsWith('video/');
  const isComplete = progress.phase === 'complete';
  const isQueued = progress.phase === 'queued_for_processing';
  const isLargeVideo = isVideo && (progress.originalSize || 0) > 100 * 1024 * 1024; // 100MB+
  
  return (
    <Card className={`p-4 transition-all duration-300 ${isActive ? 'ring-2 ring-primary' : ''}`}>
      <div className="space-y-4">
        {/* File Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              {isQueued ? (
                <Server className="w-4 h-4 text-orange-600" />
              ) : (
                <Upload className="w-4 h-4 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm truncate max-w-48">{fileName}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {isQueued ? 'Background Processing' : progress.phase}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium">
              {isQueued ? '100%' : Math.round(progress.progress)}%
            </p>
            {progress.uploadSpeed && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {progress.uploadSpeed}
              </p>
            )}
          </div>
        </div>

        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {isQueued 
                ? 'Large video queued for background processing on server' 
                : progress.message}
            </span>
            {progress.eta && !isQueued && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {progress.eta}
              </span>
            )}
          </div>
          <Progress 
            value={isQueued ? 100 : progress.progress} 
            className={`h-2 ${isQueued ? 'bg-orange-100' : ''}`}
          />
        </div>

        {/* Large Video Processing Notice */}
        {isLargeVideo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                4K/Large Video Processing
              </span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              {isQueued 
                ? 'Your large video is being processed on our high-performance servers. You\'ll receive a notification when it\'s ready.'
                : 'Processing multiple quality variants for optimal streaming performance.'}
            </p>
          </div>
        )}

        {/* Upload Bytes Progress */}
        {progress.bytesUploaded !== undefined && progress.totalBytes && !isQueued && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatFileSize(progress.bytesUploaded)} / {formatFileSize(progress.totalBytes)}
            </span>
            <span>{Math.round((progress.bytesUploaded / progress.totalBytes) * 100)}% uploaded</span>
          </div>
        )}

        {/* Quality Progress Grid for Videos */}
        {isVideo && progress.qualityProgress && !isQueued && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Quality Variants</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(progress.qualityProgress).map(([key, quality]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{quality.resolution}</span>
                    <Badge 
                      variant={quality.status === 'complete' ? 'default' : quality.status === 'processing' ? 'secondary' : 'outline'}
                      className="text-xs px-1 py-0"
                    >
                      {quality.status}
                    </Badge>
                  </div>
                  <Progress value={quality.encodingProgress} className="h-1" />
                  {quality.actualSize && quality.compressionRatio && (
                    <div className="text-xs text-muted-foreground">
                      <span>{formatFileSize(quality.actualSize)}</span>
                      {quality.compressionRatio > 0 && (
                        <span className="text-emerald-600 ml-1">
                          -{quality.compressionRatio}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Size Comparison */}
        {progress.originalSize && !isQueued && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Original:</span>
              <span className="font-medium">{formatFileSize(progress.originalSize)}</span>
            </div>
            
            {progress.processedSize && progress.compressionRatio && progress.compressionRatio > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Processed:</span>
                <span className="font-medium">{formatFileSize(progress.processedSize)}</span>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-xs">
                  -{progress.compressionRatio}%
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Final Summary for Completed Files */}
        {isComplete && progress.originalSize && progress.processedSize && progress.compressionRatio && progress.compressionRatio > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">
                  Space Saved: {formatFileSize(progress.originalSize - progress.processedSize)}
                </span>
              </div>
              <Badge className="bg-emerald-600 text-white">
                {progress.compressionRatio}% smaller
              </Badge>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};