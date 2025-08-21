// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // 1) CORS preflight
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

    const apiKey = Deno.env.get('XAI_API_KEY');
    if (!apiKey) {
      console.error('❌ Missing XAI_API_KEY in environment');
      return new Response(JSON.stringify({ error: 'Missing XAI_API_KEY' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🚀 xAI Chat Assistant function called');
    
    const body = await req.json();
    const { 
      fanId,
      conversationId, 
      message, 
      fanMemories, 
      aiSettings, 
      mode = 'friendly_chat', 
      model = 'grok-2' 
    } = body;

    console.log('📝 Request params:', {
      conversationId,
      messageLength: message?.length || 0,
      mode,
      model,
      hasMemories: fanMemories?.length > 0,
      aiSettingsEnabled: !!aiSettings
    });

    // Build system prompt based on mode and persona
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
        { role: 'user', content: message }
      ],
      stream: false,
      temperature: 0.8,
      max_completion_tokens: 150
    };

    console.log('📦 Request body:', JSON.stringify(xaiPayload, null, 2));

    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(xaiPayload),
    });

    console.log('✅ xAI API response received');

    // 2) Pass through upstream response, including errors, for easier debugging
    const responseText = await r.text();
    
    if (!r.ok) {
      console.error('❌ xAI API error:', r.status, responseText);
      return new Response(responseText, {
        status: r.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = JSON.parse(responseText);
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
      messages = content.split('---').map(msg => msg.trim()).filter(msg => msg.length > 0);
    } else {
      // Fallback: split by sentences and group into smaller messages
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
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

    return new Response(JSON.stringify({ 
      response: messages.length > 0 ? messages : [content]
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
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