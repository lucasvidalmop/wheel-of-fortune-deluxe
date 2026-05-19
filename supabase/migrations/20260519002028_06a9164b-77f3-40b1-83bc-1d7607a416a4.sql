-- Add unique public code to bet_wagers for ticket validation
ALTER TABLE public.bet_wagers
  ADD COLUMN IF NOT EXISTS public_code text;

CREATE OR REPLACE FUNCTION public.gen_bet_wager_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous 0/O/1/I
  code text;
  i int;
  exists_count int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM public.bet_wagers WHERE public_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_bet_wager_public_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_code IS NULL OR NEW.public_code = '' THEN
    NEW.public_code := public.gen_bet_wager_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bet_wagers_public_code ON public.bet_wagers;
CREATE TRIGGER trg_bet_wagers_public_code
BEFORE INSERT ON public.bet_wagers
FOR EACH ROW
EXECUTE FUNCTION public.set_bet_wager_public_code();

-- Backfill existing rows
UPDATE public.bet_wagers
SET public_code = public.gen_bet_wager_code()
WHERE public_code IS NULL OR public_code = '';

ALTER TABLE public.bet_wagers
  ALTER COLUMN public_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bet_wagers_public_code ON public.bet_wagers(public_code);
