

# Admin Bildirim Sistemi — Kapsamlı Analiz ve Düzeltme Planı

## Kök Nedenler (3 Ayrı Sorun)

### Sorun 1: iOS'ta Admin Push Bildirimi Hiç Gelmiyor
**Kök neden kesin:** `admin_notifications` tablosunda database webhook trigger'ı **YOK**.

Kanıt:
- `notifications` tablosunda `notification_webhook` trigger'ı var → `supabase_functions.http_request()` ile `notifications-push` edge function'ı çağırıyor
- `admin_notifications` tablosunda **hiçbir trigger yok** (sorgu boş döndü)
- Edge function logları da boş — function hiç çağrılmadı

Bu yüzden `admin-notifications-push` edge function'ı mevcut olmasına rağmen hiçbir zaman tetiklenmiyor. Push gönderimi başlamıyor bile.

**Düzeltme:** `admin_notifications` INSERT trigger'ı oluşturulacak — `notifications` tablosundaki çalışan webhook pattern'i aynen uygulanacak.

### Sorun 2: Background → Foreground Geçişinde Bell Güncellenmiyor
**Kök neden:** `AdminNotificationBell` component'i sadece mount'ta `fetchNotifications()` çağırıyor ve realtime subscription kuruyor. App background'a geçtiğinde WebSocket bağlantısı kopabiliyor. Foreground'a dönünce:
- Realtime subscription ölmüş olabilir
- Refetch yapan hiçbir mekanizma yok
- Sadece tam restart'ta (component remount) veri yenileniyor

`AuthContext.tsx` satır 231-238'deki `appStateChange` listener'ı sadece `auth.startAutoRefresh/stopAutoRefresh` yapıyor — notification refetch tetiklemiyor.

**Karşılaştırma:** `NotificationBell` (öğretmen paneli) da aynı eksikliğe sahip — ama öğretmen panelinde bu sorun fark edilmemiş çünkü ödev bildirimleri daha seyrek.

**Düzeltme:** `AdminNotificationBell`'e Capacitor `appStateChange` listener'ı eklenecek — foreground'a dönünce `fetchNotifications()` çağrılacak.

### Sorun 3: Realtime Subscription Güvenilirliği
Realtime publication zaten önceki fix'te eklendi. Ama subscription koptuğunda recovery yok. Foreground'da çalışırken bile uzun süreli bağlantı kopuşlarında state stale kalabilir.

**Düzeltme:** Visibility change listener ile sayfa tekrar görünür olduğunda refetch.

---

## Uygulama Planı

### Adım 1: Database Webhook Trigger (SQL Migration)
`admin_notifications` INSERT → `admin-notifications-push` edge function çağıran trigger oluştur. Mevcut `notification_webhook` trigger'ındaki pattern'i birebir kullan:

```sql
CREATE TRIGGER admin_notification_webhook
AFTER INSERT ON public.admin_notifications
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://hwwpbtcgppzuscbvjkde.supabase.co/functions/v1/admin-notifications-push',
  'POST',
  '{"Content-type":"application/json","x-ewd-webhook-secret":"92e7a01f..."}',
  '{}',
  '10000'
);
```

### Adım 2: AdminNotificationBell — App Resume Refetch
`AdminNotificationBell.tsx`'e iki mekanizma ekle:

1. **Capacitor `appStateChange`**: Native platformda background→foreground geçişinde `fetchNotifications()` çağır
2. **`visibilitychange` event**: Web'de ve native'de tab/app gizlenip tekrar göründüğünde refetch

```typescript
useEffect(() => {
  // Web: visibilitychange
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      fetchNotifications();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // Native: Capacitor appStateChange
  let removeNativeListener: (() => void) | null = null;
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) fetchNotifications();
      }).then(handle => {
        removeNativeListener = () => handle.remove();
      });
    });
  }

  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    removeNativeListener?.();
  };
}, [adminId]);
```

---

## Dosyalar
1. **SQL migration** — `admin_notification_webhook` trigger oluşturma (~5 satır)
2. **`src/components/AdminNotificationBell.tsx`** — app resume refetch ekleme (~25 satır)

## Düzelen Senaryolar
| Senaryo | Önceki Durum | Sonrası |
|---------|-------------|---------|
| App açıkken bildirim | ✅ Çalışıyor (realtime fix) | ✅ Aynı |
| App background → foreground | ❌ Bell güncellenmiyordu | ✅ Refetch ile güncellenir |
| App kapalı → açılış | ✅ Mount'ta fetch | ✅ Aynı |
| iOS admin push bildirimi | ❌ Webhook trigger yoktu | ✅ Trigger ile edge function tetiklenir |
| Bell liste senkronizasyonu | ❌ Background sonrası stale | ✅ Resume'de refetch |

## Risk
Düşük. Webhook trigger `notifications` tablosundaki kanıtlanmış pattern'in kopyası. App resume refetch sadece mevcut `fetchNotifications` fonksiyonunu çağırıyor.

