
CREATE TABLE public.sla_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL,
  predicted_eta_hours INTEGER,
  predicted_risk TEXT,
  reason TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('up','down')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_feedback TO authenticated;
GRANT ALL ON public.sla_feedback TO service_role;
ALTER TABLE public.sla_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own SLA feedback" ON public.sla_feedback
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sla_feedback_ticket_idx ON public.sla_feedback(ticket_id);
CREATE INDEX sla_feedback_user_created_idx ON public.sla_feedback(user_id, created_at DESC);
