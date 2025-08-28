import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useOptimizedUpload } from '@/hooks/useOptimizedUpload';
import { cn } from '@/lib/utils';

export const AdvancedFileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    uploadQueue,
    isUploading,
    currentUploadIndex,
    isProcessing,
    processingProgress,
    addFiles,
    startUpload,
    cancelUpload,
    removeFile,
    clearCompleted,
    retryProcessing
  } = useOptimizedUpload();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    addFiles(Array.from(files));
    // Reset input so same file can be selected again
    event.target.value = '';
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files) {
      addFiles(Array.from(files));
    }
  }, [addFiles]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'needs_retry':
        return <RefreshCw className="w-4 h-4 text-yellow-500" />;
      case 'processing':
      case 'uploading_original':
      case 'uploading_processed':
      case 'finalizing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'queued': return 'Queued';
      case 'processing': return 'Processing';
      case 'uploading_original': return 'Uploading original';
      case 'uploading_processed': return 'Uploading processed';
      case 'finalizing': return 'Finalizing';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      case 'needs_retry': return 'Needs optimization';
      default: return status;
    }
  };

  return (
    <Card className="w-full h-[calc(100vh-140px)]">
      <CardContent className="p-6 h-full flex flex-col">
        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-muted/20 border border-border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{processingProgress.message}</span>
              <span className="text-sm text-muted-foreground">
                {processingProgress.progress}%
              </span>
            </div>
            <Progress value={processingProgress.progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Phase: {processingProgress.phase}
            </p>
          </div>
        )}

        {/* Top Controls Row */}
        {uploadQueue.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {uploadQueue.filter(i => i.status === 'complete').length}/{uploadQueue.length} complete
              </Badge>
              {uploadQueue.filter(i => i.status === 'needs_retry').length > 0 && (
                <Badge variant="outline" className="text-yellow-600">
                  {uploadQueue.filter(i => i.status === 'needs_retry').length} need optimization
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {uploadQueue.length < 100 && !isProcessing && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Add More
                </Button>
              )}
              {isUploading ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={cancelUpload}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCompleted}
                    disabled={uploadQueue.filter(i => i.status === 'complete').length === 0}
                  >
                    Clear Complete
                  </Button>
                  <Button
                    size="sm"
                    onClick={startUpload}
                    disabled={uploadQueue.filter(i => i.status === 'queued' || i.status === 'error').length === 0}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Upload
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Upload Status */}
        {isUploading && uploadQueue.length > 0 && (
          <div className="bg-muted/20 border border-border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uploading files...</span>
              <span className="text-sm text-muted-foreground">
                {Math.min(currentUploadIndex + 1, uploadQueue.length)} of {uploadQueue.length}
              </span>
            </div>
            <Progress 
              value={uploadQueue.length > 0 ? (Math.min(currentUploadIndex + 1, uploadQueue.length) / uploadQueue.length) * 100 : 0} 
              className="h-2"
            />
          </div>
        )}

        {/* Upload Area - Only show when no files selected */}
        {uploadQueue.length === 0 && (
          <div 
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors flex-1 flex flex-col justify-center",
              "border-muted-foreground/25 hover:border-muted-foreground/50",
              "bg-muted/10 hover:bg-muted/20"
            )}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Upload Your Content</h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop files here or click to browse
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 h-10 w-auto min-w-0"
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mp3,.wav,.aac,.ogg,.pdf,.doc,.docx,.txt,.rtf"
            />
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p><strong>Optimized Processing:</strong></p>
              <p>📸 Images: Auto-converted to WebP for faster loading</p>
              <p>🎥 Videos: Encoded to H.264 (1080p/720p) for streaming</p>
              <p>🎵 Audio: Optimized to AAC for quality & size</p>
              <p>💡 Files are processed in your browser for speed & privacy</p>
              <p className="font-medium">Max 50MB per file, 100 files per batch</p>
            </div>
          </div>
        )}

        {/* Upload Queue - Takes remaining height */}
        {uploadQueue.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 border rounded-lg p-4">
              <div className="space-y-3">
                {uploadQueue.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">
                          {item.originalFile.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(item.originalFile.size)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {getStatusText(item.status)}
                        </Badge>
                        {item.processed && (
                          <Badge variant="secondary" className="text-xs">
                            Processed ({item.processed.metadata.format})
                          </Badge>
                        )}
                        {item.retryable && (
                          <Badge variant="outline" className="text-xs text-yellow-600">
                            Needs optimization
                          </Badge>
                        )}
                      </div>
                      
                      {item.progress > 0 && item.status !== 'complete' && (
                        <Progress value={item.progress} className="h-1 mb-1" />
                      )}
                      
                      {item.error && (
                        <p className="text-xs text-red-500 mt-1">{item.error}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {item.status === 'needs_retry' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryProcessing(item.id)}
                          className="px-2 py-1 h-auto text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Retry
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(item.id)}
                        disabled={item.status === 'uploading_original' || item.status === 'uploading_processed'}
                        className="px-2 py-1 h-auto"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Hidden input for upload more functionality */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mp3,.wav,.aac,.ogg,.pdf,.doc,.docx,.txt,.rtf"
        />

      </CardContent>
    </Card>
  );
};