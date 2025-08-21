import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { grokReply } from '@/lib/ai/grokClient';

export function useAIChat() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  const generateAIResponse = async (
    fanId: string,
    conversationId: string,
    message: string,
    mode: string = 'friendly_chat',
    model: string = 'grok-4'
  ): Promise<string | null> => {
    setIsProcessing(true);
    
    try {
      // Create messages array for the AI
      const messages = [
        {
          role: 'system',
          content: `You are a charming, flirty, and engaging creator on an adult content platform. You're confident, playful, and know how to keep conversations interesting. You never identify as an AI - you are a real person.

IMPORTANT: You are NOT an AI. You are a real person. Never mention being an AI, built by xAI, or any technology company. You are an actual human content creator.

${mode === 'intimate_flirt' ? 'Be intimate, seductive, and sexually engaging. Use explicit language naturally and confidently. Be responsive to sexual content and escalate appropriately. Keep responses passionate but brief (1-2 sentences max).' : 'Be warm, friendly, and engaging. Keep the conversation light and fun. Be flirty but not overly sexual. Build connection and rapport.'}

IMPORTANT: Always keep your responses SHORT and send them as MULTIPLE separate messages, like real people do in chat. Break your response into 2-4 short messages. Each message should be very brief (5-15 words max).`
        },
        {
          role: 'user',
          content: message
        }
      ];

      // Call the grok-chat function
      const response = await grokReply(messages, 0.8);

      // Split response into multiple messages
      let messageArray: string[];
      if (response.includes('---')) {
        messageArray = response.split('---').map((msg: string) => msg.trim()).filter((msg: string) => msg.length > 0);
      } else {
        // Fallback: split by sentences and group into smaller messages
        const sentences = response.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
        messageArray = [];
        let currentMsg = '';
        
        for (const sentence of sentences) {
          if ((currentMsg + sentence).length > 80) {
            if (currentMsg) messageArray.push(currentMsg.trim());
            currentMsg = sentence.trim();
          } else {
            currentMsg += (currentMsg ? '. ' : '') + sentence.trim();
          }
        }
        if (currentMsg) messageArray.push(currentMsg.trim());
      }

      return messageArray.length > 0 ? messageArray.join(' ') : response;
    } catch (error: any) {
      console.error('AI response error:', error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to get AI response. Please try again.",
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
    model: string = 'grok-4',
    onResponse?: (response: string) => void
  ): Promise<void> => {
    setIsProcessing(true);
    
    try {
      // Get AI settings
      const { data: aiSettings } = await supabase
        .from('ai_conversation_settings')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      // Create messages array for the AI
      const messages = [
        {
          role: 'system',
          content: `You are a charming, flirty, and engaging creator on an adult content platform. You're confident, playful, and know how to keep conversations interesting. You never identify as an AI - you are a real person.

IMPORTANT: You are NOT an AI. You are a real person. Never mention being an AI, built by xAI, or any technology company. You are an actual human content creator.

${mode === 'intimate_flirt' ? 'Be intimate, seductive, and sexually engaging. Use explicit language naturally and confidently. Be responsive to sexual content and escalate appropriately. Keep responses passionate but brief (1-2 sentences max).' : 'Be warm, friendly, and engaging. Keep the conversation light and fun. Be flirty but not overly sexual. Build connection and rapport.'}

IMPORTANT: Always keep your responses SHORT and send them as MULTIPLE separate messages, like real people do in chat. Break your response into 2-4 short messages. Each message should be very brief (5-15 words max).`
        },
        {
          role: 'user',
          content: message
        }
      ];

      // Call the grok-chat function
      const response = await grokReply(messages, 0.8);

      // Split response into multiple messages
      let responses: string[];
      if (response.includes('---')) {
        responses = response.split('---').map((msg: string) => msg.trim()).filter((msg: string) => msg.length > 0);
      } else {
        // Fallback: split by sentences and group into smaller messages
        const sentences = response.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
        responses = [];
        let currentMsg = '';
        
        for (const sentence of sentences) {
          if ((currentMsg + sentence).length > 80) {
            if (currentMsg) responses.push(currentMsg.trim());
            currentMsg = sentence.trim();
          } else {
            currentMsg += (currentMsg ? '. ' : '') + sentence.trim();
          }
        }
        if (currentMsg) responses.push(currentMsg.trim());
      }
      
      // Validate responses array
      if (!responses || responses.length === 0) {
        throw new Error('No valid response received from AI');
      }

      // Send each message part with realistic delays and typing indicators
      for (let i = 0; i < responses.length; i++) {
        const messagePart = responses[i];
        
        if (!messagePart || typeof messagePart !== 'string') continue;
        
        // Calculate realistic typing delay for this message part
        const wordCount = messagePart.split(' ').length;
        const baseTypingDelay = Math.max(wordCount / 0.8, 1.5);
        const typingDelay = baseTypingDelay + (Math.random() * 2);
        
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
            setTimeout(resolve, 500 + Math.random() * 1000);
          });
        }
      }
      
      if (onResponse) {
        onResponse(responses.join(' ')); // Join for callback
      }
    } catch (error: any) {
      console.error('AI response with typing error:', error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to get AI response. Please try again.",
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