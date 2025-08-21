-- Add provider and model columns to ai_conversation_settings table
ALTER TABLE public.ai_conversation_settings 
ADD COLUMN provider text DEFAULT 'openai',
ADD COLUMN model text DEFAULT 'gpt-4o-mini';

-- Add comment for documentation
COMMENT ON COLUMN public.ai_conversation_settings.provider IS 'AI provider to use (openai, xai)';
COMMENT ON COLUMN public.ai_conversation_settings.model IS 'Specific AI model to use for this conversation';