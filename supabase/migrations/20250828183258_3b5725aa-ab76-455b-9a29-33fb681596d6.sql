-- First, let's check what ai_jobs_ready actually is
SELECT pg_get_viewdef('public.ai_jobs_ready'::regclass) as view_definition;