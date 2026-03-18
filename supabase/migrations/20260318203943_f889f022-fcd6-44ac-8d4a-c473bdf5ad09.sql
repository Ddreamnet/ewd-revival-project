-- Step 1: Add 'data_repair' to balance_events event_type CHECK constraint
ALTER TABLE balance_events DROP CONSTRAINT balance_events_event_type_check;
ALTER TABLE balance_events ADD CONSTRAINT balance_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'lesson_complete', 'lesson_undo',
    'trial_complete', 'trial_undo',
    'manual_adjust', 'balance_reset',
    'data_repair'
  ]));
