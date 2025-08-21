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
      
      // Handle both array and string responses for backward compatibility
      const responses = Array.isArray(data.response) ? data.response : [data.response];
      return responses.join(' '); // Join for single response
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

      // Handle both array and string responses for backward compatibility
      const responses = Array.isArray(data.response) ? data.response : [data.response];
      
      console.log(`💬 Received ${responses.length} message parts:`, responses);

      // Validate responses array
      if (!responses || responses.length === 0) {
        console.error('❌ Empty response from AI');
        throw new Error('No valid response received from AI');
      }

      // Send each message part with realistic delays and typing indicators
      for (let i = 0; i < responses.length; i++) {
        const messagePart = responses[i];
        
        if (!messagePart || typeof messagePart !== 'string') {
          console.warn(`⚠️ Skipping invalid message part ${i + 1}:`, messagePart);
          continue;
        }
        
        // Calculate realistic typing delay for this message part
        const wordCount = messagePart.split(' ').length;
        const baseTypingDelay = Math.max(wordCount / 0.8, 1.5); // Slightly faster for short messages
        const typingDelay = baseTypingDelay + (Math.random() * 2); // Add 0-2 seconds variation
        
        console.log(`📝 Message ${i + 1}/${responses.length}: "${messagePart}" (${wordCount} words, ${typingDelay.toFixed(1)}s delay)`);

        // Show typing indicator
        if (aiSettings?.typing_simulation_enabled) {
          setIsTyping(true);
          
          await new Promise(resolve => {
            setTimeout(resolve, typingDelay * 1000);
          });
          
          setIsTyping(false);
        }

        // Send this message part
        await sendAIMessage(conversationId, messagePart);
        
        // Short pause between messages (except for the last one)
        if (i < responses.length - 1) {
          await new Promise(resolve => {
            setTimeout(resolve, 500 + Math.random() * 1000); // 0.5-1.5 second pause
          });
        }
      }
      
      if (onResponse) {
        onResponse(responses.join(' ')); // Join for callback
      }
    } catch (error) {
      console.error('AI response with typing error:', error);
      
      toast({
        title: "AI Unavailable",
        description: "AI assistant is temporarily unavailable",
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