import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AtSign, Hash, FolderOpen, Save } from 'lucide-react';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { FileUploadItem } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';

interface BatchMetadataToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onUpdateMetadata: (metadata: Partial<FileUploadItem['metadata']>) => void;
}

export const BatchMetadataToolbar = ({
  selectedCount,
  onClearSelection,
  onUpdateMetadata
}: BatchMetadataToolbarProps) => {
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    onClearSelection();
    toast({
      title: "Batch changes applied",
      description: `Metadata updated for ${selectedCount} files`,
      variant: "success",
    });
  };

  return (
    <>
      <Card className="p-3 mb-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">
              {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <span className="text-xs text-muted-foreground">
              • Add metadata to selected files
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMentionsDialogOpen(true)}
              className="flex items-center gap-1 h-8"
            >
              <AtSign className="w-4 h-4" />
              Mentions
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTagsDialogOpen(true)}
              className="flex items-center gap-1 h-8"
            >
              <Hash className="w-4 h-4" />
              Tags
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFoldersDialogOpen(true)}
              className="flex items-center gap-1 h-8"
            >
              <FolderOpen className="w-4 h-4" />
              Folders
            </Button>
            
            <Button
              size="sm"
              onClick={handleSave}
              className="flex items-center gap-1 h-8"
            >
              <Save className="w-4 h-4" />
              Apply & Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Batch metadata dialogs */}
      <MentionsDialog
        open={mentionsDialogOpen}
        onOpenChange={setMentionsDialogOpen}
        mentions={[]}
        onMentionsChange={(mentions) => {
          onUpdateMetadata({ mentions });
          setMentionsDialogOpen(false);
          toast({
            title: "Mentions added",
            description: `Mentions updated for ${selectedCount} files`,
            variant: "success",
          });
        }}
      />
      
      <TagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        tags={[]}
        onTagsChange={(tags) => {
          onUpdateMetadata({ tags });
          setTagsDialogOpen(false);
          toast({
            title: "Tags added",
            description: `Tags updated for ${selectedCount} files`,
            variant: "success",
          });
        }}
      />
      
      <FolderSelectDialog
        open={foldersDialogOpen}
        onOpenChange={setFoldersDialogOpen}
        selectedFolders={[]}
        onFoldersChange={(folders) => {
          onUpdateMetadata({ folders });
          setFoldersDialogOpen(false);
          toast({
            title: "Folders updated",
            description: `Folders updated for ${selectedCount} files`,
            variant: "success",
          });
        }}
      />
    </>
  );
};