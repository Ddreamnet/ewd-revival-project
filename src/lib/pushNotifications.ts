import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';

/** Bu cihazın FCM token'ı — çıkışta yalnızca bu cihazı susturabilmek için. */
const DEVICE_TOKEN_KEY = 'ewd-push-token';

/**
 * Development-only logging. These traces print FCM registration tokens and
 * session user ids, which end up readable in device logs on a shipped build,
 * so they must never run in production. Genuine failures still use
 * console.error / console.warn.
 */
const DEV = import.meta.env.DEV;
const dlog = (...args: unknown[]) => {
  if (DEV) console.log(...args);
};

/**
 * Android'de uygulamanın bildirim ayarları sayfasını açan yerel eklenti
 * (android/app/.../AppSettingsPlugin.java). iOS'ta gerek yok: orada
 * `app-settings:` adresi aynı işi görüyor.
 */
interface AppSettingsPlugin {
  openNotificationSettings(): Promise<void>;
}
const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');

export type BildirimIzni = 'granted' | 'denied' | 'prompt' | 'unsupported';

/** İşletim sisteminin bildirim izni şu an ne durumda? Web'de `unsupported`. */
export async function bildirimIzniDurumu(): Promise<BildirimIzni> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { receive } = await PushNotifications.checkPermissions();
    if (receive === 'granted' || receive === 'denied') return receive;
    return 'prompt';
  } catch {
    return 'unsupported';
  }
}

/**
 * Kullanıcıyı uygulamanın sistem ayarlarına götürür.
 *
 * İzin bir kez reddedildikten sonra iOS sistem penceresini bir daha HİÇ
 * göstermiyor (Android 13+ ikinci retten sonra); `requestPermissions` sessizce
 * `denied` döner. Bildirimi yeniden açmanın tek yolu ayarlar sayfası.
 */
export async function bildirimAyarlariniAc(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() === 'ios') {
    // Capacitor uygulama dışı üst düzey gezinmeleri UIApplication.open'a devreder;
    // `app-settings:` Ayarlar'da doğrudan bu uygulamanın sayfasını açar.
    window.location.href = 'app-settings:';
    return;
  }
  await AppSettings.openNotificationSettings();
}

/**
 * Kullanıcı bildirimi açmak için ayarlara gönderildi mi? Uygulamaya dönünce
 * izin açılmışsa cihaz kaydedilir (BildirimHatirlatma yoklar). Hem hatırlatma
 * kartı hem menüdeki "Bildirimler" satırı buradan geçtiği için modül düzeyinde.
 */
let ayarlaraGonderildi = false;

/** Ayarlardan dönüş bekleniyorduysa bayrağı indirip `true` döner. */
export function ayarDonusunuTuket(): boolean {
  const vardi = ayarlaraGonderildi;
  ayarlaraGonderildi = false;
  return vardi;
}

/**
 * Bildirimleri sonradan açma — ilk açılıştaki izin penceresini geçen ya da
 * reddeden kullanıcı için tek giriş noktası.
 *
 * - İzin hiç sorulmadıysa sistem penceresi gösterilir.
 * - Reddedildiyse (iOS pencereyi bir daha göstermez) ayarlar sayfası açılır.
 * - Zaten açıksa cihaz yeniden kaydedilir: token veritabanından düşmüşse
 *   (çıkış, FCM'in ölü token temizliği) bildirim bu sayede geri gelir.
 */
