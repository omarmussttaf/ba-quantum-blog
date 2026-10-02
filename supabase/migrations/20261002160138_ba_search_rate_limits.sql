-- =====================================================
-- BA Quantum | Search Rate Limiting
-- Local-first security migration.
--
-- Initial limits:
-- 12 research requests / minute
-- 120 research requests / hour
-- =====================================================


-- 1. Store global search counters.

CREATE TABLE public.ba_search_rate_buckets (

    window_type text NOT NULL
        CHECK (window_type IN ('minute', 'hour')),

    bucket_start timestamptz NOT NULL,

    request_count integer NOT NULL DEFAULT 0
        CHECK (request_count >= 0),

    updated_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (window_type, bucket_start)

);


-- 2. Restrict direct table access.

ALTER TABLE public.ba_search_rate_buckets
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.ba_search_rate_buckets
FROM PUBLIC, anon, authenticated, service_role;


-- 3. Atomically reserve one research request.

CREATE OR REPLACE FUNCTION public.ba_reserve_search_request()
RETURNS boolean

LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''

AS $$

DECLARE

    v_now timestamptz;

    v_minute timestamptz;
    v_hour timestamptz;

    v_minute_count integer;
    v_hour_count integer;

BEGIN

    -- Serialize concurrent reservation attempts.
    -- This lock is released automatically at transaction end.

    PERFORM pg_catalog.pg_advisory_xact_lock(
        482901,
        2
    );

    -- Calculate time after acquiring the lock.

    v_now := pg_catalog.clock_timestamp();

    -- Use consistent UTC bucket boundaries.

    v_minute :=
        pg_catalog.date_trunc(
            'minute',
            v_now AT TIME ZONE 'UTC'
        ) AT TIME ZONE 'UTC';

    v_hour :=
        pg_catalog.date_trunc(
            'hour',
            v_now AT TIME ZONE 'UTC'
        ) AT TIME ZONE 'UTC';


    -- Read the current minute usage.

    SELECT COALESCE(b.request_count, 0)
    INTO v_minute_count

    FROM public.ba_search_rate_buckets AS b

    WHERE b.window_type = 'minute'
      AND b.bucket_start = v_minute;

    v_minute_count := COALESCE(v_minute_count, 0);


    -- Read the current hour usage.

    SELECT COALESCE(b.request_count, 0)
    INTO v_hour_count

    FROM public.ba_search_rate_buckets AS b

    WHERE b.window_type = 'hour'
      AND b.bucket_start = v_hour;

    v_hour_count := COALESCE(v_hour_count, 0);


    -- Reject without modifying either counter.

    IF v_minute_count >= 12
       OR v_hour_count >= 120
    THEN

        RETURN false;

    END IF;


    -- Both counters are incremented atomically.

    INSERT INTO public.ba_search_rate_buckets AS b (

        window_type,
        bucket_start,
        request_count,
        updated_at

    )

    VALUES

    (
        'minute',
        v_minute,
        1,
        v_now
    ),

    (
        'hour',
        v_hour,
        1,
        v_now
    )

    ON CONFLICT (window_type, bucket_start)

    DO UPDATE SET

        request_count =
            b.request_count + 1,

        updated_at =
            EXCLUDED.updated_at;


    RETURN true;

END;

$$;


-- 4. Allow only the server-side service role
-- to execute the reservation function.

REVOKE ALL
ON FUNCTION public.ba_reserve_search_request()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ba_reserve_search_request()
TO service_role;