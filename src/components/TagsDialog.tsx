import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  const { savedTags, loading, createOrUpdateTag, getRecentTags, searchTags, useTags, fetchSavedTags } = useSavedTags();

  // Get recent and all tags
  const recentTags = getRecentTags(5).filter(savedTag => !tags.includes(savedTag.tag_name));
  const allTags = savedTags
    .filter(savedTag => !tags.includes(savedTag.tag_name))
    .sort((a, b) => {
      // Sort by usage count (desc) then by last_used_at (desc)
      if (b.usage_count !== a.usage_count) {
        return b.usage_count - a.usage_count;
      }
      return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
    });
  
  // Filter based on search query
  const searchResults = searchQuery.trim() 
    ? searchTags(searchQuery).filter(savedTag => !tags.includes(savedTag.tag_name))
    : null;

  // Refresh saved tags when dialog opens
  useEffect(() => {
    if (open) {
      fetchSavedTags();
    }
  }, [open, fetchSavedTags]);

  // Update usage when tags change
  useEffect(() => {
    if (tags.length > 0) {
      useTags(tags);
    }
  }, [tags, useTags]);

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
      <DialogContent className="sm:max-w-[500px] z-[1200]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Edit Tags
          </DialogTitle>
          <DialogDescription>
            Add tags to categorize and organize your content
          </DialogDescription>
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
          {!loading && (
            <div className="space-y-4">
              {/* Search Results */}
              {searchResults && searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Search Results</Label>
                  <ScrollArea className="max-h-[250px]">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {searchResults.map((savedTag) => (
                        <Badge
                          key={savedTag.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-accent justify-center text-center"
                          onClick={() => handleSavedTagClick(savedTag.tag_name)}
                        >
                          {savedTag.tag_name}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* Recent Tags */}
              {!searchQuery.trim() && recentTags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Recent Tags</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {recentTags.map((savedTag) => (
                      <Badge
                        key={savedTag.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent justify-center text-center"
                        onClick={() => handleSavedTagClick(savedTag.tag_name)}
                      >
                        {savedTag.tag_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* All Tags */}
              {!searchQuery.trim() && allTags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    All Tags ({allTags.length})
                  </Label>
                  <ScrollArea className="max-h-[300px]">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {allTags.map((savedTag) => (
                        <Badge
                          key={savedTag.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-accent justify-center text-center"
                          onClick={() => handleSavedTagClick(savedTag.tag_name)}
                        >
                          {savedTag.tag_name}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
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

          {tags.length === 0 && !loading && allTags.length === 0 && !searchQuery.trim() && (
            <div className="text-center py-8 text-muted-foreground">
              <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tags saved yet</p>
              <p className="text-sm">Add tags to help organize and categorize your content</p>
            </div>
          )}

          {searchQuery.trim() && searchResults && searchResults.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Hash className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p>No tags found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}