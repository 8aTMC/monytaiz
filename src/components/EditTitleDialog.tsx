import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditTitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (title: string) => void;
}

export const EditTitleDialog: React.FC<EditTitleDialogProps> = ({
  open,
  onOpenChange,
  title,
  onTitleChange,
}) => {
  const [localTitle, setLocalTitle] = useState(title || '');
  const maxLength = 50;

  useEffect(() => {
    setLocalTitle(title || '');
  }, [title]);

  const handleSave = () => {
    if (localTitle.trim() && localTitle.length <= maxLength) {
      onTitleChange(localTitle.trim());
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setLocalTitle(title || '');
    onOpenChange(false);
  };

  const isOverLimit = localTitle.length > maxLength;
  const canSave = localTitle.trim() && !isOverLimit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Title</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              placeholder="Enter title..."
              maxLength={maxLength + 10} // Allow typing beyond limit for UX
            />
            <div className={`text-sm ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {localTitle.length}/{maxLength} characters
              {isOverLimit && ' (exceeds limit)'}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};