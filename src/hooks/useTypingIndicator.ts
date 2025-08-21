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
  const lastUpdateRef = useRef<number>(0);

  // Update typing status with throttling
  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!conversationId) return;

    const now = Date.now();
    // Throttle updates to max once every 500ms
    if (now - lastUpdateRef.current < 500 && typing) return;
    
    lastUpdateRef.current = now;

    try {
      console.log(`Updating typing status: ${typing} for conversation ${conversationId}`);
      await supabase.rpc('update_typing_status', {
        p_conversation_id: conversationId,
        p_is_typing: typing
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [conversationId]);

  // Start typing with proper checks
  const startTyping = useCallback(() => {
    if (isTyping || !conversationId) return;
    
    console.log('Starting typing indicator');
    setIsTyping(true);
    updateTypingStatus(true);
  }, [isTyping, conversationId, updateTypingStatus]);

  // Stop typing with cleanup and force clear
  const stopTyping = useCallback(() => {
    if (!conversationId) return;
    
    console.log('Stopping typing indicator');
    setIsTyping(false);
    updateTypingStatus(false);
    
    // Clear timeout immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
  }, [conversationId, updateTypingStatus]);

  // Handle key press events only
  const handleKeyPress = useCallback((key: string) => {
    // Stop typing immediately if Enter is pressed
    if (key === 'Enter') {
      stopTyping();
      return;
    }
    
    // Only handle actual character input keys (exclude Enter)
    if (key.length === 1 || key === 'Backspace' || key === 'Delete') {
      console.log('Key press detected:', key);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Start typing if not already typing
      if (!isTyping) {
        startTyping();
      }
      
      // Set timeout to stop typing after inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  }, [isTyping, startTyping, stopTyping]);

  // Set up realtime subscription for typing indicators
  useEffect(() => {
    if (!conversationId) {
      setTypingUsers([]);
      return;
    }

    console.log('Setting up typing indicator subscription for:', conversationId);

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
          console.log('Typing indicator INSERT:', payload);
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
          console.log('Typing indicator UPDATE:', payload);
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
          console.log('Typing indicator DELETE:', payload);
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
      console.log('Cleaning up typing indicator subscription');
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      console.log('Cleaning up typing indicator on unmount');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping && conversationId) {
        updateTypingStatus(false);
      }
    };
  }, [conversationId]);

  // Force cleanup when conversation changes
  useEffect(() => {
    if (isTyping) {
      console.log('Conversation changed, stopping typing');
      stopTyping();
    }
    setTypingUsers([]);
  }, [conversationId]);

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
    handleKeyPress
  };
};