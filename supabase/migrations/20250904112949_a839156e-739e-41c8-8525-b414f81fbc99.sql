-- Create INSERT policy for avatars bucket allowing management to upload collaborator avatars
CREATE POLICY "Management can upload collaborator avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'collaborators'
    AND EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
    )
  );