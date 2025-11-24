-- Transfer all global topics and resources ownership to admin
UPDATE public.global_topics
SET teacher_id = '9f017d05-2118-4ec8-9d36-d1b592115841'
WHERE teacher_id != '9f017d05-2118-4ec8-9d36-d1b592115841';

-- Verify the update
DO $$
DECLARE
  topic_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO topic_count FROM public.global_topics WHERE teacher_id = '9f017d05-2118-4ec8-9d36-d1b592115841';
  RAISE NOTICE 'Total global topics now owned by admin: %', topic_count;
END $$;