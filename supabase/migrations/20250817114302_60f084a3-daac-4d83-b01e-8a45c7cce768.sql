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