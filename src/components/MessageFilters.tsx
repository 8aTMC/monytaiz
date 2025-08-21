import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Bot, Pin, MessageCircle, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export type FilterType = 'all' | 'ai' | 'pinned' | 'unread' | string;

interface MessageFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  aiChatCount: number;
  pinnedCount: number;
  unreadCount: number;
}

interface FanList {
  id: string;
  name: string;
  color: string;
}

export const MessageFilters = ({
  activeFilter,
  onFilterChange,
  aiChatCount,
  pinnedCount,
  unreadCount
}: MessageFiltersProps) => {
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [fanLists, setFanLists] = useState<FanList[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [showListDialog, setShowListDialog] = useState(false);

  useEffect(() => {
    loadFanLists();
    loadCustomFilters();
  }, []);

  const loadFanLists = async () => {
    try {
      const { data, error } = await supabase
        .from('fan_lists')
        .select('id, name, color')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setFanLists(data || []);
    } catch (error) {
      console.error('Error loading fan lists:', error);
    }
  };

  const loadCustomFilters = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('user_message_filters')
        .select('filter_list_ids')
        .eq('user_id', user.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.filter_list_ids) {
        setCustomFilters(data.filter_list_ids);
      }
    } catch (error) {
      console.error('Error loading custom filters:', error);
    }
  };

  const saveCustomFilters = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('user_message_filters')
        .upsert({
          user_id: user.user.id,
          filter_list_ids: selectedLists,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setCustomFilters(selectedLists);
      setShowListDialog(false);
    } catch (error) {
      console.error('Error saving custom filters:', error);
    }
  };

  const getFilterName = (filterId: string) => {
    if (filterId.startsWith('list_')) {
      const listId = filterId.replace('list_', '');
      const list = fanLists.find(l => l.id === listId);
      return list?.name || 'Unknown List';
    }
    return filterId;
  };

  const baseFilters = [
    {
      id: 'all' as FilterType,
      label: 'All',
      icon: MessageCircle,
      count: null
    },
    {
      id: 'ai' as FilterType,
      label: 'AI',
      icon: Bot,
      count: aiChatCount
    },
    {
      id: 'pinned' as FilterType,
      label: 'Pinned',
      icon: Pin,
      count: pinnedCount
    },
    {
      id: 'unread' as FilterType,
      label: 'Unread',
      icon: MessageCircle,
      count: unreadCount
    }
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {baseFilters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className="h-7 px-2 text-xs"
          >
            <filter.icon className="h-3 w-3 mr-1" />
            {filter.label}
            {filter.count !== null && filter.count > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                {filter.count}
              </Badge>
            )}
          </Button>
        ))}

        {customFilters.map((filterId) => (
          <Button
            key={filterId}
            variant={activeFilter === filterId ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange(filterId)}
            className="h-7 px-2 text-xs"
          >
            {getFilterName(filterId)}
          </Button>
        ))}

        <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Filter
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Fan List Filters</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {fanLists.map((list) => (
                    <div key={list.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={list.id}
                        checked={selectedLists.includes(`list_${list.id}`)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLists(prev => [...prev, `list_${list.id}`]);
                          } else {
                            setSelectedLists(prev => prev.filter(id => id !== `list_${list.id}`));
                          }
                        }}
                      />
                      <label
                        htmlFor={list.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: list.color }}
                        />
                        {list.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button onClick={() => setShowListDialog(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={saveCustomFilters} className="flex-1">
                  Save Filters
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};