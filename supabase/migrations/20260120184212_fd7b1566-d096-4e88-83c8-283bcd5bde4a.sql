-- Add pending visit state columns to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS pending_visit_id uuid NULL,
  ADD COLUMN IF NOT EXISTS pending_visit_property_id uuid NULL,
  ADD COLUMN IF NOT EXISTS pending_visit_scheduled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pending_visit_step text NULL,
  ADD COLUMN IF NOT EXISTS pending_visit_candidates jsonb NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_pending_visit_id
  ON public.whatsapp_conversations (pending_visit_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_pending_visit_step
  ON public.whatsapp_conversations (pending_visit_step);

-- Basic guardrails: constrain pending_visit_step to known values (using a trigger to avoid CHECK immutability pitfalls)
CREATE OR REPLACE FUNCTION public.validate_pending_visit_step()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _step text;
BEGIN
  _step := NEW.pending_visit_step;
  IF _step IS NULL THEN
    RETURN NEW;
  END IF;

  IF _step NOT IN ('awaiting_property','awaiting_datetime','awaiting_confirmation','awaiting_candidate_choice') THEN
    RAISE EXCEPTION 'invalid pending_visit_step: %', _step;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pending_visit_step ON public.whatsapp_conversations;
CREATE TRIGGER trg_validate_pending_visit_step
BEFORE INSERT OR UPDATE ON public.whatsapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.validate_pending_visit_step();
