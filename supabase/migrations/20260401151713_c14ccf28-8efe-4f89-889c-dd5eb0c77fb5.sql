ALTER TABLE public.wheel_users
ADD COLUMN fixed_prize_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN fixed_prize_segment integer;