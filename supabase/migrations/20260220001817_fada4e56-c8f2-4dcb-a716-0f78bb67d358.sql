ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS push_processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_push_unprocessed
  ON public.admin_notifications (id)
  WHERE push_sent_at IS NULL AND push_processing_at IS NULL;