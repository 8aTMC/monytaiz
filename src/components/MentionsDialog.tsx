import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, X, AtSign, Search } from 'lucide-react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { CollaboratorDialog } from './CollaboratorDialog';
import { ProfilePicturePreview } from './ProfilePicturePreview';

interface MentionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentions: string[];
  onMentionsChange: (mentions: string[]) => void;
}

export function MentionsDialog({ open, onOpenChange, mentions, onMentionsChange }: MentionsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCollaboratorDialog, setShowCollaboratorDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState({ url: '', name: '' });
  const [selectedCollaborators, setSelectedCollaborators] = useState<any[]>([]);
  const { collaborators, loading, createCollaborator, getRecentCollaborators, searchCollaborators, fetchCollaborators } = useCollaborators();

  // Refresh collaborators whenever the dialog opens to ensure fresh data
  useEffect(() => {
    if (open && fetchCollaborators) {
      fetchCollaborators();
    }
  }, [open, fetchCollaborators]);

  // Sync selectedCollaborators with mentions prop
  useEffect(() => {
    if (mentions.length === 0) {
      setSelectedCollaborators([]);
    } else {
      // Find collaborator objects for existing mentions
      const mentionedCollaborators = mentions.map(mention => {
        const name = mention.replace('@', '');
        return collaborators.find(c => c.name === name);
      }).filter(Boolean);
      setSelectedCollaborators(mentionedCollaborators);
    }
  }, [mentions, collaborators]);

  const allFilteredCollaborators = searchQuery.trim() 
    ? searchCollaborators(searchQuery)
    : getRecentCollaborators(5);
  
  // Filter out collaborators that are already mentioned (convert @name back to name for comparison)
  const mentionedNames = mentions.map(mention => mention.replace('@', ''));
  const filteredCollaborators = allFilteredCollaborators.filter(collaborator => 
    !mentionedNames.includes(collaborator.name)
  );

  const handleCollaboratorClick = (collaborator: any) => {
    const mentionToAdd = `@${collaborator.name}`;
    if (!mentions.includes(mentionToAdd)) {
      onMentionsChange([...mentions, mentionToAdd]);
    }
  };

  const handleCreateCollaborator = async (collaboratorData: { name: string; url: string; profile_picture_url?: string }) => {
    try {
      const result = await createCollaborator(collaboratorData);
      const mentionToAdd = `@${result.name}`;
      if (!mentions.includes(mentionToAdd)) {
        onMentionsChange([...mentions, mentionToAdd]);
      }
      // Close the dialog regardless of whether it was new or existing
      setShowCollaboratorDialog(false);
    } catch (error) {
      console.error('Error creating collaborator:', error);
    }
  };

  const handleRemoveMention = (collaborator: any) => {
    const mentionToRemove = `@${collaborator.name}`;
    onMentionsChange(mentions.filter(mention => mention !== mentionToRemove));
  };

  const handleAvatarClick = (e: React.MouseEvent, collaborator: any) => {
    e.stopPropagation();
    if (collaborator.profile_picture_url) {
      setPreviewImage({ url: collaborator.profile_picture_url, name: collaborator.name });
      setShowPreview(true);
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
          <DialogDescription>
            Tag collaborators and people in your content
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search collaborators */}
          <div>
            <Label className="text-sm font-medium">Search Collaborators</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search saved collaborators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p>Loading collaborators...</p>
            </div>
          )}

          {/* Collaborators list */}
          {!loading && filteredCollaborators.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {searchQuery.trim() ? 'Search Results:' : 'Recent Collaborators:'}
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCollaboratorDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Collaborator
                </Button>
              </div>
              <ScrollArea className="max-h-[300px] scrollbar-default">
                <div className="space-y-2 pr-3">
                  {filteredCollaborators.map((collaborator) => (
                    <div
                      key={collaborator.id}
                      className="group flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleCollaboratorClick(collaborator)}
                    >
                      <Avatar 
                        className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all" 
                        onClick={(e) => handleAvatarClick(e, collaborator)}
                      >
                        <AvatarImage src={collaborator.profile_picture_url} />
                        <AvatarFallback className="text-xs">
                          {collaborator.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{collaborator.name}</p>
                        <p className="text-xs text-muted-foreground group-hover:text-white truncate">{collaborator.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty state - only show when not loading and no collaborators */}
          {!loading && filteredCollaborators.length === 0 && mentions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AtSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No mentions added yet</p>
              <p className="text-sm">Add collaborators to tag people in your content</p>
              <Button
                variant="outline"
                onClick={() => setShowCollaboratorDialog(true)}
                className="mt-3"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Collaborator
              </Button>
            </div>
          )}

          {/* No search results state */}
          {!loading && searchQuery.trim() && filteredCollaborators.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No collaborators found</p>
              <p className="text-sm">Try a different search term</p>
              <Button
                variant="outline"
                onClick={() => setShowCollaboratorDialog(true)}
                className="mt-3"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Collaborator
              </Button>
            </div>
          )}

          {/* Current mentions */}
          {selectedCollaborators.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Mentions:</Label>
              <ScrollArea className="max-h-[300px] scrollbar-default">
                <div className="space-y-2 pr-3">
                  {selectedCollaborators.map((collaborator) => (
                    <div
                      key={collaborator.id}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-accent/20"
                    >
                      <Avatar 
                        className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all" 
                        onClick={(e) => handleAvatarClick(e, collaborator)}
                      >
                        <AvatarImage src={collaborator.profile_picture_url} />
                        <AvatarFallback className="text-xs">
                          {collaborator.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">@{collaborator.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{collaborator.url}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-destructive/20"
                        onClick={() => handleRemoveMention(collaborator)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

        </div>

        {/* Collaborator Dialog */}
        <CollaboratorDialog
          open={showCollaboratorDialog}
          onOpenChange={setShowCollaboratorDialog}
          onCollaboratorCreated={handleCreateCollaborator}
        />

        {/* Profile Picture Preview */}
        <ProfilePicturePreview
          open={showPreview}
          onOpenChange={setShowPreview}
          imageUrl={previewImage.url}
          name={previewImage.name}
        />
      </DialogContent>
    </Dialog>
  );
}