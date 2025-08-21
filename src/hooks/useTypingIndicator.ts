import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingPresence {
  userId: string;
  typingUntil?: number;
}

interface PresencePayload {
  [key: string]: any;
  userId?: string;
  typingUntil?: number;
}

export const useTypingIndicator = (conversationId: string | null, userId: string) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastBroadcastRef = useRef<number>(0);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  // Throttled presence update - max once every 1500ms
  const broadcastTyping = useCallback((typingUntil?: number) => {
    if (!channelRef.current) return;
    
    const now = Date.now();
    if (now - lastBroadcastRef.current < 1500) return;
    
    lastBroadcastRef.current = now;
    
    const presence = typingUntil ? { userId, typingUntil } : { userId };
    channelRef.current.track(presence);
  }, [userId]);

  // Start typing - set 3 second timeout
  const startTyping = useCallback(() => {
    if (!conversationId || isTyping) return;
    
    setIsTyping(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Broadcast typing with 3s timeout
    const typingUntil = Date.now() + 3000;
    broadcastTyping(typingUntil);
    
    // Auto-stop after 3s of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [conversationId, isTyping, broadcastTyping]);

  // Stop typing - remove presence
  const stopTyping = useCallback(() => {
    if (!isTyping) return;
    
    setIsTyping(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
    
    // Remove typing from presence
    broadcastTyping();
  }, [isTyping, broadcastTyping]);

  // Debounced typing handler for input changes
  const handleTyping = useCallback(() => {
    if (!conversationId) return;
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Start typing if not already
    if (!isTyping) {
      startTyping();
    } else {
      // Extend typing timeout
      const typingUntil = Date.now() + 3000;
      broadcastTyping(typingUntil);
      
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    }
  }, [conversationId, isTyping, startTyping, stopTyping, broadcastTyping]);

  // Set up realtime presence channel
  useEffect(() => {
    if (!conversationId) {
      setTypingUsers([]);
      return;
    }

    // Create channel for this conversation
    const channel = supabase.channel(`realtime.conversation.${conversationId}`);
    channelRef.current = channel;

    // Handle presence sync
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const currentTypingUsers: string[] = [];
        
        const now = Date.now();
        Object.keys(state).forEach(presenceUserId => {
          const presences = state[presenceUserId] as PresencePayload[];
          const presence = presences[0];
          
          // User is typing if typingUntil exists and is in the future
          if (presence?.typingUntil && presence.typingUntil > now && presence.userId !== userId) {
            currentTypingUsers.push(presence.userId);
          }
        });
        
        setTypingUsers(currentTypingUsers);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Handle when someone joins and starts typing
        const now = Date.now();
        newPresences.forEach((presence: PresencePayload) => {
          if (presence.typingUntil && presence.typingUntil > now && presence.userId !== userId) {
            setTypingUsers(current => 
              current.includes(presence.userId) ? current : [...current, presence.userId]
            );
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // Handle when someone leaves
        leftPresences.forEach((presence: PresencePayload) => {
          if (presence.userId) {
            setTypingUsers(current => current.filter(id => id !== presence.userId));
          }
        });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  // Refresh typing users every second to clear stale states
  useEffect(() => {
    if (!conversationId) return;
    
    refreshIntervalRef.current = setInterval(() => {
      if (!channelRef.current) return;
      
      const state = channelRef.current.presenceState();
      const currentTypingUsers: string[] = [];
      
      const now = Date.now();
      Object.keys(state).forEach(presenceUserId => {
        const presences = state[presenceUserId] as PresencePayload[];
        const presence = presences[0];
        
        // Only include users whose typing hasn't expired
        if (presence?.typingUntil && presence.typingUntil > now && presence.userId !== userId) {
          currentTypingUsers.push(presence.userId);
        }
      });
      
      setTypingUsers(currentTypingUsers);
    }, 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [conversationId, userId]);

  // Cleanup on unmount, blur, or visibility change
  useEffect(() => {
    const handleCleanup = () => {
      if (isTyping) {
        stopTyping();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleCleanup();
      }
    };

    window.addEventListener('beforeunload', handleCleanup);
    window.addEventListener('blur', handleCleanup);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleCleanup);
      window.removeEventListener('blur', handleCleanup);
      document.removeEventListener('visibilitychange', handleCleanup);
      
      // Final cleanup
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (isTyping) {
        stopTyping();
      }
    };
  }, [isTyping, stopTyping]);

  // Force cleanup when conversation changes
  useEffect(() => {
    if (isTyping) {
      stopTyping();
    }
    setTypingUsers([]);
  }, [conversationId, stopTyping]);

  return {
    typingUsers,
    isTyping,
    startTyping: handleTyping,
    stopTyping
  };
};