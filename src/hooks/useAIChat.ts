import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useAIChat() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  // Deprecated: Client-side AI generation is now handled server-side
  // This function is kept for backward compatibility but does nothing
  const generateAIResponse = async (
    fanId: string,
    conversationId: string,
    message: string,
    mode: string = 'friendly_chat',
    model: string = 'monytaiz-pro'
  ): Promise<string | null> => {
    console.warn('generateAIResponse is deprecated - AI responses are now handled server-side via database triggers');
    return null;
  };

  // Deprecated: Client-side AI generation is now handled server-side
  // This function is kept for backward compatibility but does nothing
  const generateAIResponseWithTyping = async (
    fanId: string,
    conversationId: string,
    message: string,
    mode: string = 'friendly_chat',
    model: string = 'monytaiz-pro',
    onResponse?: (response: string) => void
  ): Promise<void> => {
    console.warn('generateAIResponseWithTyping is deprecated - AI responses are now handled server-side via database triggers');
    return;
  };

  // This function can still be used for manual message sending
  const sendAIMessage = async (conversationId: string, content: string): Promise<void> => {
    try {
      // Get the conversation to find the management user (sender)
      const { data: conversation } = await supabase
        .from('conversations')
        .select('creator_id')
        .eq('id', conversationId)
        .single();

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Insert AI message
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: conversation.creator_id, // Management user sends AI responses
          content: content,
          status: 'active',
          delivered_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending AI message:', error);
      throw error;
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