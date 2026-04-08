-- Create prize_payments table
CREATE TABLE public.prize_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  wheel_user_id UUID REFERENCES public.wheel_users(id) ON DELETE SET NULL,
  spin_result_id UUID REFERENCES public.spin_results(id) ON DELETE SET NULL,
  account_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  user_email TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  pix_key TEXT DEFAULT '',
  pix_key_type TEXT DEFAULT '',
  edpay_transaction_id TEXT,
  auto_payment BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prize_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own prize_payments"
ON public.prize_payments FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own prize_payments"
ON public.prize_payments FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own prize_payments"
ON public.prize_payments FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own prize_payments"
ON public.prize_payments FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Add auto_payment to wheel_users
ALTER TABLE public.wheel_users ADD COLUMN IF NOT EXISTS auto_payment BOOLEAN NOT NULL DEFAULT false;