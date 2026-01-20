-- Add cover image to properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Create bucket for property images (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (idempotent)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can view property images'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated can view property images" ON storage.objects FOR SELECT USING (bucket_id = ''property-images'' AND auth.role() = ''authenticated'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff can upload property images'
  ) THEN
    EXECUTE 'CREATE POLICY "Staff can upload property images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''property-images'' AND (is_admin(auth.uid()) OR has_role(auth.uid(), ''broker''::public.user_role) OR has_role(auth.uid(), ''attendant''::public.user_role)))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff can update property images'
  ) THEN
    EXECUTE 'CREATE POLICY "Staff can update property images" ON storage.objects FOR UPDATE USING (bucket_id = ''property-images'' AND (is_admin(auth.uid()) OR has_role(auth.uid(), ''broker''::public.user_role) OR has_role(auth.uid(), ''attendant''::public.user_role))) WITH CHECK (bucket_id = ''property-images'' AND (is_admin(auth.uid()) OR has_role(auth.uid(), ''broker''::public.user_role) OR has_role(auth.uid(), ''attendant''::public.user_role)))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff can delete property images'
  ) THEN
    EXECUTE 'CREATE POLICY "Staff can delete property images" ON storage.objects FOR DELETE USING (bucket_id = ''property-images'' AND (is_admin(auth.uid()) OR has_role(auth.uid(), ''broker''::public.user_role) OR has_role(auth.uid(), ''attendant''::public.user_role)))';
  END IF;
END $do$;

-- Server-side validation to enforce required fields (INSERT/UPDATE)
CREATE OR REPLACE FUNCTION public.validate_property_required_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  _images_len int;
BEGIN
  IF NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  IF NEW.description IS NULL OR btrim(NEW.description) = '' THEN
    RAISE EXCEPTION 'description is required';
  END IF;

  IF NEW.address_city IS NULL OR btrim(NEW.address_city) = '' THEN
    RAISE EXCEPTION 'address_city is required';
  END IF;

  IF NEW.address_neighborhood IS NULL OR btrim(NEW.address_neighborhood) = '' THEN
    RAISE EXCEPTION 'address_neighborhood is required';
  END IF;

  IF NEW.address_state IS NULL OR length(btrim(NEW.address_state)) <> 2 THEN
    RAISE EXCEPTION 'address_state (UF) is required and must be 2 letters';
  END IF;

  IF NEW.address_street IS NULL OR btrim(NEW.address_street) = '' THEN
    RAISE EXCEPTION 'address_street is required';
  END IF;

  IF NEW.address_number IS NULL OR btrim(NEW.address_number) = '' THEN
    RAISE EXCEPTION 'address_number is required';
  END IF;

  IF NEW.address_zipcode IS NULL OR btrim(NEW.address_zipcode) = '' THEN
    RAISE EXCEPTION 'address_zipcode (CEP) is required';
  END IF;

  IF NEW.bedrooms IS NULL OR NEW.bedrooms < 0 THEN
    RAISE EXCEPTION 'bedrooms is required (>= 0)';
  END IF;

  IF NEW.bathrooms IS NULL OR NEW.bathrooms < 0 THEN
    RAISE EXCEPTION 'bathrooms is required (>= 0)';
  END IF;

  IF NEW.area_total IS NULL OR NEW.area_total <= 0 THEN
    RAISE EXCEPTION 'area_total is required (> 0)';
  END IF;

  IF NEW.rent_price IS NULL OR NEW.rent_price <= 0 THEN
    RAISE EXCEPTION 'rent_price is required (> 0)';
  END IF;

  IF NEW.sale_price IS NULL OR NEW.sale_price <= 0 THEN
    RAISE EXCEPTION 'sale_price is required (> 0)';
  END IF;

  IF NEW.cover_image_url IS NULL OR btrim(NEW.cover_image_url) = '' THEN
    RAISE EXCEPTION 'cover_image_url is required';
  END IF;

  IF NEW.images IS NULL OR jsonb_typeof(NEW.images) <> 'array' THEN
    RAISE EXCEPTION 'images must be a JSON array';
  END IF;

  _images_len := jsonb_array_length(NEW.images);
  IF _images_len IS NULL OR _images_len = 0 THEN
    RAISE EXCEPTION 'at least one image is required';
  END IF;

  RETURN NEW;
END;
$$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_validate_properties_required_fields'
  ) THEN
    CREATE TRIGGER trg_validate_properties_required_fields
    BEFORE INSERT OR UPDATE ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_property_required_fields();
  END IF;
END $do$;