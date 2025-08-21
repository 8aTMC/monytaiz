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

  // Simple typing status update
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
    if (isTyping || !conversationId) return;
    
    setIsTyping(true);
    updateTypingStatus(true);
  }, [isTyping, conversationId, updateTypingStatus]);

  // Stop typing with immediate cleanup
  const stopTyping = useCallback(() => {
    if (!conversationId) return;
    
    setIsTyping(false);
    updateTypingStatus(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
  }, [conversationId, updateTypingStatus]);

  // Handle key press events with debounce
  const handleKeyPress = useCallback((key: string) => {
    if (!conversationId) return;

    // Stop typing immediately if Enter is pressed (message sent)
    if (key === 'Enter') {
      stopTyping();
      return;
    }
    
    // Only handle actual input keys
    if (key.length === 1 || key === 'Backspace' || key === 'Delete') {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Start typing if not already
      if (!isTyping) {
        startTyping();
      }
      
      // Set new timeout to stop after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  }, [conversationId, isTyping, startTyping, stopTyping]);

  // Set up realtime subscription for typing indicators
  useEffect(() => {
    if (!conversationId) {
      setTypingUsers([]);
      return;
    }

    // Clean up any existing indicators for this user first
    const cleanupOwnIndicators = async () => {
      try {
        await supabase
          .from('typing_indicators')
          .delete()
          .eq('user_id', userId)
          .eq('conversation_id', conversationId);
      } catch (error) {
        console.error('Error cleaning up own indicators:', error);
      }
    };

    cleanupOwnIndicators();

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
              if (!current.includes(newIndicator.user_id)) {
                return [...current, newIndicator.user_id];
              }
              return current;
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

    // Clean up stale indicators periodically (every 30 seconds)
    const cleanupInterval = setInterval(async () => {
      try {
        await supabase
          .from('typing_indicators')
          .delete()
          .lt('updated_at', new Date(Date.now() - 30000).toISOString());
      } catch (error) {
        console.error('Error in periodic cleanup:', error);
      }
    }, 30000);

    return () => {
      clearInterval(cleanupInterval);
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  // Cleanup on component unmount or route change
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isTyping && conversationId) {
        // Use synchronous cleanup for page unload
        supabase.rpc('update_typing_status', {
          p_conversation_id: conversationId,
          p_is_typing: false
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing on unmount
      if (isTyping && conversationId) {
        updateTypingStatus(false);
      }
    };
  }, [conversationId, isTyping, userId, updateTypingStatus]);

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
    startTyping,
    stopTyping,
    handleKeyPress
  };
};