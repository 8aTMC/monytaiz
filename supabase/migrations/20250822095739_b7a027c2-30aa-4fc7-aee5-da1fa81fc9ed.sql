-- Check and create proper storage policies for the content bucket

-- First, ensure the content bucket exists and is private
INSERT INTO storage.buckets (id, name, public) 
VALUES ('content', 'content', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- Delete any conflicting policies first
DROP POLICY IF EXISTS "Authenticated users can upload content" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own content" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own content" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own content" ON storage.objects;

-- Create comprehensive storage policies for the content bucket
CREATE POLICY "Authenticated users can upload content" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'content' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own content" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'content' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own content" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'content' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own content" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'content' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Also allow admins to access all content
CREATE POLICY "Admins can manage all content in storage" 
ON storage.objects 
FOR ALL 
TO authenticated
USING (
  bucket_id = 'content' AND 
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'owner')
  )
)
WITH CHECK (
  bucket_id = 'content' AND 
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'owner')
  )
);