-- Add missing columns to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Create global AI settings table
CREATE TABLE IF NOT EXISTS global_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'auto',
  end_time timestamp with time zone,
  hours_remaining integer DEFAULT 0,
  timer_type text DEFAULT 'hours',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create fan lists table
CREATE TABLE IF NOT EXISTS fan_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user message filters table
CREATE TABLE IF NOT EXISTS user_message_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  filter_list_ids text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on new tables
ALTER TABLE global_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fan_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_message_filters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for global_ai_settings
CREATE POLICY "Management can manage global AI settings" ON global_ai_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY(ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
    )
  );

-- Create RLS policies for fan_lists
CREATE POLICY "Management can manage fan lists" ON fan_lists
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY(ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
    )
  );

-- Create RLS policies for user_message_filters
CREATE POLICY "Users can manage their own message filters" ON user_message_filters
  FOR ALL USING (user_id = auth.uid());