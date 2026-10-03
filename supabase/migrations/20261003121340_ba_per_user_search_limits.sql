
-- =====================================================
-- BA Quantum | Per-User Search Rate Limiting
-- Local development - not deployed to Cloud
-- =====================================================

-- 1. Store authenticated users' search counters.
-- The existing global rate-limit table remains unchanged.

CREATE TABLE public.ba_user_search_rate_buckets (

    user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    window_type text NOT NULL
        CHECK (window_type IN ('minute', 'hour')),

    bucket_start timestamptz NOT NULL,

    request_count integer NOT NULL DEFAULT 0
        CHECK (request_count >= 0),

    updated_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (
        user_id,
        window_type,
        bucket_start
    )

);

-- 2. Restrict direct access to the counter table.

ALTER TABLE public.ba_user_search_rate_buckets
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.ba_user_search_rate_buckets
FROM PUBLIC, anon, authenticated, service_role;

-- =====================================================
-- 3. Atomic Global + Per-User Reservation
-- =====================================================

CREATE OR REPLACE FUNCTION
public.ba_reserve_search_request_v2(
    p_user_id uuid DEFAULT NULL
)
RETURNS boolean

LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''

AS $$

DECLARE

    v_now timestamptz;

    v_minute timestamptz;
    v_hour timestamptz;

    -- Global counters
    v_global_minute_count integer;
    v_global_hour_count integer;

    -- Authenticated user counters
    v_user_minute_count integer;
    v_user_hour_count integer;

BEGIN

    -- Reuse the existing global reservation lock.
    -- This serializes v1 and v2 reservations.

    PERFORM pg_catalog.pg_advisory_xact_lock(
        482901,
        2
    );

    v_now := pg_catalog.clock_timestamp();

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

    -- Read current global usage.

    SELECT COALESCE(b.request_count, 0)
    INTO v_global_minute_count
    FROM public.ba_search_rate_buckets AS b
    WHERE b.window_type = 'minute'
      AND b.bucket_start = v_minute;

    v_global_minute_count :=
        COALESCE(v_global_minute_count, 0);

    SELECT COALESCE(b.request_count, 0)
    INTO v_global_hour_count
    FROM public.ba_search_rate_buckets AS b
    WHERE b.window_type = 'hour'
      AND b.bucket_start = v_hour;

    v_global_hour_count :=
        COALESCE(v_global_hour_count, 0);


    -- Reject requests that exceed the global limits.

    IF v_global_minute_count >= 12
       OR v_global_hour_count >= 120
    THEN
        RETURN false;
    END IF;


    -- Guests currently use the global limit only.
    -- Authenticated users also receive individual limits.

    IF p_user_id IS NOT NULL THEN

        SELECT COALESCE(b.request_count, 0)
        INTO v_user_minute_count
        FROM public.ba_user_search_rate_buckets AS b
        WHERE b.user_id = p_user_id
          AND b.window_type = 'minute'
          AND b.bucket_start = v_minute;

        v_user_minute_count :=
            COALESCE(v_user_minute_count, 0);

        SELECT COALESCE(b.request_count, 0)
        INTO v_user_hour_count
        FROM public.ba_user_search_rate_buckets AS b
        WHERE b.user_id = p_user_id
          AND b.window_type = 'hour'
          AND b.bucket_start = v_hour;

        v_user_hour_count :=
            COALESCE(v_user_hour_count, 0);

        -- Individual limits:
        -- 4 requests/minute and 30 requests/hour.

        IF v_user_minute_count >= 4
           OR v_user_hour_count >= 30
        THEN
            RETURN false;
        END IF;

    END IF;

    -- ==========================================
    -- Reserve global usage atomically.
    -- All checks have passed at this point.
    -- ==========================================

    INSERT INTO public.ba_search_rate_buckets AS b (
        window_type,
        bucket_start,
        request_count,
        updated_at
    )
    VALUES
        ('minute', v_minute, 1, v_now),
        ('hour', v_hour, 1, v_now)

    ON CONFLICT (window_type, bucket_start)

    DO UPDATE SET
        request_count = b.request_count + 1,
        updated_at = EXCLUDED.updated_at;


    -- Reserve individual usage for authenticated users.

    IF p_user_id IS NOT NULL THEN

        INSERT INTO public.ba_user_search_rate_buckets AS b (
            user_id,
            window_type,
            bucket_start,
            request_count,
            updated_at
        )
        VALUES
            (p_user_id, 'minute', v_minute, 1, v_now),
            (p_user_id, 'hour', v_hour, 1, v_now)

        ON CONFLICT (user_id, window_type, bucket_start)

        DO UPDATE SET
            request_count = b.request_count + 1,
            updated_at = EXCLUDED.updated_at;

    END IF;


    RETURN true;


END;

$$;

-- ==========================================
-- 4. Restrict RPC execution.
-- Only the trusted backend service role
-- may reserve search requests.
-- ==========================================

REVOKE ALL
ON FUNCTION public.ba_reserve_search_request_v2(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ba_reserve_search_request_v2(uuid)
TO service_role;
