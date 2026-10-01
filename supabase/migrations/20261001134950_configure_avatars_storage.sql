-- =====================================================
-- BA Database Migration
-- Configure researcher avatars storage
-- =====================================================

-- 1. Create or configure the avatars bucket

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp'
    ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. Create ownership-based storage policies

DO $$
BEGIN

    -- INSERT: Upload own avatar

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Users can upload own avatars'
    ) THEN

        CREATE POLICY "Users can upload own avatars"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'avatars'
            AND (storage.foldername(name))[1] = auth.uid()::text
        );

    END IF;


    -- UPDATE: Update own avatar

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Users can update own avatars'
    ) THEN

        CREATE POLICY "Users can update own avatars"
        ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (
            bucket_id = 'avatars'
            AND (storage.foldername(name))[1] = auth.uid()::text
        )
        WITH CHECK (
            bucket_id = 'avatars'
            AND (storage.foldername(name))[1] = auth.uid()::text
        );

    END IF;


    -- DELETE: Delete own avatar

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Users can delete own avatars'
    ) THEN

        CREATE POLICY "Users can delete own avatars"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'avatars'
            AND (storage.foldername(name))[1] = auth.uid()::text
        );

    END IF;

END;
$$;