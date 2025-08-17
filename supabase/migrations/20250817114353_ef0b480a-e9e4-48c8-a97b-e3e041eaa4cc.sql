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