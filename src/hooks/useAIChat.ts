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
    model: string = 'grok-2'
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

      // Always use xAI
      const { data, error } = await supabase.functions.invoke('xai-chat-assistant', {
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
      return data.response;
    } catch (error) {
      console.error('AI response error:', error);
      toast({
        title: "AI Error",
        description: "Failed to generate AI response",
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
    model: string = 'grok-2',
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

      // Always use xAI
      const { data, error } = await supabase.functions.invoke('xai-chat-assistant', {
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

      const reply = data.response;
      
      // Calculate realistic typing delay based on message length
      // Average typing speed: 40 words per minute = 0.67 words per second
      // Add some variation and minimum delay
      const wordCount = reply.split(' ').length;
      const baseTypingDelay = Math.max(wordCount / 0.67, 2); // Minimum 2 seconds
      const typingDelay = baseTypingDelay + (Math.random() * 3); // Add 0-3 seconds variation
      
      console.log(`💬 Reply: "${reply}" (${wordCount} words, ${typingDelay.toFixed(1)}s delay)`);

      // Simulate typing if enabled in settings
      if (aiSettings?.typing_simulation_enabled) {
        setIsTyping(true);
        
        await new Promise(resolve => {
          setTimeout(resolve, typingDelay * 1000);
        });
        
        setIsTyping(false);
      }

      // Send AI response
      await sendAIMessage(conversationId, reply);
      
      if (onResponse) {
        onResponse(reply);
      }
    } catch (error) {
      console.error('AI response with typing error:', error);
      toast({
        title: "AI Error",
        description: "Failed to generate AI response",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setIsTyping(false);
    }
  };

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