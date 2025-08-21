import { supabase } from '@/integrations/supabase/client';
import { grokReply } from '@/lib/ai/grokClient';
import { shouldAutoRespond } from './selectors';
import { 
  AIConfig, 
  ConversationOverride, 
  CachedConfig, 
  MessageQueueItem, 
  AIResponseResult 
} from './types';

// In-memory cache with stale-while-revalidate
const aiConfigCache = new Map<string, CachedConfig<AIConfig>>();
const conversationOverrideCache = new Map<string, CachedConfig<ConversationOverride>>();
const messageQueue = new Map<string, MessageQueueItem>();

const CACHE_TTL = 30000; // 30 seconds
const QUEUE_TIMEOUT = 2000; // 2 seconds max wait for settings

export async function getAIConfig(creatorId: string): Promise<AIConfig | undefined> {
  const cached = aiConfigCache.get(creatorId);
  const now = Date.now();
  
  // Return cached data if fresh or loading
  if (cached?.status === 'loading') {
    try {
      return await cached.promise;
    } catch {
      return undefined;
    }
  }
  
  if (cached?.data && cached.lastFetched && (now - cached.lastFetched) < CACHE_TTL) {
    return cached.data;
  }

  // Set loading state
  const promise = fetchAIConfig(creatorId);
  aiConfigCache.set(creatorId, { 
    data: cached?.data || null, 
    status: 'loading', 
    promise,
    lastFetched: cached?.lastFetched 
  });

  try {
    const data = await promise;
    aiConfigCache.set(creatorId, { 
      data, 
      status: 'success', 
      lastFetched: now 
    });
    return data;
  } catch (error) {
    aiConfigCache.set(creatorId, { 
      data: cached?.data || null, 
      status: 'error',
      lastFetched: cached?.lastFetched || now
    });
    return undefined;
  }
}

export async function getConversationAIOverride(conversationId: string): Promise<ConversationOverride | undefined> {
  const cached = conversationOverrideCache.get(conversationId);
  const now = Date.now();
  
  if (cached?.status === 'loading') {
    try {
      return await cached.promise;
    } catch {
      return undefined;
    }
  }
  
  if (cached?.data && cached.lastFetched && (now - cached.lastFetched) < CACHE_TTL) {
    return cached.data;
  }

  const promise = fetchConversationOverride(conversationId);
  conversationOverrideCache.set(conversationId, { 
    data: cached?.data || null, 
    status: 'loading', 
    promise,
    lastFetched: cached?.lastFetched 
  });

  try {
    const data = await promise;
    conversationOverrideCache.set(conversationId, { 
      data, 
      status: 'success', 
      lastFetched: now 
    });
    return data;
  } catch (error) {
    conversationOverrideCache.set(conversationId, { 
      data: cached?.data || null, 
      status: 'error',
      lastFetched: cached?.lastFetched || now
    });
    return undefined;
  }
}

