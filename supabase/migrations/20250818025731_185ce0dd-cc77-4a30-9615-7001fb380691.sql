-- Create a unique constraint to ensure only one owner exists
ALTER TABLE user_roles ADD CONSTRAINT single_owner_constraint 
  EXCLUDE (role WITH =) WHERE (role = 'owner'::app_role);