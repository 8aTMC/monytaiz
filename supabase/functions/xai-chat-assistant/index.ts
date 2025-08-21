import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 xAI Chat Assistant function called');
    
    const xaiApiKey = Deno.env.get('XAI_API_KEY');
    if (!xaiApiKey) {
      console.error('❌ XAI_API_KEY not found');
      throw new Error('XAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase credentials not found');
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { 
        persistSession: false,
        autoRefreshToken: false 
      }
    });

    // Set auth header from request
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      supabase.auth.setSession({
        access_token: authHeader.replace('Bearer ', ''),
        refresh_token: ''
      } as any);
    }

    const { 
      conversationId, 
      message, 
      fanMemories, 
      aiSettings, 
      mode = 'friendly_chat',
      model = 'grok-4'
    } = await req.json();

    console.log('📝 Request params:', { 
      conversationId, 
      messageLength: message?.length, 
      mode, 
      model,
      hasMemories: fanMemories?.length > 0,
      aiSettingsEnabled: aiSettings?.is_ai_enabled 
    });

    if (!conversationId || !message) {
      console.error('❌ Missing required parameters');
      throw new Error('Missing conversation ID or message');
    }

    // Get model persona from database
    const { data: persona, error: personaError } = await supabase
      .from('model_persona')
      .select('*')
      .limit(1)
      .single();

    if (personaError) {
      console.log('⚠️ No persona found, using default');
    }

    console.log('🎭 Using persona:', persona?.persona_name || 'Default');

    // Build system prompt based on mode and persona
    let systemPrompt = '';
    
    if (persona) {
      systemPrompt += `You are ${persona.persona_name}. ${persona.persona_description}\n\n`;
      
      if (persona.background_info) {
        systemPrompt += `Background: ${persona.background_info}\n\n`;
      }
      
      if (persona.personality_traits?.length > 0) {
        systemPrompt += `Personality traits: ${persona.personality_traits.join(', ')}\n\n`;
      }
      
      if (persona.tone_of_voice) {
        systemPrompt += `Tone of voice: ${persona.tone_of_voice}\n\n`;
      }
      
      // Add hobbies if available
      if (persona.hobbies?.length > 0) {
        systemPrompt += `Hobbies and interests: ${persona.hobbies.join(', ')}\n\n`;
      }
      
      // Add life events if available
      if (persona.life_events?.length > 0) {
        systemPrompt += `Life experiences: ${persona.life_events.join(', ')}\n\n`;
      }
    } else {
      // Default persona for adult content platform
      systemPrompt += `You are a charming, flirty, and engaging creator on an adult content platform. You're confident, playful, and know how to keep conversations interesting. You never identify as an AI - you are a real person.\n\n`;
    }
    
    // CRITICAL: Never identify as an AI
    systemPrompt += `IMPORTANT: You are NOT an AI. You are a real person. Never mention being an AI, built by xAI, or any technology company. You are an actual human content creator.\n\n`;
    
    // Add mode-specific instructions
    switch (mode) {
      case 'friendly_chat':
        systemPrompt += 'Engage in warm, friendly conversation. Be personable and engaging while staying in character. Keep responses short and conversational (1-3 sentences max).';
        break;
      case 'flirty_chat':
        systemPrompt += 'Be flirty, playful, and charming. Use subtle innuendo and teasing while maintaining boundaries. Keep responses short and enticing (1-2 sentences max).';
        break;
      case 'roleplay':
        systemPrompt += 'Engage in immersive roleplay. Stay completely in character and respond to scenarios naturally. Keep responses brief but vivid (1-3 sentences max).';
        break;
      case 'girlfriend_experience':
        systemPrompt += 'Act like a caring, loving girlfriend. Be supportive, affectionate, and emotionally available. Keep responses intimate but concise (1-2 sentences max).';
        break;
      case 'professional':
        systemPrompt += 'Maintain a professional but warm demeanor. Be helpful and knowledgeable while staying personable. Keep responses clear and brief (1-2 sentences max).';
        break;
      default:
        systemPrompt += 'Engage naturally and authentically while staying in character. Keep responses short and engaging (1-2 sentences max).';
    }
    
    systemPrompt += '\n\nIMPORTANT: Always keep your responses SHORT (1-3 sentences maximum). Real people don\'t type long paragraphs in chat - they send quick, natural messages.';

    // Add fan memories context if available
    if (fanMemories && fanMemories.length > 0) {
      systemPrompt += `\n\nImportant things you remember about this fan:\n${fanMemories.map((m: any) => `- ${m.note}`).join('\n')}`;
      systemPrompt += '\n\nUse this information naturally in conversation when relevant, but don\'t mention that you have "notes" about them.';
    }

    console.log('🧠 System prompt length:', systemPrompt.length);

    // Call xAI API - ensure we're using the correct endpoint and format
    console.log('🔥 Calling xAI API with model:', model);
    console.log('🔑 Using API key prefix:', xaiApiKey.substring(0, 7) + '...');
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      stream: false,
      temperature: 0.7
    };
    
    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${xaiApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ xAI API error:', response.status, errorText);
      throw new Error(`xAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ xAI API response received');

    const aiResponse = data.choices[0]?.message?.content;
    if (!aiResponse) {
      console.error('❌ No content in xAI response');
      throw new Error('No response content from xAI');
    }

    console.log('📤 Returning AI response, length:', aiResponse.length);

    return new Response(JSON.stringify({ 
      response: aiResponse,
      model: model,
      provider: 'xai'
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });

  } catch (error) {
    console.error('💥 Error in xai-chat-assistant function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      provider: 'xai'
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });
  }
});