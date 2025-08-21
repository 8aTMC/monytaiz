-- Function to cleanup stale typing indicators (older than 30 seconds)
CREATE OR REPLACE FUNCTION cleanup_stale_typing_indicators()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete typing indicators older than 30 seconds
  DELETE FROM typing_indicators 
  WHERE updated_at < NOW() - INTERVAL '30 seconds';
  
  -- Also delete any indicators that are not typing anymore
  DELETE FROM typing_indicators 
  WHERE is_typing = false;
END;
$$;

-- Function to cleanup typing status for a specific user
CREATE OR REPLACE FUNCTION cleanup_user_typing_status(p_user_id UUID, p_conversation_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete or update the typing indicator for this user
  DELETE FROM typing_indicators 
  WHERE user_id = p_user_id 
  AND conversation_id = p_conversation_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_stale_typing_indicators() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_user_typing_status(UUID, TEXT) TO authenticated;