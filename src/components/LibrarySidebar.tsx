
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
    <div className="w-64 flex-shrink-0 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-sidebar"></div>
      <div className="relative h-full overflow-y-auto custom-scrollbar pl-6 pr-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-1 bg-gradient-primary bg-clip-text text-transparent">Library</h2>
          <p className="text-sm text-muted-foreground">Manage your content</p>
        </div>
        
      {/* Default Categories */}
      <div className="space-y-2 mb-6">
        {defaultCategories.map((category) => {
          const IconComponent = category.icon;
          const isSelected = selectedCategory === category.id;
          return (
            <div key={category.id} className="relative group">
              <Button
                variant={isSelected ? "default" : "ghost"}
                className={`w-full justify-start text-left p-3 h-auto pr-12 min-w-0 relative overflow-hidden transition-all duration-300 ${
                  isSelected 
                    ? "bg-gradient-primary shadow-shadow-soft border-0" 
                    : "hover:bg-gradient-glass hover:shadow-shadow-soft/50 border border-transparent hover:border-border"
                }`}
                onClick={() => onCategorySelect(category.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden relative z-10">
                  <div className={`p-2 rounded-lg transition-all duration-300 ${
                    isSelected ? "bg-white/20" : "bg-primary/10 group-hover:bg-primary/20"
                  }`}>
                    <IconComponent className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-white" : "text-primary"}`} />
                  </div>
                   <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                     <span className={`font-semibold text-left w-full truncate ${isSelected ? "text-white" : "text-foreground"}`}>
                       {truncateText(category.label, 16)}
                     </span>
                     <span className={`text-xs text-left w-full truncate ${
                       isSelected ? 'text-white/80' : 'text-muted-foreground group-hover:text-foreground/80'
                     }`}>
                       {category.description}
                     </span>
                   </div>
                </div>
              </Button>
              <Badge 
                variant="secondary" 
                className={`absolute top-2 right-2 text-[10px] pointer-events-none px-1.5 py-0.5 h-5 min-w-[20px] flex items-center justify-center transition-all duration-300 ${
                  isSelected 
                    ? "bg-white/20 text-white border-white/20" 
                    : "bg-primary/10 text-primary border-primary/20 group-hover:bg-primary/20"
                }`}
              >
                {categoryCounts[category.id] || 0}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Elegant Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent h-px"></div>
        <div className="relative flex justify-center">
          <span className="bg-gradient-sidebar px-3 text-xs font-medium text-muted-foreground">Custom Folders</span>
        </div>
      </div>

      {/* Action Buttons */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center gap-2">
            <NewFolderDialog onFolderCreated={onFolderCreated} />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReorderMode(!isReorderMode)}
              disabled={customFolders.length === 0}
              className="text-xs px-2 h-8 flex-shrink-0 hover:bg-gradient-glass transition-all duration-300"
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
                         <span className={`text-xs text-left w-full ${selectedCategory === folder.id ? 'text-foreground/80' : 'text-muted-foreground/70'}`}>{folder.description}</span>
                       </div>
                    </div>
                  </Button>
                   <Badge variant="secondary" className="absolute top-0.5 right-1 text-[10px] pointer-events-none px-0.5 py-0 h-3 min-w-[12px] flex items-center justify-center">
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
