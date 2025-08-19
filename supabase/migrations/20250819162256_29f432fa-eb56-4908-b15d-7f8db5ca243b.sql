-- Update the database constraints to allow longer folder names and descriptions
ALTER TABLE file_folders DROP CONSTRAINT IF EXISTS name_length_check;
ALTER TABLE file_folders ADD CONSTRAINT name_length_check CHECK (char_length(name) <= 30);

ALTER TABLE file_folders DROP CONSTRAINT IF EXISTS description_length_check;
ALTER TABLE file_folders ADD CONSTRAINT description_length_check CHECK (description IS NULL OR char_length(description) <= 40);