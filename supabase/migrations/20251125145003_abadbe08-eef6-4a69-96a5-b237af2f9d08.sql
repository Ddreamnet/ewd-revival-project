-- Enable realtime for trial_lessons table
ALTER TABLE public.trial_lessons REPLICA IDENTITY FULL;

-- Add trial_lessons to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.trial_lessons;