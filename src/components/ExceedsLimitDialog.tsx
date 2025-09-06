import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Upload, X, CheckCircle } from 'lucide-react';
import { STORAGE_LIMIT_MB } from './StorageQuotaProgressBar';

export interface FileWithStatus {
  id: string;
  file: File;
  name: string;
  size: number;
  canUpload: boolean;
}

interface ExceedsLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filesAnalysis: FileWithStatus[];
  totalCurrentSize: number;
  onProceedWithPartial: () => void;
  onCancel: () => void;
}

export function ExceedsLimitDialog({
  open,
  onOpenChange,
  filesAnalysis,
  totalCurrentSize,
  onProceedWithPartial,
  onCancel
}: ExceedsLimitDialogProps) {
  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const filesToUpload = filesAnalysis.filter(f => f.canUpload);
  const filesToExclude = filesAnalysis.filter(f => !f.canUpload);
  
  const totalSizeToUpload = filesToUpload.reduce((acc, f) => acc + f.size, 0);
  const totalSizeExcluded = filesToExclude.reduce((acc, f) => acc + f.size, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <DialogTitle>Storage Limit Exceeded</DialogTitle>
          </div>
          <DialogDescription>
            The selected files exceed your {STORAGE_LIMIT_MB.toLocaleString()} MB storage limit. 
            You can upload the files that fit within your current quota.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium">Can Upload</span>
              </div>
              <div className="mt-1">
                <div className="text-lg font-bold text-green-600">
                  {filesToUpload.length} files
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatFileSize(totalSizeToUpload)}
                </div>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <X className="w-4 h-4 text-red-500" />
                <span className="font-medium">Will be Excluded</span>
              </div>
              <div className="mt-1">
                <div className="text-lg font-bold text-red-600">
                  {filesToExclude.length} files
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatFileSize(totalSizeExcluded)}
                </div>
              </div>
            </Card>
          </div>

          {/* Files that can be uploaded */}
          {filesToUpload.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-green-600 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Files to Upload ({filesToUpload.length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {filesToUpload.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                    <span className="truncate flex-1">{file.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {formatFileSize(file.size)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files that will be excluded */}
          {filesToExclude.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-red-600 mb-2 flex items-center gap-2">
                <X className="w-4 h-4" />
                Files to Exclude ({filesToExclude.length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {filesToExclude.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm">
                    <span className="truncate flex-1">{file.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {formatFileSize(file.size)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storage info */}
          <Card className="p-3 bg-muted/50">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Current usage:</span>
                <span className="font-medium">
                  {formatFileSize(totalCurrentSize)} / {STORAGE_LIMIT_MB.toLocaleString()} MB
                </span>
              </div>
              <div className="flex justify-between">
                <span>After upload:</span>
                <span className="font-medium">
                  {formatFileSize(totalCurrentSize + totalSizeToUpload)} / {STORAGE_LIMIT_MB.toLocaleString()} MB
                </span>
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel Upload
          </Button>
          {filesToUpload.length > 0 && (
            <Button onClick={onProceedWithPartial} className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload {filesToUpload.length} Files
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}