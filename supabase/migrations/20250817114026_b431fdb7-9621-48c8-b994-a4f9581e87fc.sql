-- Update the app_role enum to include the new hierarchical roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';

-- Add role hierarchy and level to role system
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS role_level INTEGER DEFAULT 0;

-- Create comprehensive permissions for modular system
INSERT INTO permissions (name, description) VALUES
-- User Management
('manage_all_users', 'Can manage all user accounts'),
('manage_lower_roles', 'Can manage users with lower role levels'),
('view_all_users', 'Can view all user profiles'),
('assign_roles', 'Can assign roles to users'),

-- Financial/Billing
('manage_billing', 'Full billing and payment configuration'),
('manage_payouts', 'Configure and process payouts'),
('view_revenue_analytics', 'View detailed revenue analytics'),
('view_sales_data', 'View sales performance data'),

-- Content Management
('upload_content', 'Upload and manage content'),
('manage_all_content', 'Manage content from all creators'),
('approve_content', 'Approve/reject content uploads'),

-- Fan Management
('manage_fans', 'Full fan account management'),
('view_fan_data', 'View fan profiles and data'),
('view_fan_insights', 'Access fan behavioral insights'),
('manage_subscriptions', 'Manage fan subscriptions'),
('view_fan_notes', 'View and edit fan notes'),

-- Chat Management
('assign_chatters', 'Assign chatters to fans'),
('moderate_chats', 'Moderate chat conversations'),
('view_chat_history', 'Access chat conversation history'),
('chat_with_fans', 'Direct chat access with fans'),
('track_chatter_performance', 'View chatter performance metrics'),

-- Negotiations
('approve_negotiations', 'Approve/reject fan negotiations'),
('manage_negotiations', 'Full negotiation management'),
('create_negotiations', 'Create new negotiations'),

-- Analytics & Reporting
('view_all_analytics', 'Access all platform analytics'),
('view_fan_analytics', 'View fan-specific analytics'),
('view_chatter_analytics', 'View chatter performance analytics'),

-- Security & Settings
('manage_security_settings', 'Configure platform security'),
('manage_platform_settings', 'Configure global platform settings'),
('view_audit_logs', 'Access system audit logs'),

-- Attribution & Sales
('attribute_sales', 'Attribute sales to specific users'),
('view_sales_attribution', 'View sales attribution data')

ON CONFLICT (name) DO NOTHING;

-- Set role hierarchy levels
UPDATE user_roles SET role_level = CASE 
    WHEN role = 'owner' THEN 1
    WHEN role = 'superadmin' THEN 2
    WHEN role = 'admin' THEN 3
    WHEN role = 'manager' THEN 4
    WHEN role = 'chatter' THEN 5
    WHEN role = 'creator' THEN 3  -- Same level as admin
    WHEN role = 'moderator' THEN 4  -- Same level as manager
    WHEN role = 'fan' THEN 6
    ELSE 6
END;

-- Create role-permission mappings
-- Owner: Full access to everything
INSERT INTO role_permissions (role, permission_id)
SELECT 'owner'::app_role, id FROM permissions
ON CONFLICT DO NOTHING;

-- SuperAdmin: Almost everything except billing ownership
INSERT INTO role_permissions (role, permission_id)
SELECT 'superadmin'::app_role, id FROM permissions 
WHERE name NOT IN ('manage_billing')
ON CONFLICT DO NOTHING;

-- Admin: Operational management, no payouts or billing
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM permissions 
WHERE name IN (
    'manage_lower_roles', 'view_all_users', 'assign_roles',
    'view_revenue_analytics', 'view_sales_data',
    'upload_content', 'approve_content',
    'manage_fans', 'view_fan_data', 'view_fan_insights', 'manage_subscriptions', 'view_fan_notes',
    'assign_chatters', 'moderate_chats', 'view_chat_history', 'track_chatter_performance',
    'manage_negotiations', 'view_all_analytics', 'view_fan_analytics', 'view_chatter_analytics',
    'view_audit_logs', 'view_sales_attribution'
)
ON CONFLICT DO NOTHING;

-- Manager: Operations focused, no finances
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager'::app_role, id FROM permissions 
WHERE name IN (
    'manage_lower_roles', 'view_all_users',
    'view_sales_data', 'upload_content',
    'view_fan_data', 'view_fan_insights', 'view_fan_notes',
    'assign_chatters', 'view_chat_history', 'track_chatter_performance',
    'create_negotiations', 'view_fan_analytics', 'view_chatter_analytics',
    'attribute_sales', 'view_sales_attribution'
)
ON CONFLICT DO NOTHING;

-- Chatter: Basic chat and sales functions
INSERT INTO role_permissions (role, permission_id)
SELECT 'chatter'::app_role, id FROM permissions 
WHERE name IN (
    'chat_with_fans', 'view_fan_notes', 'view_chat_history', 'attribute_sales'
)
ON CONFLICT DO NOTHING;

-- Creator: Similar to admin but focused on content
INSERT INTO role_permissions (role, permission_id)
SELECT 'creator'::app_role, id FROM permissions 
WHERE name IN (
    'upload_content', 'manage_all_content',
    'view_fan_data', 'view_fan_insights', 'view_fan_notes',
    'chat_with_fans', 'view_chat_history',
    'create_negotiations', 'view_fan_analytics',
    'attribute_sales', 'view_sales_attribution'
)
ON CONFLICT DO NOTHING;

-- Update RLS policies to support hierarchical permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role = rp.role
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id 
    AND p.name = _permission
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_role(_user_id uuid, _target_role app_role)
RETURNS boolean  
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur1
    WHERE ur1.user_id = _user_id
    AND ur1.role_level < (
      SELECT MIN(role_level) 
      FROM user_roles ur2 
      WHERE ur2.role = _target_role
    )
  ) OR public.user_has_permission(_user_id, 'manage_all_users')
$$;