-- Add username field to collaborators table
ALTER TABLE collaborators 
ADD COLUMN username text;

-- Add unique constraint for usernames (excluding nulls)
CREATE UNIQUE INDEX idx_collaborators_username_unique 
ON collaborators (username) 
WHERE username IS NOT NULL;