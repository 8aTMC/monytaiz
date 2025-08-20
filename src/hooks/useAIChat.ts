import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useAIChat() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  const generateAIResponse = async (
    fanId: string,
    conversationId: string,
    message: string,
    mode: string = 'friendly_chat'
  ): Promise<string | null> => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat-assistant', {
        body: {
          fanId,
          conversationId,
          message,
          mode
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'AI response generation failed');
      }

      return data.reply;
    } catch (error) {
      console.error('Error generating AI response:', error);
      toast({
        title: "AI Error",
        description: "Failed to generate AI response. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const generateAIResponseWithTyping = async (
    fanId: string,
    conversationId: string,
    message: string,
    mode: string = 'friendly_chat',
    onTypingStart?: () => void,
    onTypingEnd?: () => void,
    onResponse?: (response: string) => void
  ): Promise<void> => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat-assistant', {
        body: {
          fanId,
          conversationId,
          message,
          mode
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'AI response generation failed');
      }

      const { reply, typingDelay } = data;

      // Start typing simulation
      setIsTyping(true);
      onTypingStart?.();

      // Wait for typing delay
      await new Promise(resolve => setTimeout(resolve, typingDelay * 1000));

      // Stop typing and send response
      setIsTyping(false);
      onTypingEnd?.();
      onResponse?.(reply);

    } catch (error) {
      console.error('Error generating AI response:', error);
      setIsTyping(false);
      onTypingEnd?.();
      toast({
        title: "AI Error",
        description: "Failed to generate AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sendAIMessage = async (
    conversationId: string,
    content: string,
    senderId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content,
          sender_id: senderId,
          message_type: 'text',
          status: 'active'
        }]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending AI message:', error);
      return false;
    }
  };

  return {
    generateAIResponse,
    generateAIResponseWithTyping,
    sendAIMessage,
    isProcessing,
    isTyping
  };
}