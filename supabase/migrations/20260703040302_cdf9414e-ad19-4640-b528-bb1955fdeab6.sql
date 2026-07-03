
CREATE TABLE public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  action TEXT NOT NULL,
  action_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_count INTEGER NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own automations"
ON public.automations FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_automations
BEFORE UPDATE ON public.automations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_automations_user_enabled ON public.automations(user_id, enabled);
