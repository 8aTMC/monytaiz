import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Hash, Search } from 'lucide-react';
import { useSavedTags } from '@/hooks/useSavedTags';

interface TagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagsDialog({ open, onOpenChange, tags, onTagsChange }: TagsDialogProps) {
  const [newTag, setNewTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { savedTags, loading, createOrUpdateTag, getRecentTags, searchTags, useTags } = useSavedTags();

  const filteredTags = searchQuery.trim() 
    ? searchTags(searchQuery)
    : getRecentTags(5);

  // Update usage when tags change
  useEffect(() => {
    if (tags.length > 0) {
      useTags(tags);
    }
  }, [tags]);

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    
    const tagToAdd = newTag.trim();
    if (!tags.includes(tagToAdd)) {
      onTagsChange([...tags, tagToAdd]);
      createOrUpdateTag(tagToAdd); // Save to database
    }
    setNewTag('');
  };

  const handleSavedTagClick = (tagName: string) => {
    if (!tags.includes(tagName)) {
      onTagsChange([...tags, tagName]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Edit Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search saved tags */}
          <div>
            <Label className="text-sm font-medium">Search Tags</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search saved tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Saved tags list */}
          {!loading && filteredTags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {searchQuery.trim() ? 'Search Results:' : 'Recent Tags:'}
              </Label>
              <ScrollArea className="max-h-[150px]">
                <div className="flex flex-wrap gap-2">
                  {filteredTags.map((savedTag) => (
                    <Badge
                      key={savedTag.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => handleSavedTagClick(savedTag.tag_name)}
                    >
                      {savedTag.tag_name}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Add new tag */}
          <div>
            <Label className="text-sm font-medium">Add New Tag</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Enter tag keyword"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button onClick={handleAddTag} disabled={!newTag.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Add new tags to categorize and organize your content
            </p>
          </div>

          {/* Current tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Tags:</Label>
              <ScrollArea className="max-h-[200px]">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge
                      key={`${tag}-${index}`}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {tag}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive/20"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {tags.length === 0 && !loading && filteredTags.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tags added yet</p>
              <p className="text-sm">Add tags to help organize and categorize your content</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}