import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle, AlertCircle } from 'lucide-react';

interface DeletionProgressDialogProps {
  open: boolean;
  totalFiles: number;
  deletedFiles: number;
  isComplete: boolean;
  isError: boolean;
  errorMessage?: string;
  onClose: () => void;
}

export const DeletionProgressDialog = ({
  open,
  totalFiles,
  deletedFiles,
  isComplete,
  isError,
  errorMessage,
  onClose
}: DeletionProgressDialogProps) => {
  const progress = totalFiles > 0 ? (deletedFiles / totalFiles) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={() => {
      if (isComplete || isError) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isError ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : isComplete ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <Trash2 className="h-5 w-5" />
            )}
            {isError ? 'Deletion Failed' : isComplete ? 'Deletion Complete' : 'Deleting Files'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isError ? (
            <div className="text-sm text-destructive">
              {errorMessage || 'An error occurred while deleting files.'}
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                {isComplete 
                  ? `Successfully deleted ${deletedFiles} of ${totalFiles} files`
                  : `Deleting ${deletedFiles} of ${totalFiles} files...`
                }
              </div>
              
              <Progress value={progress} className="w-full" />
              
              <div className="text-xs text-muted-foreground text-center">
                {Math.round(progress)}% complete
              </div>
            </>
          )}
          
          {(isComplete || isError) && (
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};