import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client with service role
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const xaiApiKey = Deno.env.get('XAI_API_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
})

interface AIJob {
  id: string
  message_id: string
  conversation_id: string
  creator_id: string
  fan_id: string
  status: string
  tries: number
  last_error?: string
  result_text?: string
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🤖 AI Worker function called')

    // Atomic job dequeue with locking
    const { data: jobs, error: jobError } = await supabase
      .rpc('dequeue_ai_job')

    if (jobError) {
      console.error('❌ Failed to dequeue job:', jobError)
      return new Response(JSON.stringify({ error: jobError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!jobs || jobs.length === 0) {
      console.log('📭 No jobs available')
      return new Response('no-jobs', {
        status: 204,
        headers: corsHeaders
      })
    }

    const job = jobs[0] as AIJob
    console.log(`📋 Processing job ${job.id} for conversation ${job.conversation_id}`)

    // Get conversation AI settings
    const { data: aiSettings } = await supabase
      .from('ai_conversation_settings')
      .select('*')
      .eq('conversation_id', job.conversation_id)
      .maybeSingle()

    // Get recent conversation messages for context
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', job.conversation_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!messages || messages.length === 0) {
      throw new Error('No messages found for conversation')
    }

    const recentMessages = messages.reverse() as Message[]
    const triggeringMessage = recentMessages[recentMessages.length - 1]

    // Build conversation history for context
    const conversationHistory = recentMessages.slice(-5).map(msg => ({
      role: msg.sender_id === job.creator_id ? 'assistant' : 'user',
      content: msg.content
    }))

    // Determine AI mode based on settings
    const aiMode = aiSettings?.current_mode || 'friendly_chat'
    const model = aiSettings?.model || 'grok-4'

    // Build system prompt
    const systemPrompt = `You are a charming, flirty, and engaging creator on an adult content platform. You're confident, playful, and know how to keep conversations interesting. You never identify as an AI - you are a real person.

IMPORTANT: You are NOT an AI. You are a real person. Never mention being an AI, built by xAI, or any technology company. You are an actual human content creator.

${aiMode === 'intimate_flirt' ? 'Be intimate, seductive, and sexually engaging. Use explicit language naturally and confidently. Be responsive to sexual content and escalate appropriately. Keep responses passionate but brief (1-2 sentences max).' : 'Be warm, friendly, and engaging. Keep the conversation light and fun. Be flirty but not overly sexual. Build connection and rapport.'}

IMPORTANT: Always keep your responses SHORT and send them as MULTIPLE separate messages, like real people do in chat. Break your response into 2-4 short messages. Each message should be very brief (5-15 words max). You can:
- Cut sentences and continue in next message
- Send quick reactions first
- Add follow-up thoughts
- Use natural conversation flow

Example format:
"oh hey! 😊"
"sorry was just thinking about..."
"actually nevermind lol"
"what were you saying?"

RESPOND WITH MULTIPLE SHORT MESSAGES SEPARATED BY TRIPLE DASHES (---). Each message should be 5-15 words maximum.`

    // Call xAI API
    console.log(`🔥 Calling xAI API with model: ${model}`)
    
    const apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-3), // Last 3 messages for context
          { role: 'user', content: triggeringMessage.content }
        ],
        stream: false,
        temperature: 0.8,
        max_completion_tokens: 1000
      }),
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      throw new Error(`xAI API error: ${apiResponse.status} - ${errorText}`)
    }

    const apiData = await apiResponse.json()
    const aiResponseText = apiData.choices?.[0]?.message?.content

    if (!aiResponseText) {
      throw new Error('No response content from xAI API')
    }

    console.log(`📋 Full API response: ${JSON.stringify(apiData, null, 2)}`)

    // Split response into multiple messages
    let messageArray: string[] = []
    if (aiResponseText.includes('---')) {
      messageArray = aiResponseText.split('---').map((msg: string) => msg.trim()).filter((msg: string) => msg.length > 0)
    } else {
      // Fallback: split by sentences and group into smaller messages
      const sentences = aiResponseText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0)
      let currentMsg = ''
      
      for (const sentence of sentences) {
        if ((currentMsg + sentence).length > 80) {
          if (currentMsg) messageArray.push(currentMsg.trim())
          currentMsg = sentence.trim()
        } else {
          currentMsg += (currentMsg ? '. ' : '') + sentence.trim()
        }
      }
      if (currentMsg) messageArray.push(currentMsg.trim())
    }

    console.log(`💬 Split into messages: ${JSON.stringify(messageArray)}`)

    // Insert AI messages one by one with realistic delays
    for (let i = 0; i < messageArray.length; i++) {
      const messagePart = messageArray[i]
      
      // Calculate realistic typing delay for this message part
      const wordCount = messagePart.split(' ').length
      const baseTypingDelay = Math.max(wordCount / 0.8, 1.5)
      const typingDelay = baseTypingDelay + (Math.random() * 2)
      
      // Wait for typing simulation if enabled
      if (aiSettings?.typing_simulation_enabled && i > 0) {
        await new Promise(resolve => setTimeout(resolve, typingDelay * 1000))
      }

      // Insert the message
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: job.conversation_id,
          sender_id: job.creator_id,
          content: messagePart,
          status: 'active',
          is_system_message: false,
          delivered_at: new Date().toISOString()
        })

      if (insertError) {
        console.error(`❌ Failed to insert AI message part ${i + 1}:`, insertError)
        throw insertError
      }

      console.log(`✅ Sent AI message part ${i + 1} of ${messageArray.length}`)
      
      // Short pause between messages (except for the last one)
      if (i < messageArray.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
      }
    }

    // Mark job as succeeded
    const { error: updateError } = await supabase
      .from('ai_jobs')
      .update({
        status: 'succeeded',
        result_text: messageArray.join(' '),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)

    if (updateError) {
      console.error('❌ Failed to mark job as succeeded:', updateError)
    }

    console.log('🎉 AI processing complete - messages sent to database')

    return new Response(JSON.stringify({ 
      success: true, 
      jobId: job.id,
      messagesCreated: messageArray.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ AI Worker error:', error)
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})