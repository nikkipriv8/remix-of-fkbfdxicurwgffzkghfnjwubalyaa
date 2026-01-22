-- Store per-user UI preferences (e.g. WhatsApp layout)
CREATE TABLE IF NOT EXISTS public.user_ui_preferences (
  user_id uuid NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.user_ui_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own ui preferences"
ON public.user_ui_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own preferences
CREATE POLICY "Users can insert own ui preferences"
ON public.user_ui_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own ui preferences"
ON public.user_ui_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own ui preferences"
ON public.user_ui_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Keep updated_at fresh
CREATE TRIGGER update_user_ui_preferences_updated_at
BEFORE UPDATE ON public.user_ui_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_ui_preferences_updated_at
  ON public.user_ui_preferences (user_id, updated_at DESC);
