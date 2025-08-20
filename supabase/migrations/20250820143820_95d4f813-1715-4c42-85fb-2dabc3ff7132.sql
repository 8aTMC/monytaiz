-- Enable real-time for messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add messages table to realtime publication  
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Also enable real-time for conversations table to update conversation list
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;