
CREATE TABLE IF NOT EXISTS public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users create own reports"
ON public.post_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "admins read reports"
ON public.post_reports FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete reports"
ON public.post_reports FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_post_reports_post ON public.post_reports(post_id);
