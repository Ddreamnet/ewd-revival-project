import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

const PUSH_DISMISSED_KEY = 'push_permission_dismissed';

/**
 * Initialize push notifications on native platforms.
 * On web, this is a no-op (in-app notifications suffice).
 */
export async function initPushNotifications(
  userId: string,
  role: 'teacher' | 'student'
): Promise<void> {
  // Only run on native (Android/iOS)
  if (!Capacitor.isNativePlatform()) return;

  try {
    const permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'granted') {
      await registerAndSaveToken(userId, role);
      return;
    }

    if (permStatus.receive === 'denied') {
      console.log('Push notification permission denied by user');
      return;
    }

    // 'prompt' — check if user previously dismissed our custom dialog
    const dismissed = localStorage.getItem(PUSH_DISMISSED_KEY);
    if (dismissed === 'true') return;

    // Request permission (native dialog will appear on Android 13+)
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') {
      await registerAndSaveToken(userId, role);
    } else {
      // User denied — mark so we don't ask again until next install
      localStorage.setItem(PUSH_DISMISSED_KEY, 'true');
    }
  } catch (error) {
    console.error('Push notification init error:', error);
  }
}

/**
 * Register for push and save the token to Supabase.
 */
async function registerAndSaveToken(userId: string, role: string): Promise<void> {
  // Listen for registration success
  await PushNotifications.addListener('registration', async (token) => {
    const platform = Capacitor.getPlatform(); // 'android' | 'ios'
    
    const { error } = await supabase
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
      );

    if (error) {
      console.error('Failed to save push token:', error);
    }
  });

  // Listen for registration errors
  await PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration error:', error);
  });

  // Foreground notification
  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received (foreground):', notification);
    // The notification will show in the system tray automatically on Android
  });

  // User tapped on notification
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('Push action performed:', action);
    // Navigate to relevant page if needed
  });

  // Register with FCM/APNs
  await PushNotifications.register();
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
 * Call this if you want to re-prompt the user.
 */
export function resetPushDismissed(): void {
  localStorage.removeItem(PUSH_DISMISSED_KEY);
}
