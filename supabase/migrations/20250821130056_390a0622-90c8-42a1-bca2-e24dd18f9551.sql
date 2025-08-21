-- Create the trigger that calls the AI response function
-- Remove the HTTP call part since we can't set database parameters
DROP TRIGGER IF EXISTS messages_ai_trigger ON messages;

CREATE TRIGGER messages_ai_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ai_response();