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
  stepInfo?: { current: number; total: number } | null;
}

export const HEICWarningDialog = ({ open, onOpenChange, fileNames }: HEICWarningDialogProps) => {
  const handleContinue = () => {
    onOpenChange(false);
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
              The following files with HEIC extensions will be automatically processed 
              during upload for optimal compatibility:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {fileNames.map((name, index) => (
                <li key={index} className="flex items-center gap-1">
                  <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                  {name}
                </li>
              ))}
            </ul>
            <p className="text-sm text-emerald-600">
              ✓ True HEIC files will be converted to WebP format for better compatibility
            </p>
            <p className="text-sm text-blue-600">
              ✓ Files with HEIC extension but different format will be processed appropriately
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={handleContinue}>
            Continue with Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};