import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingIndicator {
  user_id: string;
  conversation_id: string;
  is_typing: boolean;
}

export const useTypingIndicator = (conversationId: string | null, userId: string) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Update typing status
  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!conversationId) return;

    try {
      await supabase.rpc('update_typing_status', {
        p_conversation_id: conversationId,
        p_is_typing: typing
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [conversationId]);

  // Start typing
  const startTyping = useCallback(() => {
    if (isTyping) return;
    
    setIsTyping(true);
    updateTypingStatus(true);
    
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [isTyping, updateTypingStatus]);

  // Stop typing
  const stopTyping = useCallback(() => {
    if (!isTyping) return;
    
    setIsTyping(false);
    updateTypingStatus(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
  }, [isTyping, updateTypingStatus]);

  // Handle input change (for debounced typing detection)
  const handleInputChange = useCallback(() => {
    startTyping();
    
    // Reset the timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  }, [startTyping, stopTyping]);

  // Set up realtime subscription for typing indicators
  useEffect(() => {
    if (!conversationId) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newIndicator = payload.new as TypingIndicator;
          if (newIndicator.user_id !== userId && newIndicator.is_typing) {
            setTypingUsers((current) => {
              if (current.includes(newIndicator.user_id)) {
                return current;
              }
              return [...current, newIndicator.user_id];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedIndicator = payload.new as TypingIndicator;
          if (updatedIndicator.user_id !== userId) {
            setTypingUsers((current) => {
              if (updatedIndicator.is_typing) {
                return current.includes(updatedIndicator.user_id) 
                  ? current 
                  : [...current, updatedIndicator.user_id];
              } else {
                return current.filter(id => id !== updatedIndicator.user_id);
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedIndicator = payload.old as TypingIndicator;
          if (deletedIndicator.user_id !== userId) {
            setTypingUsers((current) => 
              current.filter(id => id !== deletedIndicator.user_id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        updateTypingStatus(false);
      }
    };
  }, [isTyping, updateTypingStatus]);

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
    handleInputChange
  };
};