import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogPortal,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RangeSlider } from "@/components/ui/range-slider";
import { MultiSelect } from "@/components/ui/multi-select";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { X, Filter, RefreshCw } from "lucide-react";
import { getInitials } from "@/lib/initials";
import { useRefreshCollaborators } from "@/hooks/useRefreshCollaborators";

interface FilterState {
  collaborators: string[];
  tags: string[];
  mentions: string[];
  priceRange: [number, number];
}

interface LibraryFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  selectedCategory?: string;
}

interface CollaboratorOption {
  value: string;
  label: string;
  description?: string;
  avatar?: string;
  initials?: string;
  username?: string;
}

interface TagOption {
  value: string;
  label: string;
  description?: string;
}

interface MentionOption {
  value: string;
  label: string;
  description?: string;
}

export const LibraryFiltersDialog: React.FC<LibraryFiltersDialogProps> = ({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  selectedCategory = 'all-files',
}) => {
  const { t } = useTranslation();
  const { refreshCollaborators, isRefreshing } = useRefreshCollaborators();
  const [collaboratorOptions, setCollaboratorOptions] = useState<CollaboratorOption[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [mentionOptions, setMentionOptions] = useState<MentionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [manualPriceMin, setManualPriceMin] = useState('');
  const [manualPriceMax, setManualPriceMax] = useState('');

  // Load available collaborators and tags with counts
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component

    const loadCollaborators = async () => {
      try {
        // Load collaborators with media counts
        const { data: collaboratorsWithCounts } = await supabase
          .from('collaborators')
          .select(`
            id, name, description, profile_picture_url, username,
            media_collaborators(count)
          `)
          .order('name', { ascending: true });

        if (collaboratorsWithCounts && isMounted) {
          setCollaboratorOptions(
            collaboratorsWithCounts.map(c => {
              const mediaCount = Array.isArray(c.media_collaborators) ? c.media_collaborators.length : 0;
              return {
                value: c.id,
                label: c.username ? `${c.name} (@${c.username})` : c.name,
                description: `${mediaCount} media file${mediaCount !== 1 ? 's' : ''}`,
                avatar: c.profile_picture_url || undefined,
                initials: getInitials(c.name),
                username: c.username || undefined
              };
            })
          );
        }
      } catch (error) {
        console.error('Error loading collaborators:', error);
        if (isMounted) {
          setCollaboratorOptions([]);
        }
      }
    };

    const loadContextualData = async () => {
      console.log('🎯 Loading contextual data for category:', selectedCategory);
      
      try {
        let mediaData: any[] = [];
        let simpleMediaData: any[] = [];

        if (selectedCategory === 'all-files') {
          // Fetch from all tables
          const mediaResult = await supabase.from('media').select('tags, mentions').not('tags', 'is', null);
          const simpleResult = await supabase.from('simple_media').select('tags, mentions').not('tags', 'is', null);
          mediaData = mediaResult.data || [];
          simpleMediaData = simpleResult.data || [];
        } else if (selectedCategory === 'messages') {
          // Fetch only message-related media (simple_media doesn't have origin column)
          const mediaResult = await supabase.from('media').select('tags, mentions').eq('origin', 'message').not('tags', 'is', null);
          mediaData = mediaResult.data || [];
          simpleMediaData = []; // Skip simple_media for messages since it doesn't have origin
        } else if (selectedCategory.startsWith('folder_')) {
          // Fetch from specific folder
          const folderId = selectedCategory.replace('folder_', '');
          const { data: folderContents } = await supabase
            .from('file_folder_contents')
            .select('media_id')
            .eq('folder_id', folderId);
          
          if (folderContents && folderContents.length > 0) {
            const mediaIds = folderContents.map(fc => fc.media_id);
            const mediaResult = await supabase.from('media').select('tags, mentions').in('id', mediaIds);
            const simpleResult = await supabase.from('simple_media').select('tags, mentions').in('id', mediaIds);
            mediaData = mediaResult.data || [];
            simpleMediaData = simpleResult.data || [];
          }
        } else {
          // Custom collection
          const { data: collectionItems } = await supabase
            .from('collection_items')
            .select('media_id')
            .eq('collection_id', selectedCategory);
          
          if (collectionItems && collectionItems.length > 0) {
            const mediaIds = collectionItems.map(ci => ci.media_id);
            const mediaResult = await supabase.from('media').select('tags, mentions').in('id', mediaIds);
            const simpleResult = await supabase.from('simple_media').select('tags, mentions').in('id', mediaIds);
            mediaData = mediaResult.data || [];
            simpleMediaData = simpleResult.data || [];
          }
        }

        return { mediaData, simpleMediaData, errors: [] };
      } catch (error) {
        console.error('Error loading contextual data:', error);
        return { mediaData: [], simpleMediaData: [], errors: [error] };
      }
    };

    const loadOptions = async () => {
      if (isMounted) {
        setLoading(true);
      }
      
      try {
        // Load collaborators
        await loadCollaborators();

        console.log('🏷️ Loading tags and mentions from contextual media files...');
        
        // Get contextual data based on selected category
        const { mediaData, simpleMediaData, errors } = await loadContextualData();
        
        if (errors.length > 0) {
          console.error('🏷️ Errors loading contextual data:', errors);
        }

        console.log('🏷️ Contextual data:', { mediaData, simpleMediaData });

        // Combine and count tags and mentions from both sources
        const tagCounts: Record<string, number> = {};
        const mentionCounts: Record<string, number> = {};
        
        // Process data from both media and simple_media tables
        const allData = [...(mediaData || []), ...(simpleMediaData || [])];
        
        allData.forEach(item => {
          // Process tags
          if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => {
              if (tag && typeof tag === 'string') {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
              }
            });
          }
          
          // Process mentions
          if (item.mentions && Array.isArray(item.mentions)) {
            item.mentions.forEach(mention => {
              if (mention && typeof mention === 'string') {
                mentionCounts[mention] = (mentionCounts[mention] || 0) + 1;
              }
            });
          }
        });

        // Convert to options format
        const allTags = Object.entries(tagCounts)
          .map(([tag_name, usage_count]) => ({ tag_name, usage_count }))
          .sort((a, b) => b.usage_count - a.usage_count);

        const allMentions = Object.entries(mentionCounts)
          .map(([mention_name, usage_count]) => ({ mention_name, usage_count }))
          .sort((a, b) => b.usage_count - a.usage_count);

        console.log('🏷️ Processed tags:', allTags);
        console.log('🏷️ Processed mentions:', allMentions);

        if (isMounted) {
          // Set tag options
          const tagOptions = allTags.map(t => ({
            value: t.tag_name,
            label: t.tag_name,
            description: `Used ${t.usage_count} times`
          }));
          setTagOptions(tagOptions);

          // Set mention options
          const mentionOptions = allMentions.map(m => ({
            value: m.mention_name,
            label: m.mention_name,
            description: `Mentioned ${m.usage_count} times`
          }));
          setMentionOptions(mentionOptions);
        }
        } catch (error) {
          console.error('💥 Error loading filter options:', error);
          if (isMounted) {
            setTagOptions([]);
            setMentionOptions([]);
            setCollaboratorOptions([]);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
    };

    if (open) {
      loadOptions();
    }

    return () => {
      isMounted = false; // Cleanup to prevent state updates after unmount
    };
  }, [open, selectedCategory]);

  // Update local state when external filters change
  useEffect(() => {
    setLocalFilters(filters);
    setManualPriceMin((filters.priceRange[0] / 100).toString());
    setManualPriceMax((filters.priceRange[1] / 100).toString());
  }, [filters]);

  const handleCollaboratorChange = (collaborators: string[]) => {
    console.log('👥 Collaborator change:', collaborators);
    setLocalFilters(prev => ({ ...prev, collaborators }));
  };

  const handleTagChange = (tags: string[]) => {
    console.log('🏷️ Tag change:', tags);
    setLocalFilters(prev => ({ ...prev, tags }));
  };

  const handleMentionChange = (mentions: string[]) => {
    console.log('🗣️ Mention change:', mentions);
    setLocalFilters(prev => ({ ...prev, mentions }));
  };

  const handlePriceRangeChange = (range: number[]) => {
    setLocalFilters(prev => ({ ...prev, priceRange: [range[0], range[1]] }));
    setManualPriceMin((range[0] / 100).toString());
    setManualPriceMax((range[1] / 100).toString());
  };

  const handleManualPriceChange = () => {
    const min = Math.max(0, parseFloat(manualPriceMin) || 0) * 100;
    const max = Math.min(1000000, parseFloat(manualPriceMax) || 10000) * 100;
    
    if (min <= max) {
      setLocalFilters(prev => ({ ...prev, priceRange: [min, max] }));
    }
  };

  const handleApply = () => {
    console.log('🎛️ Applying filters:', localFilters);
    console.log('🎛️ Collaborator IDs selected:', localFilters.collaborators);
    console.log('🎛️ Tags selected:', localFilters.tags);
    console.log('🎛️ Price range:', localFilters.priceRange);
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: FilterState = {
      collaborators: [],
      tags: [],
      mentions: [],
      priceRange: [0, 1000000] // $0 to $10,000
    };
    setLocalFilters(clearedFilters);
    setManualPriceMin('0');
    setManualPriceMax('10000');
  };

  const handleReset = () => {
    setLocalFilters(filters);
    setManualPriceMin((filters.priceRange[0] / 100).toString());
    setManualPriceMax((filters.priceRange[1] / 100).toString());
  };

  const hasActiveFilters = 
    localFilters.collaborators.length > 0 || 
    localFilters.tags.length > 0 || 
    localFilters.mentions.length > 0 || 
    localFilters.priceRange[0] > 0 || 
    localFilters.priceRange[1] < 1000000;

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Custom overlay with proper z-index */}
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[190]" 
          onClick={() => onOpenChange(false)}
        />
        <div 
          className="fixed left-[50%] top-[50%] z-[200] grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-card/95 border-border/50 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </DialogTitle>
            <DialogDescription>
              Filter your media library by collaborators, tags, and price range.
            </DialogDescription>
          </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Active Filters</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-6 text-xs"
                >
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {localFilters.collaborators.map(id => {
                  const collaborator = collaboratorOptions.find(c => c.value === id);
                  return collaborator ? (
                    <Badge key={id} variant="secondary" className="bg-primary/10 text-primary">
                      Collaborator: {collaborator.label}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={() => handleCollaboratorChange(localFilters.collaborators.filter(c => c !== id))}
                      />
                    </Badge>
                  ) : null;
                })}
                {localFilters.tags.map((tag, index) => (
                  <Badge key={`tag-${tag}-${index}`} variant="secondary" className="bg-primary/10 text-primary">
                    Tag: {tag}
                    <X
                      className="ml-1 h-3 w-3 cursor-pointer"
                      onClick={() => handleTagChange(localFilters.tags.filter(t => t !== tag))}
                    />
                  </Badge>
                ))}
                {localFilters.mentions.map((mention, index) => (
                  <Badge key={`mention-${mention}-${index}`} variant="secondary" className="bg-primary/10 text-primary">
                    Mention: {mention}
                    <X
                      className="ml-1 h-3 w-3 cursor-pointer"
                      onClick={() => handleMentionChange(localFilters.mentions.filter(m => m !== mention))}
                    />
                  </Badge>
                ))}
                {(localFilters.priceRange[0] > 0 || localFilters.priceRange[1] < 1000000) && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Price: {formatCurrency(localFilters.priceRange[0])} - {formatCurrency(localFilters.priceRange[1])}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Collaborators Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Filter by Collaborators</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshCollaborators}
                disabled={isRefreshing}
                className="h-7 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            <div className="relative">
              <MultiSelect
                key={`collaborators-${open}`}
                options={collaboratorOptions || []}
                value={localFilters.collaborators || []}
                onChange={handleCollaboratorChange}
                placeholder="Select collaborators..."
                emptyMessage="No collaborators found."
                loading={loading}
                maxSelections={5}
                searchPlaceholder="Search collaborators..."
              />
            </div>
            {collaboratorOptions.length === 0 && !loading && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>No collaborators found with media associations.</p>
                <p>Click "Refresh" to update collaborator mappings or add collaborators first.</p>
              </div>
            )}
          </div>

          {/* Tags Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filter by Tags</Label>
            <div className="relative">
              <MultiSelect
                key={`tags-${open}`}
                options={tagOptions || []}
                value={localFilters.tags || []}
                onChange={handleTagChange}
                placeholder="Select tags..."
                emptyMessage="No tags found in current directory."
                loading={loading}
              />
            </div>
          </div>

          {/* Mentions Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filter by Mentions</Label>
            <div className="relative">
              <MultiSelect
                key={`mentions-${open}`}
                options={mentionOptions || []}
                value={localFilters.mentions || []}
                onChange={handleMentionChange}
                placeholder="Select mentions..."
                emptyMessage="No mentions found in current directory."
                loading={loading}
              />
            </div>
          </div>

          {/* Price Range Filter */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Price Range</Label>
            
            {/* Manual Input Fields */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Min Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  value={manualPriceMin}
                  onChange={(e) => setManualPriceMin(e.target.value)}
                  onBlur={handleManualPriceChange}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Max Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  value={manualPriceMax}
                  onChange={(e) => setManualPriceMax(e.target.value)}
                  onBlur={handleManualPriceChange}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Range Slider */}
            <RangeSlider
              value={localFilters.priceRange}
              onValueChange={handlePriceRangeChange}
              min={0}
              max={1000000}
              step={100}
              minLabel="Min"
              maxLabel="Max"
              formatValue={formatCurrency}
              className="mt-4"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClear}>
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} className="bg-gradient-primary">
              Apply Filters
            </Button>
          </div>
        </DialogFooter>
        </div>
      </DialogPortal>
    </Dialog>
  );
};