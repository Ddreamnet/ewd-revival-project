# 🚀 English with Dilara - Proje Klonlama Rehberi

Bu rehber, projeyi sıfırdan yeni bir Supabase projesine nasıl kuracağınızı adım adım açıklar.

---

## 📋 Gereksinimler

- Supabase hesabı
- GitHub hesabı (opsiyonel, Lovable ile çalışıyorsanız gerekli değil)
- Lovable hesabı (opsiyonel)

---

## 🔧 AŞAMA 1: Yeni Supabase Projesi Oluşturma

1. [supabase.com](https://supabase.com) adresine gidin
2. **New Project** butonuna tıklayın
3. Proje bilgilerini girin:
   - **Organization**: Organizasyonunuzu seçin
   - **Name**: Proje adı (örn: "english-with-dilara-clone")
   - **Database Password**: Güçlü bir şifre oluşturun (kaydedin!)
   - **Region**: Size en yakın bölgeyi seçin
4. **Create new project** butonuna tıklayın
5. Proje oluşturulana kadar bekleyin (~2 dakika)

### 📝 Not Alınacak Bilgiler

Project Settings → API bölümünden aşağıdaki bilgileri not alın:
- **Project URL**: `https://xxx.supabase.co`
- **anon/public key**: `eyJhbG...`
- **service_role key**: `eyJhbG...` (gizli tutun!)
- **Project ID**: URL'deki `xxx` kısmı

---

## 🗄️ AŞAMA 2: Veritabanı Şemasını Oluşturma

SQL Editor'a gidin: **SQL Editor** → **New Query**

### Adım 2.1: Temel Şema
`01-clean-schema.sql` dosyasının içeriğini kopyalayıp yapıştırın ve **Run** butonuna basın.

### Adım 2.2: RLS Politikaları
`02-rls-policies.sql` dosyasının içeriğini kopyalayıp yapıştırın ve **Run** butonuna basın.

### Adım 2.3: Storage Kurulumu
`03-storage-setup.sql` dosyasının içeriğini kopyalayıp yapıştırın ve **Run** butonuna basın.

### Adım 2.4: Extensions ve Cron Job
1. **Dashboard → Database → Extensions** bölümüne gidin
2. `pg_cron` ve `pg_net` extension'larını etkinleştirin
3. `04-extensions-and-cron.sql` dosyasını açın
4. URL ve ANON_KEY değerlerini kendi projenizinkilerle değiştirin
5. SQL Editor'da çalıştırın

---

## 👤 AŞAMA 3: İlk Admin Kullanıcısı Oluşturma

1. **Authentication → Users** bölümüne gidin
2. **Add User** butonuna tıklayın
3. Bilgileri girin:
   - **Email**: admin@yourdomain.com
   - **Password**: Güçlü bir şifre
   - **Auto Confirm User**: ✅ İşaretli
4. **Create User** butonuna tıklayın
5. Oluşturulan kullanıcının **UUID**'sini kopyalayın

### Admin Rolü Atama
SQL Editor'da çalıştırın (UUID'yi değiştirin!):

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('KULLANICI_UUID_BURAYA', 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles 
SET full_name = 'Admin' 
WHERE user_id = 'KULLANICI_UUID_BURAYA';
```

---

## 📦 AŞAMA 4: Kodu Klonlama

### Seçenek A: Lovable ile
1. Mevcut projenizde **Project Settings** → **Remix this project** seçeneğini kullanın
2. Yeni projede dosyaları düzenleyin (aşağıya bakın)

### Seçenek B: GitHub ile
1. GitHub'dan projeyi fork/clone yapın
2. Yeni bir Lovable projesi oluşturun ve repo'yu bağlayın

### Düzenlenmesi Gereken Dosyalar

#### `src/integrations/supabase/client.ts`
```typescript
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_ANON_KEY";
```

#### `supabase/config.toml`
```toml
project_id = "YOUR_PROJECT_ID"
```

#### `.env` (varsa)
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

---

## ⚡ AŞAMA 5: Edge Functions

Edge functions kod ile birlikte gelir ve otomatik deploy edilir. Sadece **secrets** ayarlamanız gerekiyor:

1. **Settings → Edge Functions** bölümüne gidin
2. **Add New Secret** ile şu secret'ları ekleyin:
   - `SUPABASE_URL`: `https://YOUR_PROJECT_ID.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key'iniz
   - `SUPABASE_ANON_KEY`: Anon key'iniz

### Mevcut Edge Functions:
- `create-teacher`: Öğretmen hesabı oluşturma
- `create-student`: Öğrenci hesabı oluşturma
- `cleanup-lesson-overrides`: Eski ders override'larını temizleme
- `cleanup-trial-lessons`: Eski deneme derslerini temizleme

---

## ✅ AŞAMA 6: Test Etme

1. Projeyi çalıştırın
2. Admin hesabıyla giriş yapın
3. Şunları kontrol edin:
   - Admin paneli açılıyor mu?
   - Öğretmen oluşturulabiliyor mu?
   - Öğrenci oluşturulabiliyor mu?
   - Ders programı çalışıyor mu?

---

## 🔒 Güvenlik Kontrol Listesi

- [ ] Service role key'i asla client-side kodda kullanmayın
- [ ] Environment variable'ları `.env` dosyasına ekleyin
- [ ] RLS politikaları aktif mi kontrol edin
- [ ] Storage bucket'lar doğru yapılandırılmış mı?

---

## 📁 Dosya Yapısı

```
docs/clone/
├── 01-clean-schema.sql      # Tablolar, fonksiyonlar, trigger'lar
├── 02-rls-policies.sql      # Row Level Security politikaları
├── 03-storage-setup.sql     # Storage bucket'ları ve politikaları
├── 04-extensions-and-cron.sql # pg_cron ve cron job'lar
├── 05-first-admin-setup.sql # İlk admin kurulum SQL'i
└── KURULUM-REHBERI.md       # Bu dosya
```

---

## 🆘 Sorun Giderme

### "RLS policy violation" hatası
- Admin kullanıcısına rol atandığından emin olun
- `user_roles` tablosunda admin kaydı var mı kontrol edin

### "Function not found" hatası
- `01-clean-schema.sql` tam olarak çalıştırıldı mı?
- Functions bölümünde fonksiyonlar görünüyor mu?

### Storage upload başarısız
- Bucket'lar oluşturuldu mu?
- Storage policies aktif mi?

### Edge function çalışmıyor
- Secrets doğru ayarlandı mı?
- Function logs'a bakın

---

## 📞 Destek

Herhangi bir sorunla karşılaşırsanız:
1. Supabase logs'ları kontrol edin
2. Browser console'u kontrol edin
3. Network requests'i inceleyin

---

**Başarılar! 🎉**
