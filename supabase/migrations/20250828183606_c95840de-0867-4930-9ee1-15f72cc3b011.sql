-- Check what fan_my_media actually is (view definition)
SELECT pg_get_viewdef('public.fan_my_media'::regclass) as view_definition;