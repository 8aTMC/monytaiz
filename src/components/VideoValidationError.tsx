import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface VideoValidationErrorProps {
  error: string;
  file: File;
  onRemove: () => void;
}

export const VideoValidationError = ({ error, file, onRemove }: VideoValidationErrorProps) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-destructive mb-1">Upload Error</h3>
          <p className="text-sm text-muted-foreground mb-2">
            <strong>{file.name}</strong> ({formatFileSize(file.size)})
          </p>
          <p className="text-sm text-destructive mb-3">{error}</p>
          <div className="text-xs text-muted-foreground mb-3">
            <p><strong>Supported limits:</strong></p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li>Maximum file size: 200MB</li>
              <li>Maximum resolution: 1920x1080 (1080p)</li>
              <li>Requires modern browser with SharedArrayBuffer support</li>
            </ul>
          </div>
          <button
            onClick={onRemove}
            className="text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded hover:bg-destructive/90 transition-colors"
          >
            Remove File
          </button>
        </div>
      </div>
    </div>
  );
};