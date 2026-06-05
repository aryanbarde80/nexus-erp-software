ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS entity_id uuid;
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log(entity_type, entity_id, created_at DESC);