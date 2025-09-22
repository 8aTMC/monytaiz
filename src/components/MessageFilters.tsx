import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Pin, MessageCircle, Plus, Users } from 'lucide-react';

export type FilterType = 'all' | 'ai' | 'pinned' | 'unread' | 'unreplied';
export type ExtendedFilterType = FilterType | `list_${string}`;

interface UserList {
  id: string;
  name: string;
  user_count?: number;
}

interface MessageFiltersProps {
  activeFilter: ExtendedFilterType;
  onFilterChange: (filter: ExtendedFilterType) => void;
  aiChatCount: number;
  pinnedCount: number;
  unreadCount: number;
  unrepliedCount: number;
  userId: string;
}

export const MessageFilters = ({
  activeFilter,
  onFilterChange,
  aiChatCount,
  pinnedCount,
  unreadCount,
  unrepliedCount,
  userId
}: MessageFiltersProps) => {
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [showListDialog, setShowListDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load user lists and selected filters from localStorage
  useEffect(() => {
    loadUserLists();
    const saved = localStorage.getItem(`message_filter_lists_${userId}`);
    if (saved) {
      setSelectedLists(JSON.parse(saved));
    }
  }, [userId]);

  const loadUserLists = async () => {
    try {
      setLoading(true);
      // For now, use mock data to avoid TypeScript issues
      // TODO: Implement proper Supabase data loading
      setTimeout(() => {
        const mockLists: UserList[] = [
          { id: '1', name: 'VIP Members', user_count: 5 },
          { id: '2', name: 'Premium Fans', user_count: 12 },
          { id: '3', name: 'Regular Customers', user_count: 25 }
        ];
        setUserLists(mockLists);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error loading user lists:', error);
      setLoading(false);
    }
  };

  const handleListToggle = (listId: string, checked: boolean) => {
    const updated = checked 
      ? [...selectedLists, listId]
      : selectedLists.filter(id => id !== listId);
    
    setSelectedLists(updated);
    localStorage.setItem(`message_filter_lists_${userId}`, JSON.stringify(updated));
  };

const baseFilters = [
  {
    id: 'all',
    label: 'All',
    icon: MessageCircle,
    count: null
  },
  {
    id: 'ai',
    label: 'AI',
    icon: Bot,
    count: aiChatCount
  },
  {
    id: 'pinned',
    label: 'Pinned',
    icon: Pin,
    count: pinnedCount
  },
  {
    id: 'unread',
    label: 'Unread',
    icon: MessageCircle,
    count: unreadCount
  },
  {
    id: 'unreplied',
    label: 'Unreplied',
    icon: MessageCircle,
    count: unrepliedCount
  }
] as const;

  // Add selected user lists as filters
  const listFilters = selectedLists.map(listId => {
    const list = userLists.find(l => l.id === listId);
    return list ? {
      id: `list_${listId}`,
      label: list.name,
      icon: Users,
      count: list.user_count || 0
    } : null;
  }).filter((f): f is NonNullable<typeof f> => f !== null);

  const allFilters = [...baseFilters, ...listFilters];

  return (
    <div className="relative">
      <div 
        className="flex gap-1 overflow-x-auto pb-1"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Hide scrollbar with CSS */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .overflow-x-auto::-webkit-scrollbar {
              display: none;
            }
          `
        }} />
        
        {allFilters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange(filter.id as ExtendedFilterType)}
            className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0"
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

        {/* +List Button */}
        <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0 ml-1"
            >
              <Plus className="h-3 w-3 mr-1" />
              List
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select Lists to Filter</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <ScrollArea className="h-64 w-full">
                <div className="space-y-2">
                  {loading ? (
                    <div className="text-center text-muted-foreground py-4">
                      Loading lists...
                    </div>
                  ) : userLists.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      No lists found
                    </div>
                  ) : (
                    userLists.map((list) => (
                      <div key={list.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={list.id}
                          checked={selectedLists.includes(list.id)}
                          onCheckedChange={(checked) => 
                            handleListToggle(list.id, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={list.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {list.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};