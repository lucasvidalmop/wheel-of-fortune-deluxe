ALTER TABLE public.wheel_users ADD COLUMN blacklisted boolean NOT NULL DEFAULT false;
ALTER TABLE public.wheel_users ADD COLUMN guaranteed_next_win boolean NOT NULL DEFAULT false;