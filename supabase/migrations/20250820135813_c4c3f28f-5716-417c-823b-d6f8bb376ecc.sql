-- Update RLS policies to handle status filtering for conversations and messages (corrected version)

-- Update conversations RLS policies to filter by status
DROP POLICY IF EXISTS "Users can view conversations they're part of" ON conversations;
CREATE POLICY "Users can view conversations they're part of" 
ON conversations 
FOR SELECT 
USING (
  status = 'active' AND (
    (auth.uid() = fan_id) OR 
    (auth.uid() = creator_id) OR 
    (EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['admin'::app_role, 'owner'::app_role])
    ))
  )
);

-- Update messages RLS policies to filter by status
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" 
ON messages 
FOR SELECT 
USING (
  status = 'active' AND (
    (EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND c.status = 'active'
      AND ((c.fan_id = auth.uid()) OR (c.creator_id = auth.uid()))
    )) OR 
    (EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['admin'::app_role, 'owner'::app_role])
    ))
  )
);

-- Update messages insert policy to ensure status is set correctly
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON messages;
CREATE POLICY "Users can create messages in their conversations" 
ON messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND 
  status = 'active' AND
  (EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = messages.conversation_id 
    AND c.status = 'active'
    AND ((c.fan_id = auth.uid()) OR (c.creator_id = auth.uid()))
  ))
);

-- Create policy for conversations insert with status check
DROP POLICY IF EXISTS "Fans can create conversations with creators" ON conversations;
CREATE POLICY "Fans can create conversations with creators" 
ON conversations 
FOR INSERT 
WITH CHECK (
  auth.uid() = fan_id AND 
  status = 'active' AND
  (EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = conversations.creator_id 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'creator'::app_role, 'superadmin'::app_role, 'admin'::app_role])
  ))
);