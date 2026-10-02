-- =====================================================
-- BA Quantum | Memory Write Budget
-- Local-first security migration.
-- =====================================================

-- 1. Keep hourly write reservation counters.

CREATE TABLE public.ba_memory_write_budget (

    bucket_start timestamptz PRIMARY KEY,

    write_calls integer NOT NULL DEFAULT 0
        CHECK (write_calls >= 0),

    reserved_paper_slots integer NOT NULL DEFAULT 0
        CHECK (reserved_paper_slots >= 0),

    updated_at timestamptz NOT NULL DEFAULT now()

);


-- 2. Prevent public access to budget information.

ALTER TABLE public.ba_memory_write_budget
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.ba_memory_write_budget
FROM PUBLIC, anon, authenticated, service_role;


-- 3. Atomically reserve a write budget.

CREATE OR REPLACE FUNCTION public.ba_reserve_memory_write(
    p_paper_count integer
)
RETURNS boolean

LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''

AS $$

DECLARE

    v_bucket timestamptz;

    v_accepted integer;

BEGIN

    -- Each persistence request may attempt 1–24 papers.

    IF p_paper_count IS NULL
       OR p_paper_count < 1
       OR p_paper_count > 24
    THEN
        RETURN false;
    END IF;


    -- The current hourly window.

    v_bucket :=
        pg_catalog.date_trunc(
            'hour',
            pg_catalog.clock_timestamp()
        );


    -- Atomic reservation:
    -- Maximum 60 write calls and 240 paper slots per hour.

    INSERT INTO public.ba_memory_write_budget AS budget (

        bucket_start,
        write_calls,
        reserved_paper_slots,
        updated_at

    )

    VALUES (

        v_bucket,
        1,
        p_paper_count,
        pg_catalog.clock_timestamp()

    )

    ON CONFLICT (bucket_start)

    DO UPDATE SET

        write_calls =
            budget.write_calls + 1,

        reserved_paper_slots =
            budget.reserved_paper_slots
            + EXCLUDED.reserved_paper_slots,

        updated_at =
            pg_catalog.clock_timestamp()

    WHERE

        budget.write_calls < 60

        AND

        budget.reserved_paper_slots
            + EXCLUDED.reserved_paper_slots <= 240

    RETURNING
        write_calls
    INTO
        v_accepted;


    -- If no row was inserted/updated, the budget is exhausted.

    RETURN v_accepted IS NOT NULL;

END;

$$;


-- 4. Restrict execution to the server-side service role.

REVOKE ALL
ON FUNCTION public.ba_reserve_memory_write(integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ba_reserve_memory_write(integer)
TO service_role;