

# Kök Neden: Admin Panel Bildirimleri Canlı Güncellenmiyor

## Kök Neden (Kesin)
`admin_notifications` tablosu Supabase Realtime publication'a eklenmemiş. `pg_publication_tables` sorgusu boş döndü.

`AdminNotificationBell.tsx` satır 55-70'te `postgres_changes` ile `admin_notifications` tablosunu dinliyor ama Supabase bu tablo için hiçbir realtime event yayınlamıyor.

Bu yüzden:
- Uygulama açıkken yeni bildirim DB'ye düşüyor ama realtime event gelmiyor → UI güncellenmiyor
- Çıkıp tekrar girince `fetchNotifications()` mount'ta çalışıyor → veriler görünüyor

## Düzeltme
Tek SQL migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
```

## Dosya
- 1 SQL migration dosyası

## Risk
Sıfır. Sadece realtime broadcast'i etkinleştiriyor, mevcut RLS politikaları geçerli kalıyor.

## Push Tarafı
Push delivery ayrı bir konu — edge function webhook ile tetikleniyor, realtime ile ilgisi yok. Token fix'i sonrası push'ın çalışıp çalışmadığı ayrıca test edilmeli.

