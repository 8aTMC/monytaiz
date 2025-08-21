-- Update AI conversation settings to use Grok-4 as default
ALTER TABLE ai_conversation_settings 
ALTER COLUMN model SET DEFAULT 'grok-4';