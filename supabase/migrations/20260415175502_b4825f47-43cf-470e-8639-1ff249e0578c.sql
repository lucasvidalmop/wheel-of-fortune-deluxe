
CREATE TABLE public.imported_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  lead text NOT NULL DEFAULT '',
  numero text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (owner_id, numero)
);

ALTER TABLE public.imported_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own imported_contacts"
ON public.imported_contacts FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own imported_contacts"
ON public.imported_contacts FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own imported_contacts"
ON public.imported_contacts FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can update own imported_contacts"
ON public.imported_contacts FOR UPDATE
TO authenticated
USING (owner_id = auth.uid());
