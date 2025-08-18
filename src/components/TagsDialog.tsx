import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Hash } from 'lucide-react';

interface TagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export const TagsDialog = ({
  open,
  onOpenChange,
  tags,
  onTagsChange,
}: TagsDialogProps) => {
  const [inputValue, setInputValue] = useState('');
  
  // Mock existing tags for suggestions
  const existingTags = [
    'workout', 'fitness', 'yoga', 'pilates', 'cardio',
    'lifestyle', 'fashion', 'beauty', 'cooking', 'travel',
    'lingerie', 'swimwear', 'bikini', 'casual', 'formal',
    'boobs', 'butt', 'legs', 'abs', 'face'
  ];

  const addTags = () => {
    if (inputValue.trim()) {
      // Split by spaces and add # prefix
      const newTags = inputValue
        .trim()
        .split(' ')
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .filter(tag => !tags.includes(tag));
      
      onTagsChange([...tags, ...newTags]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const addExistingTag = (tag: string) => {
    const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;
    if (!tags.includes(formattedTag)) {
      onTagsChange([...tags, formattedTag]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTags();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Tags</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current Tags */}
          {tags.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Current Tags ({tags.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTag(tag)}
                      className="h-4 w-4 p-0 hover:bg-transparent"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Add New Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Add New Tags</Label>
            <p className="text-xs text-muted-foreground">
              Separate tags with spaces. Each word becomes a separate tag with # prefix.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., workout fitness yoga"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                onClick={addTags}
                disabled={!inputValue.trim()}
                size="sm"
              >
                <Hash className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Suggested Tags */}
          <div>
            <Label className="text-sm font-medium">Suggested Tags</Label>
            <ScrollArea className="h-32 mt-2">
              <div className="flex flex-wrap gap-1">
                {existingTags
                  .filter(tag => !tags.includes(`#${tag}`))
                  .map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => addExistingTag(tag)}
                    >
                      #{tag}
                    </Badge>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};