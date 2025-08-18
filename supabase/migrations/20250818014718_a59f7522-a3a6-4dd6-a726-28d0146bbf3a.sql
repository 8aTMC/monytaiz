-- Add description field to file_folders table
ALTER TABLE public.file_folders 
ADD COLUMN description TEXT;

-- Add constraint to limit description length
ALTER TABLE public.file_folders 
ADD CONSTRAINT description_length_check CHECK (char_length(description) <= 20);

-- Add constraint to limit name length  
ALTER TABLE public.file_folders 
ADD CONSTRAINT name_length_check CHECK (char_length(name) <= 15);