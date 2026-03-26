import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';

const PUSH_DISMISSED_KEY = 'push_permission_dismissed';

/**
 * Create Android notification channels with custom sounds.
 * Must be called before any push arrives so the OS registers them.
 */
async function createAndroidChannels(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  const channels = [
    { id: 'lesson', name: 'Ders Hatırlatma', description: 'Derse 10 dk kala bildirim', importance: 5 as const, sound: 'lesson' },
    { id: 'homework', name: 'Ödev Bildirimi', description: 'Ödev yüklendiğinde bildirim', importance: 5 as const, sound: 'homework' },
    { id: 'last_lesson', name: 'Son Ders Uyarısı', description: 'Admin son ders uyarısı', importance: 5 as const, sound: 'last_lesson' },
  ];

  console.log('[PUSH] Creating Android notification channels...');
  for (const ch of channels) {
    try {
      await LocalNotifications.createChannel(ch);
      console.log(`[PUSH] Channel created: ${ch.id}, sound: ${ch.sound}`);
    } catch (err) {
      console.warn(`[PUSH] Failed to create channel ${ch.id}:`, err);
    }
  }
}

/**
 * Initialize push notifications on native platforms.
 * On web, this is a no-op (in-app notifications suffice).
 */
export async function initPushNotifications(
  userId: string,
  role: 'teacher' | 'student' | 'admin'
): Promise<void> {
  console.log('[PUSH-DIAG] initPushNotifications called, userId:', userId, 'role:', role);
  console.log('[PUSH-DIAG] isNativePlatform:', Capacitor.isNativePlatform(), 'platform:', Capacitor.getPlatform());

  // Only run on native (Android/iOS)
  if (!Capacitor.isNativePlatform()) {
    console.log('[PUSH-DIAG] Not native platform, returning early');
    return;
  }

  // Create Android notification channels before anything else
  await createAndroidChannels();

  try {
    const permStatus = await PushNotifications.checkPermissions();
    console.log('[PUSH-DIAG] checkPermissions result:', permStatus.receive);

    if (permStatus.receive === 'granted') {
      console.log('[PUSH-DIAG] Already granted, registering token...');
      await registerAndSaveToken(userId, role);
      return;
    }

    if (permStatus.receive === 'denied') {
      console.log('[PUSH-DIAG] Permission denied by user');
      return;
    }

    // 'prompt' — check if user previously dismissed our custom dialog
    const dismissed = localStorage.getItem(PUSH_DISMISSED_KEY);
    if (dismissed === 'true') {
      console.log('[PUSH-DIAG] Previously dismissed, skipping');
      return;
    }

    // Request permission (native dialog will appear on Android 13+)
    const result = await PushNotifications.requestPermissions();
    console.log('[PUSH-DIAG] requestPermissions result:', result.receive);

    if (result.receive === 'granted') {
      await registerAndSaveToken(userId, role);
    } else {
      // User denied — mark so we don't ask again until next install
      localStorage.setItem(PUSH_DISMISSED_KEY, 'true');
      console.log('[PUSH-DIAG] User denied permission, marked dismissed');
    }
  } catch (error) {
    console.error('[PUSH-DIAG] Push notification init error:', error);
  }
}

/**
 * Register for push and save the token to Supabase.
 */
async function registerAndSaveToken(userId: string, role: string): Promise<void> {
  console.log('[PUSH-DIAG] registerAndSaveToken entered, userId:', userId, 'role:', role);

  // Remove any existing listeners to prevent accumulation on re-mounts
  await PushNotifications.removeAllListeners();

  // Listen for registration success
  await PushNotifications.addListener('registration', async (token) => {
    console.log('[PUSH-DIAG] >>> registration event FIRED, token:', token.value?.substring(0, 20) + '...');

    const platform = Capacitor.getPlatform(); // 'android' | 'ios'

    // Diagnostic: check current session
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData?.session?.user?.id;
    console.log('[PUSH-DIAG] current session user_id:', sessionUserId, 'matches userId param:', sessionUserId === userId);

    if (!sessionUserId) {
      console.error('[PUSH-DIAG] NO SESSION — token cannot be saved. Retrying in 2s...');
      // Retry once after 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      const { data: retrySession } = await supabase.auth.getSession();
      const retryUserId = retrySession?.session?.user?.id;
      console.log('[PUSH-DIAG] retry session user_id:', retryUserId);
      if (!retryUserId) {
        console.error('[PUSH-DIAG] Still no session after retry, aborting token save');
        return;
      }
    }

    // Diagnostic: check if token already exists with different owner
    const { data: existingToken } = await supabase
      .from('push_tokens')
      .select('user_id, role')
      .eq('token', token.value)
      .maybeSingle();
    console.log('[PUSH-DIAG] existing token owner:', existingToken);

    // If token belongs to a different user, delete it first then insert
    if (existingToken && existingToken.user_id !== userId) {
      console.log('[PUSH-DIAG] Token owned by different user, deleting old record first');
      const { error: deleteOldError } = await supabase
        .from('push_tokens')
        .delete()
        .eq('token', token.value);
      console.log('[PUSH-DIAG] delete old token result - error:', deleteOldError);
    }

    // Clean up stale tokens from previous installs / builds
    const { error: deleteError } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .neq('token', token.value);

    if (deleteError) {
      console.warn('[PUSH-DIAG] Failed to cleanup stale tokens:', deleteError);
    }

    const { data: upsertData, error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          token: token.value,
          user_id: userId,
          role,
          platform,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      )
      .select();

    console.log('[PUSH-DIAG] upsert result - data:', upsertData, 'error:', error);

    if (error) {
      console.error('[PUSH-DIAG] Failed to save push token:', error);
    } else {
      console.log(`[PUSH-DIAG] Token registered successfully for ${role}`);
    }
  });

  // Listen for registration errors
  await PushNotifications.addListener('registrationError', (error) => {
    console.error('[PUSH-DIAG] >>> registrationError:', error);
  });

  // Foreground notification
  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[PUSH] Push received (foreground):', notification);
  });

  // User tapped on notification — navigate via deep link
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[PUSH] Push action performed:', action);
    const data = action.notification.data ?? {};
    const deepLink: string = data.deep_link ?? '/dashboard';
    if (deepLink && deepLink.startsWith('/')) {
      window.history.pushState({}, '', deepLink);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });

  console.log('[PUSH-DIAG] All listeners added, calling register()...');

  // Register with FCM/APNs
  await PushNotifications.register();

  console.log('[PUSH-DIAG] PushNotifications.register() completed');
}

/**
 * Disable push tokens on logout.
 */
export async function disablePushTokens(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await supabase
      .from('push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } catch (error) {
    console.error('Failed to disable push tokens:', error);
  }
}

/**
 * Reset the "dismissed" flag so the prompt shows again.
 */
export function resetPushDismissed(): void {
  localStorage.removeItem(PUSH_DISMISSED_KEY);
}
