
CREATE TABLE public.edpay_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  edpay_id text,
  type text NOT NULL DEFAULT 'unknown',
  amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edpay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.edpay_transactions
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own transactions" ON public.edpay_transactions
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_edpay_transactions_edpay_id ON public.edpay_transactions(edpay_id);
CREATE INDEX idx_edpay_transactions_owner_id ON public.edpay_transactions(owner_id);
