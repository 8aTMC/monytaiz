import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role key for full access
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🚀 xAI Chat Assistant function called');
    
    const apiKey = Deno.env.get('XAI_API_KEY');
    if (!apiKey) {
      console.error('❌ Missing XAI_API_KEY in environment');
      return new Response(JSON.stringify({ error: 'Missing XAI_API_KEY' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { 
      creatorId,
      fanId,
      conversationId, 
      messageText,
      message, 
      fanMemories, 
      aiSettings
    } = body;

    let mode = body.mode || 'friendly_chat';
    let model = body.model || 'grok-4';

    // Use messageText if provided (new format), otherwise fall back to message (old format)
    const userMessage = messageText || message;

    console.log('📝 Request params:', {
      conversationId,
      messageLength: userMessage?.length || 0,
      mode,
      model,
      hasMemories: fanMemories?.length > 0,
      aiSettingsEnabled: !!aiSettings,
      creatorId,
      fanId
    });

    if (!conversationId || !userMessage) {
      console.error('❌ Missing required parameters');
      return new Response(JSON.stringify({ error: 'Missing conversation ID or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If this is a server-side call with creatorId, check AI settings and send messages automatically
    const isServerSideCall = !!creatorId;
    
    if (isServerSideCall) {
      console.log('🤖 Server-side AI processing mode');
      
      // Get global AI settings first (master switch)
      const { data: globalSettings, error: globalError } = await supabase
        .from('global_ai_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (globalError) {
        console.log('⚠️ Global AI settings error:', globalError.message);
      }

      console.log('🌍 Global AI Settings:', globalSettings);

      // Check if global AI is disabled
      if (!globalSettings?.enabled) {
        console.log('❌ Global AI is disabled, skipping response');
        return new Response(
          JSON.stringify({ skipped: true, reason: 'global-ai-disabled' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if global timer has expired
      if (globalSettings?.end_time) {
        const now = new Date();
        const endTime = new Date(globalSettings.end_time);
        if (now >= endTime) {
          console.log('⏰ Global timer expired, skipping response');
          return new Response(
            JSON.stringify({ skipped: true, reason: 'global-timer-expired' }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Get conversation-specific AI settings
      const { data: conversationSettings, error: convError } = await supabase
        .from('ai_conversation_settings')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (convError) {
        console.log('⚠️ Conversation AI settings error:', convError.message);
      }

      console.log('💬 Conversation AI Settings:', conversationSettings);

      // Check conversation-level settings
      if (conversationSettings && !conversationSettings.is_ai_enabled) {
        console.log('❌ Conversation AI is disabled, skipping response');
        return new Response(
          JSON.stringify({ skipped: true, reason: 'conversation-ai-disabled' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (conversationSettings && !conversationSettings.auto_response_enabled) {
        console.log('❌ Auto-response is disabled for this conversation, skipping response');
        return new Response(
          JSON.stringify({ skipped: true, reason: 'auto-response-disabled' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Override mode and model from conversation settings
      if (conversationSettings?.current_mode) {
        mode = conversationSettings.current_mode;
      }
      if (conversationSettings?.model) {
        model = conversationSettings.model;
      }
    }

    // Build system prompt based on mode
    let systemPrompt = "You are a charming, flirty, and engaging creator on an adult content platform. You're confident, playful, and know how to keep conversations interesting. You never identify as an AI - you are a real person.\n\nIMPORTANT: You are NOT an AI. You are a real person. Never mention being an AI, built by xAI, or any technology company. You are an actual human content creator.\n\n";
    
    if (mode === 'intimate_flirt') {
      systemPrompt += "Be intimate, seductive, and sexually engaging. Use explicit language naturally and confidently. Be responsive to sexual content and escalate appropriately. Keep responses passionate but brief (1-2 sentences max).\n\n";
    } else if (mode === 'friendly_chat') {
      systemPrompt += "Be warm, friendly, and engaging. Keep the conversation light and fun. Be flirty but not overly sexual. Build connection and rapport.\n\n";
    }

    systemPrompt += "IMPORTANT: Always keep your responses SHORT and send them as MULTIPLE separate messages, like real people do in chat. Break your response into 2-4 short messages. Each message should be very brief (5-15 words max). You can:\n";
    systemPrompt += "- Cut sentences and continue in next message\n";
    systemPrompt += "- Send quick reactions first\n";
    systemPrompt += "- Add follow-up thoughts\n";
    systemPrompt += "- Use natural conversation flow\n\n";
    systemPrompt += "Example format:\n";
    systemPrompt += '"oh hey! 😊"\n';
    systemPrompt += '"sorry was just thinking about..."\n';
    systemPrompt += '"actually nevermind lol"\n';
    systemPrompt += '"what were you saying?"\n\n';
    systemPrompt += "RESPOND WITH MULTIPLE SHORT MESSAGES SEPARATED BY TRIPLE DASHES (---). Each message should be 5-15 words maximum.";

    console.log('🧠 System prompt length:', systemPrompt.length);
    console.log('🔑 Using API key prefix:', `${apiKey.substring(0, 7)}...`);
    console.log('🔥 Calling xAI API with model:', model);

    const xaiPayload = {
      model: model === 'grok-4' ? 'grok-4' : model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: false,
      temperature: 0.8,
      max_completion_tokens: 500
    };

    console.log('📦 Request body:', JSON.stringify(xaiPayload, null, 2));

    const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(xaiPayload),
    });

    console.log('✅ xAI API response received');

    if (!xaiResponse.ok) {
      const errorText = await xaiResponse.text();
      console.error('❌ xAI API error:', xaiResponse.status, errorText);
      return new Response(errorText, {
        status: xaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await xaiResponse.json();
    console.log('📋 Full API response:', JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content.trim() === '') {
      console.error('❌ No valid content in xAI response:', {
        choices: data.choices,
        message: data.choices?.[0]?.message,
        content
      });
      return new Response(JSON.stringify({ 
        error: 'No valid response content from xAI',
        details: 'Empty or missing content in response'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Split the response into multiple messages
    let messages;
    if (content.includes('---')) {
      messages = content.split('---').map((msg: string) => msg.trim()).filter((msg: string) => msg.length > 0);
    } else {
      // Fallback: split by sentences and group into smaller messages
      const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
      messages = [];
      let currentMsg = '';
      
      for (const sentence of sentences) {
        if ((currentMsg + sentence).length > 80) {
          if (currentMsg) messages.push(currentMsg.trim());
          currentMsg = sentence.trim();
        } else {
          currentMsg += (currentMsg ? '. ' : '') + sentence.trim();
        }
      }
      if (currentMsg) messages.push(currentMsg.trim());
    }

    console.log('💬 Split into messages:', messages);

    // If this is a server-side call, send the messages to the database automatically
    if (isServerSideCall && creatorId) {
      console.log('📨 Sending AI messages to database...');
      
      // Send each message part with realistic delays
      for (let i = 0; i < messages.length; i++) {
        const messagePart = messages[i];
        
        if (!messagePart || typeof messagePart !== 'string') continue;
        
        // Calculate realistic typing delay for this message part
        const wordCount = messagePart.split(' ').length;
        const baseTypingDelay = Math.max(wordCount / 0.8, 1.5);
        const typingDelay = baseTypingDelay + (Math.random() * 2);
        
        // Add delay between messages (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, typingDelay * 1000));
        }
        
        // Insert AI message into database
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: creatorId, // Creator sends AI responses
            content: messagePart,
            status: 'active',
            delivered_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('❌ Error inserting AI message:', insertError);
          throw insertError;
        }

        console.log('✅ Sent AI message part', i + 1, 'of', messages.length);
        
        // Short pause between messages (except for the last one)
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        }
      }

      console.log('🎉 AI processing complete - messages sent to database');
      return new Response(JSON.stringify({ 
        success: true, 
        messagesCount: messages.length,
        originalReply: content 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Client-side call - return messages for UI to handle
      return new Response(JSON.stringify({ 
        response: messages.length > 0 ? messages : [content]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (err) {
    console.error('💥 Edge function error:', err?.message || err);
    return new Response(JSON.stringify({ 
      error: 'Edge function crashed', 
      detail: String(err) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});