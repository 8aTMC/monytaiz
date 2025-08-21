import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface Creator {
  id: string;
  name: string;
  url: string;
}

interface CreatorTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creators: Creator[];
  onCreatorsChange: (creators: Creator[]) => void;
}

export const CreatorTagDialog = ({
  open,
  onOpenChange,
  creators,
  onCreatorsChange,
}: CreatorTagDialogProps) => {
  const [newCreatorName, setNewCreatorName] = useState('');
  const [newCreatorUrl, setNewCreatorUrl] = useState('');

  const addCreator = () => {
    if (newCreatorName.trim() && newCreatorUrl.trim() && creators.length < 10) {
      const newCreator: Creator = {
        id: Date.now().toString(),
        name: newCreatorName.trim(),
        url: newCreatorUrl.trim(),
      };
      onCreatorsChange([...creators, newCreator]);
      setNewCreatorName('');
      setNewCreatorUrl('');
    }
  };

  const removeCreator = (id: string) => {
    onCreatorsChange(creators.filter(c => c.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tag Creators</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current Tagged Creators */}
          {creators.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Tagged Creators ({creators.length}/10)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {creators.map((creator) => (
                  <Badge key={creator.id} variant="secondary" className="flex items-center gap-1">
                    {creator.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCreator(creator.id)}
                      className="h-4 w-4 p-0 hover:bg-transparent"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Add New Creator */}
          {creators.length < 10 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Add New Creator</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Creator display name"
                  value={newCreatorName}
                  onChange={(e) => setNewCreatorName(e.target.value)}
                />
                <Input
                  placeholder="Creator URL"
                  value={newCreatorUrl}
                  onChange={(e) => setNewCreatorUrl(e.target.value)}
                />
                <Button
                  onClick={addCreator}
                  disabled={!newCreatorName.trim() || !newCreatorUrl.trim()}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Creator
                </Button>
              </div>
            </div>
          )}

          {creators.length >= 10 && (
            <p className="text-sm text-muted-foreground text-center">
              Maximum of 10 creators reached
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};