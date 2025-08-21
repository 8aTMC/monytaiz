import { supabase } from "@/integrations/supabase/client";

export async function grokReply(messages: any[], temperature = 0.7) {
  const { data, error } = await supabase.functions.invoke('grok-chat', {
    body: { messages, temperature },
  });

  if (error) {
    console.error('grok-chat error', { error, data });
    throw new Error(
      data?.error || (typeof data === 'string' ? data : 'AI proxy error')
    );
  }
  return data?.choices?.[0]?.message?.content ?? '';
}