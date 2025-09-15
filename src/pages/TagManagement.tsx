import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Tags, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  name: string;
  count: number;
}

export default function TagManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);

  const defaultTags = ['upload', 'story', 'livestream', 'message'];

  const fetchTags = async () => {
    try {
      setLoading(true);
      
      // Get tags from saved_tags table
      const { data: savedTags, error } = await supabase
        .from('saved_tags')
        .select('tag_name, usage_count')
        .order('usage_count', { ascending: false });

      if (error) throw error;

      // Convert to the expected format
      const tagsArray = (savedTags || []).map(tag => ({
        name: tag.tag_name,
        count: tag.usage_count
      }));

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

    try {
      // Add to saved_tags table
      const { error } = await supabase
        .from('saved_tags')
        .insert({
          tag_name: tagName,
          usage_count: 0,
          creator_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      // Add to local state
      setTags(prev => [...prev, { name: tagName, count: 0 }].sort((a, b) => b.count - a.count));
      setNewTagName('');
      
      toast({
        title: "Success",
        description: `Tag "${tagName}" added`,
      });
    } catch (error) {
      console.error('Error adding tag:', error);
      toast({
        title: "Error",
        description: "Failed to add tag",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSelectedTags = async () => {
    if (selectedTags.size === 0) return;

    try {
      setLoading(true);
      const tagsToDelete = Array.from(selectedTags);

      // Delete tags from saved_tags table
      const { error } = await supabase
        .from('saved_tags')
        .delete()
        .in('tag_name', tagsToDelete);

      if (error) throw error;

      // Update local state
      setTags(prev => prev.filter(tag => !selectedTags.has(tag.name)));
      setSelectedTags(new Set());
      
      toast({
        title: "Success",
        description: `Deleted ${tagsToDelete.length} tag(s)`,
      });
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
    fetchTags();
  }, []);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Tags className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Tag Management</h1>
          <p className="text-muted-foreground">Manage your content tags and organize your media</p>
        </div>
      </div>

      {/* Add new tag card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add New Tag</CardTitle>
          <CardDescription>Create a new tag to organize your content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              className="flex-1"
            />
            <Button onClick={handleAddTag} disabled={!newTagName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tag
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tags management card */}
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Your Tags</CardTitle>
              <CardDescription>Manage and organize your existing tags</CardDescription>
            </div>
            
            {/* Bulk actions */}
            {tags.length > 0 && (
              <div className="flex items-center gap-4">
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
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full border rounded-lg">
            <div className="p-4">
              {loading ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground">Loading tags...</div>
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-12">
                  <Tags className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No custom tags found</h3>
                  <p className="text-muted-foreground mb-4">Start organizing your content by adding tags above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tags.map((tag) => (
                    <div
                      key={tag.name}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={selectedTags.has(tag.name)}
                          onCheckedChange={() => handleToggleTag(tag.name)}
                        />
                        <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
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
        </CardContent>
      </Card>
    </div>
  );
}