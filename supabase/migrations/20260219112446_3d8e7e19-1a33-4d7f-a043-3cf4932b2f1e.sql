
-- Add idempotency columns to notifications table for push delivery tracking
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- Partial index for fast webhook claim queries (only unprocessed rows)
CREATE INDEX IF NOT EXISTS idx_notifications_push_unprocessed
  ON public.notifications (id)
  WHERE push_sent_at IS NULL AND push_processing_at IS NULL;
