-- =====================================================
-- BA Security Migration
-- Restrict direct execution of signup trigger function
-- =====================================================

REVOKE EXECUTE
ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated, service_role;

-- Allow the Supabase Auth database role

GRANT EXECUTE
ON FUNCTION public.handle_new_user()
TO supabase_auth_admin;
