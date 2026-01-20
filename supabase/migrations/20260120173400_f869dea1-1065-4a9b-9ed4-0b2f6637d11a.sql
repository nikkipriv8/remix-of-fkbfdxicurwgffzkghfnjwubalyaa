-- Make property-images bucket public so photos can be viewed via stable URLs
UPDATE storage.buckets
SET public = true
WHERE id = 'property-images';

-- Replace authenticated-only read policy with public read policy (idempotent)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can view property images'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated can view property images" ON storage.objects';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view property images'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can view property images" ON storage.objects FOR SELECT USING (bucket_id = ''property-images'')';
  END IF;
END $do$;