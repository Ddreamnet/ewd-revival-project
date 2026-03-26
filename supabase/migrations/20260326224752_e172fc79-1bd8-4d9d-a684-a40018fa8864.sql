CREATE TRIGGER admin_notification_webhook
AFTER INSERT ON public.admin_notifications
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://hwwpbtcgppzuscbvjkde.supabase.co/functions/v1/admin-notifications-push',
  'POST',
  '{"Content-type":"application/json","x-ewd-webhook-secret":"92e7a01f8133441c9396fc9005b8e3ea417053e8d47a4ab4a123677bee4d171f"}',
  '{}',
  '10000'
);