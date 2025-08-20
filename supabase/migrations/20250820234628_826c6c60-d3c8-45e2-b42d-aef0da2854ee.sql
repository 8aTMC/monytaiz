-- Create enum for AI conversation modes
CREATE TYPE ai_conversation_mode AS ENUM (
  'friendly_chat',
  'supportive_nudges', 
  'comeback_mode',
  'intimate_flirt',
  'autopilot'
);

-- Create table for global model persona memory
CREATE TABLE public.model_persona (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  persona_name TEXT NOT NULL,
  persona_description TEXT NOT NULL,
  personality_traits TEXT[],
  tone_of_voice TEXT,
  hobbies TEXT[],
  life_events TEXT[],
  background_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for per-fan memory
CREATE TABLE public.fan_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fan_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for AI conversation settings
CREATE TABLE public.ai_conversation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL UNIQUE,
  is_ai_enabled BOOLEAN NOT NULL DEFAULT false,
  current_mode ai_conversation_mode NOT NULL DEFAULT 'friendly_chat',
  auto_response_enabled BOOLEAN NOT NULL DEFAULT false,
  typing_simulation_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.model_persona ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for model_persona
CREATE POLICY "Management can manage model persona" 
ON public.model_persona 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager')
  )
);

-- RLS policies for fan_memories  
CREATE POLICY "Management can manage fan memories"
ON public.fan_memories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  )
);

-- RLS policies for ai_conversation_settings
CREATE POLICY "Management can manage AI settings"
ON public.ai_conversation_settings
FOR ALL  
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_model_persona_updated_at
BEFORE UPDATE ON public.model_persona
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fan_memories_updated_at  
BEFORE UPDATE ON public.fan_memories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_conversation_settings_updated_at
BEFORE UPDATE ON public.ai_conversation_settings
FOR EACH ROW  
EXECUTE FUNCTION public.update_updated_at_column();

-- Create foreign key constraints
ALTER TABLE public.fan_memories 
ADD CONSTRAINT fan_memories_fan_id_fkey 
FOREIGN KEY (fan_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public.fan_memories
ADD CONSTRAINT fan_memories_creator_id_fkey  
FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public.fan_memories
ADD CONSTRAINT fan_memories_created_by_fkey
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ai_conversation_settings
ADD CONSTRAINT ai_conversation_settings_conversation_id_fkey
FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;