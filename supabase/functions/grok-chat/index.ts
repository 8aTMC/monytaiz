const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  console.log(`grok-chat: ${req.method} request received`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      console.log('grok-chat: Invalid method:', req.method);
      return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('XAI_API_KEY');
    if (!apiKey) {
      console.error('grok-chat: XAI_API_KEY not found in environment');
      return new Response(JSON.stringify({ error: 'XAI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('grok-chat: Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, temperature = 0.7, model = 'grok-4' } = requestBody;
    
    if (!messages || !Array.isArray(messages)) {
      console.error('grok-chat: Invalid messages format:', messages);
      return new Response(JSON.stringify({ error: 'Messages must be an array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`grok-chat: Making request to xAI with model: ${model}`);

    const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature }),
    });

    console.log(`grok-chat: xAI API response status: ${xaiResponse.status}`);
    
    if (!xaiResponse.ok) {
      const errorText = await xaiResponse.text();
      console.error('grok-chat: xAI API error:', errorText);
      return new Response(JSON.stringify({ 
        error: 'xAI API error', 
        status: xaiResponse.status,
        details: errorText 
      }), {
        status: xaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseText = await xaiResponse.text();
    console.log('grok-chat: Successfully got response from xAI');
    
    return new Response(responseText, {
      status: xaiResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err) {
    console.error('grok-chat: Unexpected error:', err);
    return new Response(JSON.stringify({ 
      error: 'Edge function error', 
      details: String(err),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});