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
    mode: string = 'friendly_chat',
    provider: string = 'openai',
    model: string = 'gpt-4o-mini'
  ): Promise<string | null> => {
    setIsProcessing(true);
    
    try {
      // Get fan memories for context
      const { data: fanMemories } = await supabase
        .from('fan_memories')
        .select('*')
        .eq('fan_id', fanId);

      // Get AI settings
      const { data: aiSettings } = await supabase
        .from('ai_conversation_settings')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      const functionName = provider === 'xai' ? 'xai-chat-assistant' : 'ai-chat-assistant';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          fanId,
          conversationId,
          message,
          mode,
          model,
          fanMemories,
          aiSettings
        }
      });

      if (error) throw error;

      if (provider === 'xai') {
        return data.response;
      } else {
        if (!data.success) {
          throw new Error(data.error || 'AI response generation failed');
        }
        return data.reply;
      }
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
    provider: string = 'openai',
    model: string = 'gpt-4o-mini',
    onTypingStart?: () => void,
    onTypingEnd?: () => void,
    onResponse?: (response: string) => void
  ): Promise<void> => {
    setIsProcessing(true);
    
    try {
      // Get fan memories for context
      const { data: fanMemories } = await supabase
        .from('fan_memories')
        .select('*')
        .eq('fan_id', fanId);

      // Get AI settings
      const { data: aiSettings } = await supabase
        .from('ai_conversation_settings')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      const functionName = provider === 'xai' ? 'xai-chat-assistant' : 'ai-chat-assistant';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          fanId,
          conversationId,
          message,
          mode,
          model,
          fanMemories,
          aiSettings
        }
      });

      if (error) throw error;

      let reply;
      let typingDelay = 2; // Default typing delay

      if (provider === 'xai') {
        reply = data.response;
        // Calculate typing delay based on response length for xAI
        typingDelay = Math.min(Math.max(reply.length / 50, 1), 5);
      } else {
        if (!data.success) {
          throw new Error(data.error || 'AI response generation failed');
        }
        reply = data.reply;
        typingDelay = data.typingDelay;
      }

      // Start typing simulation if enabled
      if (aiSettings?.typing_simulation_enabled) {
        setIsTyping(true);
        onTypingStart?.();

        // Wait for typing delay
        await new Promise(resolve => setTimeout(resolve, typingDelay * 1000));

        // Stop typing and send response
        setIsTyping(false);
        onTypingEnd?.();
      }
      
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