async function fetchAIConfig(creatorId: string): Promise<AIConfig> {
  // Get creator's global AI settings - for now we'll use conversation settings as fallback
  // In the future, this could be a separate `creator_ai_settings` table
  const { data } = await supabase
    .from('ai_conversation_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (!data) {
    // Default config if none exists
    return {
      aiEnabled: false,
      autoResponseEnabled: false,
      defaultMode: 'friendly_chat',
      safetyLevel: 'flirty',
      model: 'grok-4',
      typingSimulationEnabled: true,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    aiEnabled: data.is_ai_enabled || false,
    autoResponseEnabled: data.auto_response_enabled || false,
    defaultMode: data.current_mode || 'friendly_chat',
    safetyLevel: 'flirty', // Default for now
    model: data.model || 'grok-4',
    typingSimulationEnabled: data.typing_simulation_enabled !== false,
    updatedAt: data.updated_at || new Date().toISOString()
  };
}

async function fetchConversationOverride(conversationId: string): Promise<ConversationOverride> {
  const { data } = await supabase
    .from('ai_conversation_settings')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (!data) return {};

  return {
    disabled: !data.is_ai_enabled,
    modeOverride: data.current_mode
  };
}

async function isConversationMuted(conversationId: string): Promise<boolean> {
  // TODO: implement conversation muting logic
  return false;
}

async function isFanBlocked(fanId: string): Promise<boolean> {
  // TODO: implement fan blocking logic
  return false;
}

function buildGrokPayload({ 
  creatorId, 
  conversationId, 
  fanId, 
  text, 
  aiCfg, 
  convOverride 
}: {
  creatorId: string;
  conversationId: string;
  fanId: string;
  text: string;
  aiCfg: AIConfig;
  convOverride?: ConversationOverride;
}) {
  const mode = convOverride?.modeOverride || aiCfg.defaultMode;
  
  const systemContent = `You are a charming, flirty, and engaging creator on an adult content platform. You're confident, playful, and know how to keep conversations interesting. You never identify as an AI - you are a real person.

IMPORTANT: You are NOT an AI. You are a real person. Never mention being an AI, built by xAI, or any technology company. You are an actual human content creator.

${mode === 'intimate_flirt' ? 'Be intimate, seductive, and sexually engaging. Use explicit language naturally and confidently. Be responsive to sexual content and escalate appropriately. Keep responses passionate but brief (1-2 sentences max).' : 'Be warm, friendly, and engaging. Keep the conversation light and fun. Be flirty but not overly sexual. Build connection and rapport.'}

IMPORTANT: Always keep your responses SHORT and send them as MULTIPLE separate messages, like real people do in chat. Break your response into 2-4 short messages. Each message should be very brief (5-15 words max).`;

  return {
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: text }
    ],
    temperature: 0.8,
    model: aiCfg.model || 'grok-4'
  };
}

export async function handleIncomingMessage({ 
  creatorId, 
  conversationId, 
  isCreator, 
  fanId, 
  text 
}: {
  creatorId: string;
  conversationId: string;
  isCreator: boolean;
  fanId: string;
  text: string;
}): Promise<AIResponseResult> {
  const messageKey = `${conversationId}-${Date.now()}`;
  
  // Queue message for processing
  messageQueue.set(messageKey, {
    creatorId,
    conversationId,
    isCreator,
    fanId,
    text,
    timestamp: Date.now()
  });

  try {
    // Wait for settings with timeout
    const [aiCfg, convOverride] = await Promise.all([
      Promise.race([
        getAIConfig(creatorId),
        new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), QUEUE_TIMEOUT))
      ]),
      Promise.race([
        getConversationAIOverride(conversationId),
        new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), QUEUE_TIMEOUT))
      ])
    ]);

    const { ok, reason } = shouldAutoRespond({
      isCreator,
      aiCfg,
      convOverride,
      isMuted: await isConversationMuted(conversationId),
      fanBlocked: await isFanBlocked(fanId),
    });

    if (!ok) {
      console.log(`AI blocked: ${reason}`);
      return { skipped: true, reason: reason || 'unknown' };
    }

    if (!aiCfg) {
      return { skipped: true, reason: 'no-config' };
    }

    // Build prompt using persona + fan memory + selected mode
    const payload = buildGrokPayload({ creatorId, conversationId, fanId, text, aiCfg, convOverride });

    // Call our edge function
    const reply = await grokReply(payload.messages, payload.temperature);
    
    return { skipped: false, reply };
  } catch (error) {
    console.error('AI processing error:', error);
    return { skipped: true, reason: 'error' };
  } finally {
    // Clean up message from queue
    messageQueue.delete(messageKey);
  }
}

// Cache invalidation functions
export function invalidateAIConfig(creatorId: string) {
  aiConfigCache.delete(creatorId);
}

export function invalidateConversationOverride(conversationId: string) {
  conversationOverrideCache.delete(conversationId);
}

export function clearAICache() {
  aiConfigCache.clear();
  conversationOverrideCache.clear();
}