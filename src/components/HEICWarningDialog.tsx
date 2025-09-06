import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface HEICWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileNames: string[];
}

export const HEICWarningDialog = ({ open, onOpenChange, fileNames }: HEICWarningDialogProps) => {
  const handleConvertClick = () => {
    window.open('https://www.freeconvert.com/heic-to-webp', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>HEIC Format Detected</DialogTitle>
          </div>
          <DialogDescription className="space-y-3">
            <p>
              The following images are in HEIC format and should be converted to WebP 
              to maximize compatibility and optimize memory usage:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {fileNames.map((name, index) => (
                <li key={index} className="flex items-center gap-1">
                  <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                  {name}
                </li>
              ))}
            </ul>
            <p>
              Please visit the conversion site and check the <strong>Lossless Compression</strong> box 
              for best results.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continue Anyway
          </Button>
          <Button onClick={handleConvertClick} className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Convert Files
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};