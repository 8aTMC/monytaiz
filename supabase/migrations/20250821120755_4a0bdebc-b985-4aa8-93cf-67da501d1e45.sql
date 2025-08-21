-- Update AI conversation settings to use xAI defaults
ALTER TABLE ai_conversation_settings 
ALTER COLUMN provider SET DEFAULT 'xai';

ALTER TABLE ai_conversation_settings 
ALTER COLUMN model SET DEFAULT 'grok-2-1212';