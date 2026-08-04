-- Add bookmark columns to charts and lyrics
ALTER TABLE public.charts ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.lyrics ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE;