export async function bildirimleriAc(
  userId: string,
  role: 'teacher' | 'student' | 'admin'
): Promise<BildirimIzni> {
  const durum = await bildirimIzniDurumu();
  if (durum === 'unsupported') return durum;
  if (durum === 'denied') {
    ayarlaraGonderildi = true;
    try {
      await bildirimAyarlariniAc();
    } catch (error) {
      ayarlaraGonderildi = false;
      throw error;
    }
    return durum;
  }
  await initPushNotifications(userId, role);
  return bildirimIzniDurumu();
}

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

  dlog('[PUSH] Creating Android notification channels...');
  for (const ch of channels) {
    try {
      await LocalNotifications.createChannel(ch);
      dlog(`[PUSH] Channel created: ${ch.id}, sound: ${ch.sound}`);
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
  dlog('[PUSH-DIAG] initPushNotifications called, userId:', userId, 'role:', role);
  dlog('[PUSH-DIAG] isNativePlatform:', Capacitor.isNativePlatform(), 'platform:', Capacitor.getPlatform());

  // Only run on native (Android/iOS)
  if (!Capacitor.isNativePlatform()) {
    dlog('[PUSH-DIAG] Not native platform, returning early');
    return;
  }

  // Create Android notification channels before anything else
  await createAndroidChannels();

  try {
    const permStatus = await PushNotifications.checkPermissions();
    dlog('[PUSH-DIAG] checkPermissions result:', permStatus.receive);

    if (permStatus.receive === 'granted') {
      dlog('[PUSH-DIAG] Already granted, registering token...');
      await registerAndSaveToken(userId, role);
      return;
    }

    if (permStatus.receive === 'denied') {
      // Sistem penceresi artık açılmaz; kullanıcıyı ayarlara götüren
      // hatırlatma bunu üstleniyor (components/panel/BildirimHatirlatma.tsx).
      dlog('[PUSH-DIAG] Permission denied by user');
      return;
    }

    // 'prompt' / 'prompt-with-rationale' — sistem penceresi hâlâ gösterilebilir.
    // Eskiden ilk retten sonra bir bayrakla bir daha hiç sorulmuyordu; oysa
    // Android ikinci bir şans veriyor, onu kullanıcıdan esirgemeyelim.
    const result = await PushNotifications.requestPermissions();
    dlog('[PUSH-DIAG] requestPermissions result:', result.receive);

    if (result.receive === 'granted') {
      await registerAndSaveToken(userId, role);
    }
  } catch (error) {
    console.error('[PUSH-DIAG] Push notification init error:', error);
  }
}

/**
 * Register for push and save the token to Supabase.
 */
async function registerAndSaveToken(userId: string, role: string): Promise<void> {
  dlog('[PUSH-DIAG] registerAndSaveToken entered, userId:', userId, 'role:', role);

  // Remove any existing listeners to prevent accumulation on re-mounts
  await PushNotifications.removeAllListeners();

  // Listen for registration success
  await PushNotifications.addListener('registration', async (token) => {
    dlog('[PUSH-DIAG] >>> registration event FIRED, token:', token.value?.substring(0, 20) + '...');

    const platform = Capacitor.getPlatform(); // 'android' | 'ios'

    // Diagnostic: check current session
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData?.session?.user?.id;
    dlog('[PUSH-DIAG] current session user_id:', sessionUserId, 'matches userId param:', sessionUserId === userId);

    if (!sessionUserId) {
      console.error('[PUSH-DIAG] NO SESSION — token cannot be saved. Retrying in 2s...');
      // Retry once after 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      const { data: retrySession } = await supabase.auth.getSession();
      const retryUserId = retrySession?.session?.user?.id;
      dlog('[PUSH-DIAG] retry session user_id:', retryUserId);
      if (!retryUserId) {
        console.error('[PUSH-DIAG] Still no session after retry, aborting token save');
        return;
      }
    }

    // Kayıt sunucudaki işlevle yapılıyor (rpc_push_token_kaydet). Doğrudan
    // upsert şu durumda sessizce başarısız oluyordu: token satırı başka bir
    // hesaba aitse (aynı telefonda ikinci hesap — kardeşler, veli + çocuk) RLS
    // satırı hem gizliyor hem üzerine yazmayı 403 ile reddediyordu; o kullanıcı
    // o cihazda hiç bildirim alamıyordu. İşlev token'ı oturum sahibine devrediyor,
    // rolü de istemciden değil `user_roles`tan alıyor.
    //
    // Kullanıcının DİĞER token'larına dokunulmuyor. Eskiden burada "eski
    // kurulumları temizle" diye hepsi siliniyordu: aynı hesabı iki telefonda
    // kullanan ailede bildirim yalnızca son giriş yapan cihaza gidiyordu. Ölü
    // token'ları send-push, FCM `UNREGISTERED` dediğinde siliyor.
    const { error } = await supabase.rpc('rpc_push_token_kaydet', {
      p_token: token.value,
      p_platform: platform,
    });

    dlog('[PUSH-DIAG] token kayıt sonucu - error:', error);

    if (error) {
      console.error('[PUSH-DIAG] Failed to save push token:', error);
    } else {
      try {
        localStorage.setItem(DEVICE_TOKEN_KEY, token.value);
      } catch {
        /* depolama kapalıysa çıkışta kullanıcının bütün cihazları susturulur */
      }
      dlog(`[PUSH-DIAG] Token registered successfully for ${role}`);
    }
  });

  // Listen for registration errors
  await PushNotifications.addListener('registrationError', (error) => {
    console.error('[PUSH-DIAG] >>> registrationError:', error);
  });

  // Foreground notification
  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    dlog('[PUSH] Push received (foreground):', notification);
  });

  // User tapped on notification — navigate via deep link
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    dlog('[PUSH] Push action performed:', action);
    const data = action.notification.data ?? {};
    const deepLink: string = data.deep_link ?? '/dashboard';
    if (deepLink && deepLink.startsWith('/')) {
      window.history.pushState({}, '', deepLink);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });

  dlog('[PUSH-DIAG] All listeners added, calling register()...');

  // Register with FCM/APNs
  await PushNotifications.register();

  dlog('[PUSH-DIAG] PushNotifications.register() completed');
}

/**
 * Çıkışta BU cihazın bildirimlerini kapatır.
 *
 * Aynı hesabın açık olduğu diğer telefonlar bildirim almaya devam eder. Bu
 * cihazın token'ı bilinmiyorsa (kayıt hiç tamamlanmadıysa) güvenli tarafta
 * kalıp kullanıcının bütün token'ları kapatılır — çıkış yapılmış bir cihaza
 * ödev bildirimi düşmesindense diğer cihazın bir sonraki açılışta yeniden
 * kaydolması yeğdir.
 */
export async function disablePushTokens(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  let deviceToken: string | null = null;
  try {
    deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    /* yok say */
  }

  try {
    let query = supabase
      .from('push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (deviceToken) query = query.eq('token', deviceToken);
    await query;
  } catch (error) {
    console.error('Failed to disable push tokens:', error);
  }
}
