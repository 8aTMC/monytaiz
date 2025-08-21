-- Create the trigger that calls the AI response function
CREATE TRIGGER messages_ai_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ai_response();

-- Set up database settings needed for the HTTP calls
-- These settings allow the trigger to call edge functions
ALTER DATABASE postgres SET app.supabase_url = '';
ALTER DATABASE postgres SET app.supabase_anon_key = '';