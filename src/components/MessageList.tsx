import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getInitials } from '@/lib/initials';
import { ChevronDown, Check, CheckCheck, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

// Constants
const PAGE_SIZE = 50;
const BOTTOM_THRESHOLD = 80; // px from bottom to consider "at bottom"
const SHOW_JUMP_AFTER = 300; // px from bottom to show jump button
const LOAD_MORE_THRESHOLD = 100; // px from top to trigger load more

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
  message_type: string;
  delivered_at?: string;
  read_by_recipient: boolean;
  read_at?: string;
  is_system_message?: boolean;
}

interface MessageListProps {
  conversationId: string;
  currentUserId: string;
  partnerProfile?: {
    display_name: string;
    username: string;
    avatar_url?: string;
  };
  className?: string;
}

interface LoadingShimmerProps {
  className?: string;
}

const LoadingShimmer = ({ className }: LoadingShimmerProps) => (
  <div className={cn("flex justify-center py-4", className)}>
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Loading previous messages...
    </div>
  </div>
);

const MessageBubble = React.memo(({ 
  message, 
  isOwn, 
  partnerProfile, 
  currentUserId 
}: { 
  message: Message; 
  isOwn: boolean; 
  partnerProfile?: any; 
  currentUserId: string;
}) => {
  const getDeliveryStatusIcon = (message: Message) => {
    if (message.sender_id !== currentUserId) return null;
    
    if (message.read_by_recipient) {
      // Read: 2 ticks in primary theme color
      return <CheckCheck className="h-3 w-3 message-ticks read" />;
    } else if (message.delivered_at) {
      // Delivered: 2 grey ticks
      return <CheckCheck className="h-3 w-3 message-ticks delivered" />;
    } else {
      // Sent but not delivered: 1 grey tick
      return <Check className="h-3 w-3 message-ticks sent" />;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={cn(
      "flex gap-3 px-4 group",
      isOwn ? "justify-end" : "justify-start"
    )}>
      {!isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={partnerProfile?.avatar_url} />
          <AvatarFallback>
            {getInitials(partnerProfile?.display_name, partnerProfile?.username)}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn(
        "flex flex-col gap-0.5 max-w-xs md:max-w-sm lg:max-w-md",
        isOwn ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "rounded-lg px-3 py-2 break-words",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
          message.is_system_message && "bg-muted/50 text-muted-foreground italic"
        )}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed emoji">
            {message.content}
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground opacity-70 transition-opacity",
          isOwn && "flex-row-reverse"
        )}>
          <span>{formatTime(message.created_at)}</span>
          {getDeliveryStatusIcon(message)}
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export const MessageList = ({ 
  conversationId, 
  currentUserId, 
  partnerProfile,
  className 
}: MessageListProps) => {
  // State
  const [messagesList, setMessagesList] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const pendingScrollToBottomRef = useRef(false);
  const lastScrollHeightRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);

  // Scroll to bottom utility
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    if (!container) return;
    
    container.scrollTo({ 
      top: container.scrollHeight, 
      behavior 
    });
  }, []);

  // Check if user is at bottom
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    
    const { scrollHeight, scrollTop, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD;
  }, []);

  // Update at-bottom state
  const updateAtBottomState = useCallback(() => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);
    
    if (atBottom && unseenCount > 0) {
      setUnseenCount(0);
    }
  }, [checkIfAtBottom, unseenCount]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    updateAtBottomState();
  }, [updateAtBottomState]);

  // Load older messages with stable anchoring
  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || loadingOlder || messagesList.length === 0) return;

    setLoadingOlder(true);
    const container = containerRef.current;
    if (!container) return;

    // Store scroll position before loading
    const prevHeight = container.scrollHeight;
    const prevTop = container.scrollTop;
    lastScrollHeightRef.current = prevHeight;
    lastScrollTopRef.current = prevTop;

    try {
      const oldestMessage = messagesList[0];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('status', 'active')
        .lt('created_at', oldestMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      const olderMessages = (data || []).reverse();
      setHasMore(olderMessages.length === PAGE_SIZE);
      
      if (olderMessages.length > 0) {
        setMessagesList(prev => [...olderMessages, ...prev]);
        
        // Preserve scroll position after DOM update
        requestAnimationFrame(() => {
          const newScrollTop = container.scrollHeight - prevHeight + prevTop;
          container.scrollTop = newScrollTop;
          setLoadingOlder(false);
        });
      } else {
        setLoadingOlder(false);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, messagesList]);

  // Initial load effect
  useLayoutEffect(() => {
    let mounted = true;

    const loadInitialMessages = async () => {
      if (!conversationId) return;

      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        if (error) throw error;

        if (!mounted) return;

        const reversedMessages = (data || []).reverse();
        setMessagesList(reversedMessages);
        setHasMore((data || []).length === PAGE_SIZE);
        
        // Scroll to bottom after first paint
        requestAnimationFrame(() => {
          if (!mounted) return;
          scrollToBottom('auto');
          setInitialLoad(false);
        });
      } catch (error) {
        console.error('Error loading initial messages:', error);
        if (mounted) {
          setInitialLoad(false);
        }
      }
    };

    loadInitialMessages();

    return () => {
      mounted = false;
    };
  }, [conversationId, scrollToBottom]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const container = containerRef.current;
    const topSentinel = topSentinelRef.current;
    
    if (!container || !topSentinel || !hasMore) {
      return;
    }

    // Clean up previous observer
    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect();
    }

    intersectionObserverRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loadingOlder) {
          loadOlderMessages();
        }
      },
      {
        root: container,
        rootMargin: `${LOAD_MORE_THRESHOLD}px 0px 0px 0px`,
        threshold: 0
      }
    );

    intersectionObserverRef.current.observe(topSentinel);

    return () => {
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
      }
    };
  }, [hasMore, loadingOlder, loadOlderMessages, messagesList.length]);

  // Real-time message subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          
          setMessagesList(current => {
            // Avoid duplicates
            if (current.find(msg => msg.id === newMessage.id)) {
              return current;
            }
            return [...current, newMessage];
          });

          // Handle scroll behavior based on user position
          const container = containerRef.current;
          if (!container) return;

          const wasAtBottom = checkIfAtBottom();
          
          if (wasAtBottom) {
            // User is at bottom - auto scroll to show new message
            requestAnimationFrame(() => scrollToBottom('smooth'));
          } else {
            // User is scrolled up - increment unseen count
            setUnseenCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessagesList(current =>
            current.map(msg =>
              msg.id === updatedMessage.id
                ? { ...msg, ...updatedMessage }
                : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, checkIfAtBottom, scrollToBottom]);

  // Handle jump to latest
  const handleJumpToLatest = useCallback(() => {
    scrollToBottom('smooth');
    setUnseenCount(0);
  }, [scrollToBottom]);

  // Show jump button condition
  const shouldShowJumpButton = useMemo(() => {
    const container = containerRef.current;
    if (!container) return false;
    
    const { scrollHeight, scrollTop, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight > SHOW_JUMP_AFTER;
  }, [isAtBottom]);

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      {/* Messages container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto px-4 py-2"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
        }}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {/* Top sentinel for infinite scroll */}
        {hasMore && (
          <div ref={topSentinelRef} className="h-px" />
        )}
        
        {/* Loading indicator */}
        {loadingOlder && <LoadingShimmer />}
        
        {/* Messages */}
        <div className="space-y-0.5">
          {messagesList.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === currentUserId}
              partnerProfile={partnerProfile}
              currentUserId={currentUserId}
            />
          ))}
        </div>

        {/* Bottom sentinel */}
        <div ref={bottomSentinelRef} className="h-px" />
      </div>

      {/* Jump to latest button */}
      {(shouldShowJumpButton || unseenCount > 0) && (
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            onClick={handleJumpToLatest}
            size="sm"
            className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
            aria-label={`Jump to latest message${unseenCount > 0 ? ` (${unseenCount} new)` : ''}`}
          >
            <div className="flex items-center gap-2">
              {unseenCount > 0 && (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                  {unseenCount}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4" />
            </div>
          </Button>
        </div>
      )}
    </div>
  );
};