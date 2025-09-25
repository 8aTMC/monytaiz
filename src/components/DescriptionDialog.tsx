import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText } from 'lucide-react';

const MAX_DESCRIPTION_LENGTH = 300;

interface DescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
}

export function DescriptionDialog({
  open,
  onOpenChange,
  description,
  onDescriptionChange,
}: DescriptionDialogProps) {
  const [localDescription, setLocalDescription] = useState(description);

  // Update local state when prop changes
  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  const handleSave = () => {
    onDescriptionChange(localDescription);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalDescription(description); // Reset to original value
    onOpenChange(false);
  };

  const remainingChars = MAX_DESCRIPTION_LENGTH - localDescription.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md z-[1200]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit Description
          </DialogTitle>
          <DialogDescription id="description-dialog-desc">Add a short description for this file.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Add a description for this media..."
              value={localDescription}
              onChange={(e) => {
                if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                  setLocalDescription(e.target.value);
                }
              }}
              rows={6}
              className="mt-1 resize-none"
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground">
                Describe what this content is about
              </p>
              <p className={`text-xs ${remainingChars < 20 ? 'text-orange-500' : remainingChars < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {remainingChars} characters remaining
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={remainingChars < 0}>
              Save Description
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}