CREATE TABLE public.shared_tickets (
  slug text PRIMARY KEY,
  tag text NOT NULL,
  selections jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read shared tickets" ON public.shared_tickets FOR SELECT USING (true);
CREATE POLICY "anyone can create shared tickets" ON public.shared_tickets FOR INSERT WITH CHECK (true);
CREATE INDEX shared_tickets_created_at_idx ON public.shared_tickets (created_at DESC);