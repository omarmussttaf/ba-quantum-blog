-- BA Quantum | Atomic Embedding Claim
-- Local migration: do not apply directly in Cloud Dashboard.

-- 1. Lease information for each paper.
ALTER TABLE public.ba_papers
    ADD COLUMN embedding_claim_token uuid,
    ADD COLUMN embedding_claimed_until timestamptz;

-- 2. Speed up selection of papers awaiting embeddings.
CREATE INDEX ba_papers_embedding_claim_idx
ON public.ba_papers (id)
WHERE embedding IS NULL
  AND embedding_content IS NOT NULL;


-- 3. Atomically reserve one paper.
CREATE OR REPLACE FUNCTION public.ba_claim_next_embedding()
RETURNS TABLE (
    paper_id bigint,
    paper_title text,
    paper_content text,
    lease_token uuid,
    lease_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN

    -- Serialize claim attempts, not the embedding computation.
    PERFORM pg_catalog.pg_advisory_xact_lock(482901, 1);

    -- Global limit: only ONE active embedding worker.
    IF EXISTS (
        SELECT 1
        FROM public.ba_papers AS p
        WHERE p.embedding IS NULL
          AND p.embedding_claim_token IS NOT NULL
          AND p.embedding_claimed_until >
              pg_catalog.clock_timestamp()
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY

    WITH candidate AS MATERIALIZED (
        SELECT p.id
        FROM public.ba_papers AS p
        WHERE p.embedding IS NULL
          AND p.embedding_model IS DISTINCT FROM 'skipped-empty'
          AND p.embedding_content IS NOT NULL
          AND NULLIF(
              pg_catalog.btrim(
                  p.embedding_content,
                  E' \t\n\r'
              ),
              ''
          ) IS NOT NULL
          AND (
              p.embedding_claimed_until IS NULL
              OR p.embedding_claimed_until <=
                  pg_catalog.clock_timestamp()
          )
        ORDER BY p.id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )

    UPDATE public.ba_papers AS p
    SET
        embedding_claim_token =
            pg_catalog.gen_random_uuid(),

        embedding_claimed_until =
            pg_catalog.clock_timestamp()
            + INTERVAL '15 minutes',

        updated_at =
            pg_catalog.clock_timestamp()

    FROM candidate AS c
    WHERE p.id = c.id

    RETURNING
        p.id,
        p.title,
        p.embedding_content,
        p.embedding_claim_token,
        p.embedding_claimed_until;

END;
$$;


-- 4. Save a completed embedding only if the lease is valid.
CREATE OR REPLACE FUNCTION public.ba_complete_embedding(
    p_paper_id bigint,
    p_lease_token uuid,
    p_embedding jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    updated_count integer;
BEGIN

    IF p_embedding IS NULL
       OR pg_catalog.jsonb_typeof(p_embedding) <> 'array'
    THEN
        RAISE EXCEPTION 'Embedding must be a JSON array';
    END IF;

    IF pg_catalog.jsonb_array_length(p_embedding) <> 384
    THEN
        RAISE EXCEPTION 'Embedding must contain 384 dimensions';
    END IF;

    UPDATE public.ba_papers AS p
    SET
        embedding =
            p_embedding::text::extensions.vector,

        embedding_model = 'gte-small',

        embedding_updated_at =
            pg_catalog.clock_timestamp(),

        embedding_claim_token = NULL,
        embedding_claimed_until = NULL,

        updated_at =
            pg_catalog.clock_timestamp()

    WHERE p.id = p_paper_id
      AND p.embedding IS NULL
      AND p.embedding_claim_token = p_lease_token
      AND p.embedding_claimed_until >
          pg_catalog.clock_timestamp();

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RETURN updated_count = 1;

END;
$$;


-- 5. Release a reservation if processing fails.
CREATE OR REPLACE FUNCTION public.ba_release_embedding_claim(
    p_paper_id bigint,
    p_lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    updated_count integer;
BEGIN

    UPDATE public.ba_papers AS p
    SET
        embedding_claim_token = NULL,
        embedding_claimed_until = NULL,
        updated_at = pg_catalog.clock_timestamp()

    WHERE p.id = p_paper_id
      AND p.embedding IS NULL
      AND p.embedding_claim_token = p_lease_token;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RETURN updated_count = 1;

END;
$$;


-- 6. Restrict all worker RPCs to the service role.
REVOKE ALL ON FUNCTION
    public.ba_claim_next_embedding()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
    public.ba_complete_embedding(bigint, uuid, jsonb)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
    public.ba_release_embedding_claim(bigint, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.ba_claim_next_embedding()
TO service_role;

GRANT EXECUTE ON FUNCTION
    public.ba_complete_embedding(bigint, uuid, jsonb)
TO service_role;

GRANT EXECUTE ON FUNCTION
    public.ba_release_embedding_claim(bigint, uuid)
TO service_role;