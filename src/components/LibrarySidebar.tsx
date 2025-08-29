
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
    <div className="w-64 bg-card border-r border-border flex-shrink-0 overflow-hidden">
      <div className="h-full overflow-y-auto custom-scrollbar px-2 py-3">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-foreground mb-2">Library</h2>
        </div>
        
      {/* Default Categories */}
      <div className="space-y-1 mb-3">
        {defaultCategories.map((category) => {
          const IconComponent = category.icon;
          return (
            <div key={category.id} className="relative">
              <Button
                variant={selectedCategory === category.id ? "default" : "ghost"}
                className="w-full justify-start text-left p-1.5 h-auto pr-8 min-w-0"
                onClick={() => onCategorySelect(category.id)}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                  <IconComponent className="h-3.5 w-3.5 flex-shrink-0" />
                   <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                     <span className="font-medium text-left w-full truncate text-sm">{truncateText(category.label, 18)}</span>
                     <span className={`text-xs text-left w-full truncate ${selectedCategory === category.id ? 'text-foreground/80' : 'text-muted-foreground/70'}`}>{truncateText(category.description, 20)}</span>
                   </div>
                </div>
              </Button>
              <Badge variant="secondary" className="absolute top-0.5 right-1 text-xs pointer-events-none px-1 py-0 h-4 min-w-[16px] flex items-center justify-center">
                {categoryCounts[category.id] || 0}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Horizontal Divider */}
      <div className="border-t border-border my-3"></div>

      {/* Action Buttons */}
        <div className="flex flex-col gap-1 mb-3">
          <div className="flex items-center gap-1">
            <NewFolderDialog onFolderCreated={onFolderCreated} />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReorderMode(!isReorderMode)}
              disabled={customFolders.length === 0}
              className="text-xs px-1.5 h-7 flex-shrink-0"
            >
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </div>
        </div>

      {/* Custom Folders */}
      {sortedCustomFolders.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-muted-foreground">My Folders</div>
          </div>
          
          {sortedCustomFolders.map((folder, index) => {
            const IconComponent = folder.icon;
            return (
              <div key={folder.id}>
                <div className={`relative ${isReorderMode ? 'cursor-move' : ''}`}>
                  {!isReorderMode && (
                    <div className="absolute top-0.5 left-0.5 z-10">
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
                    className={`w-full justify-start text-left p-1.5 h-auto pr-8 min-w-0 ${!isReorderMode ? 'pl-7' : 'pl-1.5'}`}
                    onClick={() => {
                      if (!isReorderMode) {
                        onCategorySelect(folder.id);
                      }
                    }}
                    disabled={isReorderMode}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                      {isReorderMode && <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                      <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                        <span className="font-medium text-left w-full truncate text-sm">{truncateText(folder.label, 18)}</span>
                        <span className={`text-xs text-left w-full truncate ${selectedCategory === folder.id ? 'text-foreground/80' : 'text-muted-foreground/70'}`}>{folder.description}</span>
                      </div>
                    </div>
                  </Button>
                   <Badge variant="secondary" className="absolute top-0.5 right-1 text-xs pointer-events-none px-1 py-0 h-4 min-w-[16px] flex items-center justify-center">
                     {categoryCounts[folder.id] || 0}
                   </Badge>
                </div>
                
                <div className="h-px mx-1 bg-border/30" />
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
};
