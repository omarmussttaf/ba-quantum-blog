-- BA Security Migration
-- Restrict direct access to Semantic Search RPC

REVOKE EXECUTE
ON FUNCTION public.match_ba_papers(
    extensions.vector,
    integer,
    double precision
)
FROM PUBLIC, anon, authenticated;


-- Only the authorized backend may execute the RPC

GRANT EXECUTE
ON FUNCTION public.match_ba_papers(
    extensions.vector,
    integer,
    double precision
)
TO service_role;