-- Create file_folder_contents table to properly track which media items are in which folders
CREATE TABLE public.file_folder_contents (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    folder_id uuid NOT NULL REFERENCES public.file_folders(id) ON DELETE CASCADE,
    media_id uuid NOT NULL REFERENCES public.simple_media(id) ON DELETE CASCADE,
    added_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(folder_id, media_id)
);

-- Enable Row Level Security
ALTER TABLE public.file_folder_contents ENABLE ROW LEVEL SECURITY;

-- Create policies for file_folder_contents
CREATE POLICY "Users can view folder contents they have access to" 
ON public.file_folder_contents 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.file_folders f 
        WHERE f.id = folder_id 
        AND f.creator_id = auth.uid()
    )
);

CREATE POLICY "Users can add content to their folders" 
ON public.file_folder_contents 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.file_folders f 
        WHERE f.id = folder_id 
        AND f.creator_id = auth.uid()
    )
    AND auth.uid() = added_by
);

CREATE POLICY "Users can remove content from their folders" 
ON public.file_folder_contents 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.file_folders f 
        WHERE f.id = folder_id 
        AND f.creator_id = auth.uid()
    )
);

-- Create index for better performance
CREATE INDEX idx_file_folder_contents_folder_id ON public.file_folder_contents(folder_id);
CREATE INDEX idx_file_folder_contents_media_id ON public.file_folder_contents(media_id);