import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, AtSign } from 'lucide-react';

interface MentionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentions: string[];
  onMentionsChange: (mentions: string[]) => void;
}

export function MentionsDialog({ open, onOpenChange, mentions, onMentionsChange }: MentionsDialogProps) {
  const [newMention, setNewMention] = useState('');

  const handleAddMention = () => {
    if (!newMention.trim()) return;
    
    let mentionToAdd = newMention.trim();
    // Add @ prefix if not present
    if (!mentionToAdd.startsWith('@')) {
      mentionToAdd = '@' + mentionToAdd;
    }
    
    if (!mentions.includes(mentionToAdd)) {
      onMentionsChange([...mentions, mentionToAdd]);
    }
    setNewMention('');
  };

  const handleRemoveMention = (mentionToRemove: string) => {
    onMentionsChange(mentions.filter(mention => mention !== mentionToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddMention();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AtSign className="h-5 w-5" />
            Edit Mentions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new mention */}
          <div>
            <Label className="text-sm font-medium">Add Mention</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="@username or @description"
                value={newMention}
                onChange={(e) => setNewMention(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button onClick={handleAddMention} disabled={!newMention.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Add @ mentions for people or topics in this content
            </p>
          </div>

          {/* Current mentions */}
          {mentions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Mentions:</Label>
              <ScrollArea className="max-h-[200px]">
                <div className="flex flex-wrap gap-2">
                  {mentions.map((mention, index) => (
                    <Badge
                      key={`${mention}-${index}`}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {mention}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive/20"
                        onClick={() => handleRemoveMention(mention)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {mentions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AtSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No mentions added yet</p>
              <p className="text-sm">Add mentions to tag people or topics</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}