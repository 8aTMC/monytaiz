
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, GripVertical } from 'lucide-react';
import { NewFolderDialog } from '@/components/NewFolderDialog';
import { EditFolderDialog } from '@/components/EditFolderDialog';

interface CategoryItem {
  id: string;
  label: string;
  icon: any;
  description: string;
  isDefault: boolean;
}

interface LibrarySidebarProps {
  defaultCategories: CategoryItem[];
  customFolders: CategoryItem[];
  selectedCategory: string;
  categoryCounts: Record<string, number>;
  onCategorySelect: (categoryId: string) => void;
  onFolderCreated: () => void;
  onFolderUpdated: () => void;
}

export const LibrarySidebar = ({
  defaultCategories,
  customFolders,
  selectedCategory,
  categoryCounts,
  onCategorySelect,
  onFolderCreated,
  onFolderUpdated
}: LibrarySidebarProps) => {
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const sortedCustomFolders = sortOrder 
    ? [...customFolders].sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.label.localeCompare(b.label);
        } else {
          return b.label.localeCompare(a.label);
        }
      })
    : customFolders;

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0">
      <div className="h-full overflow-y-auto custom-scrollbar px-3 py-4">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-foreground mb-3">Library</h2>
        </div>
        
      {/* Default Categories */}
      <div className="space-y-1 mb-4">
        {defaultCategories.map((category) => {
          const IconComponent = category.icon;
          return (
            <div key={category.id} className="relative">
              <Button
                variant={selectedCategory === category.id ? "default" : "ghost"}
                className="w-full justify-start text-left p-2 h-auto pr-10"
                onClick={() => onCategorySelect(category.id)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <IconComponent className="h-4 w-4 flex-shrink-0" />
                   <div className="flex flex-col items-start min-w-0 flex-1">
                     <span className="font-medium text-left w-full">{truncateText(category.label, 24)}</span>
                     <span className={`text-xs text-left w-full ${selectedCategory === category.id ? 'text-foreground' : 'text-muted-foreground/80'}`}>{truncateText(category.description, 30)}</span>
                   </div>
                </div>
              </Button>
              <Badge variant="secondary" className="absolute top-1 right-2 text-xs pointer-events-none">
                {categoryCounts[category.id] || 0}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Horizontal Divider */}
      <div className="border-t border-border my-4"></div>

      {/* Action Buttons */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-1">
            <NewFolderDialog onFolderCreated={onFolderCreated} />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReorderMode(!isReorderMode)}
              disabled={customFolders.length === 0}
              className="text-xs px-2"
            >
              <ArrowUpDown className="h-3 w-3 mr-1" />
              Reorder
            </Button>
          </div>
        </div>

      {/* Custom Folders */}
      {sortedCustomFolders.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-muted-foreground">My Folders</div>
          </div>
          
          {sortedCustomFolders.map((folder, index) => {
            const IconComponent = folder.icon;
            return (
              <div key={folder.id}>
                <div className={`relative ${isReorderMode ? 'cursor-move' : ''}`}>
                  {!isReorderMode && (
                    <div className="absolute top-1 left-1 z-10">
                      <EditFolderDialog 
                        folder={{
                          id: folder.id,
                          label: folder.label
                        }}
                        onFolderUpdated={onFolderUpdated}
                      />
                    </div>
                  )}
                  <Button
                    variant={selectedCategory === folder.id ? "default" : "ghost"}
                    className={`w-full justify-start text-left p-2 h-auto pr-10 ${!isReorderMode ? 'pl-10' : 'pl-2'}`}
                    onClick={() => {
                      if (!isReorderMode) {
                        onCategorySelect(folder.id);
                      }
                    }}
                    disabled={isReorderMode}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isReorderMode && <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="font-medium text-left w-full">{truncateText(folder.label, 30)}</span>
                        <span className={`text-xs text-left w-full ${selectedCategory === folder.id ? 'text-foreground' : 'text-muted-foreground/80'}`}>{folder.description}</span>
                      </div>
                    </div>
                  </Button>
                   <Badge variant="secondary" className="absolute top-1 right-2 text-xs pointer-events-none">
                     {categoryCounts[folder.id] || 0}
                   </Badge>
                </div>
                
                <div className="h-px mx-2 bg-border/30" />
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
};
