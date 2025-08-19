-- Check the current constraint on file_folders table
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'file_folders'::regclass 
AND contype = 'c';

-- Update the description length constraint to allow 30 characters
ALTER TABLE file_folders DROP CONSTRAINT IF EXISTS description_length_check;
ALTER TABLE file_folders ADD CONSTRAINT description_length_check CHECK (description IS NULL OR char_length(description) <= 30);

-- Also update name constraint to allow 24 characters  
ALTER TABLE file_folders DROP CONSTRAINT IF EXISTS name_length_check;
ALTER TABLE file_folders ADD CONSTRAINT name_length_check CHECK (char_length(name) <= 24);