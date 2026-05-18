-- Add podcast_episodes to the realtime publication.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.podcast_episodes;
EXCEPTION WHEN others THEN NULL;
END $$;
