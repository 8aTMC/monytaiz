-- Enable realtime for collections table
ALTER TABLE public.collections REPLICA IDENTITY FULL;

-- Add collections table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.collections;