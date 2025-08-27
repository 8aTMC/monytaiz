import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Tags, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  name: string;
  count: number;
}

interface TagsDialogProps {
  children?: React.ReactNode;
  onTagsUpdated?: () => void;
}

export function TagManagementDialog({ children, onTagsUpdated }: TagsDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);

  const defaultTags = ['upload', 'story', 'livestream', 'message'];

  const fetchTags = async () => {
    try {
      setLoading(true);
      
      // Get tags from both media and content_files tables
      const [mediaResult, contentResult] = await Promise.all([
        supabase
          .from('media')
          .select('tags')
          .not('tags', 'is', null),
        supabase
          .from('content_files')
          .select('tags')
          .not('tags', 'is', null)
      ]);

      if (mediaResult.error) throw mediaResult.error;
      if (contentResult.error) throw contentResult.error;

      // Combine and count tags
      const allTags: string[] = [];
      
      [...(mediaResult.data || []), ...(contentResult.data || [])].forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          allTags.push(...item.tags.filter(tag => !defaultTags.includes(tag.toLowerCase())));
        }
      });

      // Count occurrences
      const tagCounts: Record<string, number> = {};
      allTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      // Convert to array and sort by count
      const tagsArray = Object.entries(tagCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setTags(tagsArray);
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast({
        title: "Error",
        description: "Failed to load tags",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    const tagName = newTagName.trim();
    
    // Check if tag already exists
    if (tags.some(tag => tag.name.toLowerCase() === tagName.toLowerCase())) {
      toast({
        title: "Error",
        description: "Tag already exists",
        variant: "destructive",
      });
      return;
    }

    // Add to tags list
    setTags(prev => [...prev, { name: tagName, count: 0 }].sort((a, b) => b.count - a.count));
    setNewTagName('');
    
    toast({
      title: "Success",
      description: `Tag "${tagName}" added`,
    });
  };

  const handleDeleteSelectedTags = async () => {
    if (selectedTags.size === 0) return;

    try {
      setLoading(true);
      const tagsToDelete = Array.from(selectedTags);

      // Remove tags from media table
      const { data: mediaItems } = await supabase
        .from('media')
        .select('id, tags')
        .not('tags', 'is', null);

      if (mediaItems) {
        for (const item of mediaItems) {
          if (item.tags && Array.isArray(item.tags)) {
            const filteredTags = item.tags.filter(tag => !tagsToDelete.includes(tag));
            if (filteredTags.length !== item.tags.length) {
              await supabase
                .from('media')
                .update({ tags: filteredTags })
                .eq('id', item.id);
            }
          }
        }
      }

      // Remove tags from content_files table
      const { data: contentItems } = await supabase
        .from('content_files')
        .select('id, tags')
        .not('tags', 'is', null);

      if (contentItems) {
        for (const item of contentItems) {
          if (item.tags && Array.isArray(item.tags)) {
            const filteredTags = item.tags.filter(tag => !tagsToDelete.includes(tag));
            if (filteredTags.length !== item.tags.length) {
              await supabase
                .from('content_files')
                .update({ tags: filteredTags })
                .eq('id', item.id);
            }
          }
        }
      }

      // Update local state
      setTags(prev => prev.filter(tag => !selectedTags.has(tag.name)));
      setSelectedTags(new Set());
      
      toast({
        title: "Success",
        description: `Deleted ${tagsToDelete.length} tag(s)`,
      });

      onTagsUpdated?.();
    } catch (error) {
      console.error('Error deleting tags:', error);
      toast({
        title: "Error",
        description: "Failed to delete tags",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTag = (tagName: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagName)) {
      newSelected.delete(tagName);
    } else {
      newSelected.add(tagName);
    }
    setSelectedTags(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTags.size === tags.length) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(tags.map(tag => tag.name)));
    }
  };

  useEffect(() => {
    if (open) {
      fetchTags();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Tags className="h-4 w-4 mr-2" />
            Tags
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Tag Management
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4">
          {/* Add new tag */}
          <div className="flex gap-2">
            <Input
              placeholder="Add new tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            />
            <Button onClick={handleAddTag} disabled={!newTagName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Bulk actions */}
          {tags.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedTags.size === tags.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedTags.size > 0 ? `${selectedTags.size} selected` : 'Select all'}
                </span>
              </div>
              
              {selectedTags.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelectedTags}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedTags.size})
                </Button>
              )}
            </div>
          )}

          {/* Tags list */}
          <ScrollArea className="flex-1 border rounded-md">
            <div className="p-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">Loading tags...</div>
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-8">
                  <Tags className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No custom tags found</p>
                  <p className="text-sm text-muted-foreground/70">Add a tag above to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.name}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedTags.has(tag.name)}
                          onCheckedChange={() => handleToggleTag(tag.name)}
                        />
                        <Badge variant="secondary" className="font-mono">
                          {tag.name}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {tag.count} {tag.count === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleTag(tag.name)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}