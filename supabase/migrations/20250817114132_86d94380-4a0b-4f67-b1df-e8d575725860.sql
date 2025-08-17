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