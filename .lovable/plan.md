

# Blog Ozeligi Ekleme Plani

## Ozet
Projeye tam kapsamli bir blog sistemi eklenmesi: veritabani tablosu, storage bucket, admin yonetim paneli, public blog listesi/detay sayfalari, landing page slider bolumu ve header butonu.

---

## 1. Veritabani (Supabase Migration)

**Tablo: `blog_posts`**

| Kolon | Tip | Aciklama |
|-------|-----|----------|
| id | uuid (PK) | Otomatik |
| title | text NOT NULL | Baslik |
| slug | text UNIQUE NOT NULL | URL-friendly benzersiz yol |
| excerpt | text | Kisa ozet |
| content | text | HTML icerik (TipTap ciktisi) |
| cover_image_url | text | Kapak gorseli URL |
| status | text DEFAULT 'draft' | 'draft' veya 'published' |
| published_at | timestamptz | Yayin tarihi |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

**Storage Bucket:** `blog-media` (public) -- gorsel/video yuklemeleri icin.

**RLS Politikalari:**
- Public (anon + authenticated): Sadece `status = 'published'` olan kayitlari SELECT edebilir.
- Admin: Tam CRUD yetkisi (`has_role(auth.uid(), 'admin')` fonksiyonu ile).

**Trigger:** `updated_at` kolonu icin mevcut `update_updated_at_column` trigger fonksiyonu kullanilacak.

---

## 2. Yeni Dosyalar ve Bilesenler

### Sayfalar
- **`src/pages/BlogPage.tsx`** -- `/blog` rota sayfasi, yayinlanmis yazilari grid kartlar halinde listeler. Sayfalama icin "Daha fazla yukle" butonu.
- **`src/pages/BlogPostPage.tsx`** -- `/blog/:slug` rota sayfasi, tekil blog yazisi detayi. Baslik, tarih, kapak gorseli, HTML icerik. "Blog'a don" linki.

### Landing Page Bolumu
- **`src/components/landing/BlogSection.tsx`** -- FAQ ile Contact arasina eklenen slider/carousel bolumu. Mevcut `embla-carousel-react` paketi kullanilacak. En guncel 6 yayinlanmis yaziyi gosterir. Desktop'ta ok butonlari, mobilde swipe destegi. Section basligi + "Tum yazilar" butonu.

### Admin Paneli
- **`src/components/AdminBlogManager.tsx`** -- Blog yonetim dialog/modal bileseni. Yazi listesi, olusturma, duzenleme, silme, taslak/yayinlama durumu degistirme.
- **`src/components/BlogPostEditor.tsx`** -- TipTap tabanli zengin metin editoru. Mevcut projede zaten TipTap paketleri yuklu. Ek TipTap extension'lari: `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-youtube` (video embed icin). Araclar: H1/H2/H3, bold, italic, underline, bullet/numbered list, link, renk secici, gorsel yukleme (Supabase Storage'a), YouTube video embed.

### Yardimci
- **`src/hooks/useBlogPosts.ts`** -- Blog verilerini cekmek icin React Query hook'lari (public liste, tekil yazi, admin CRUD).

---

## 3. Mevcut Dosyalarda Degisiklikler

### `src/App.tsx`
- `/blog` ve `/blog/:slug` rotalari eklenir.
- `BlogPage` ve `BlogPostPage` import edilir.

### `src/components/landing/LandingHeader.tsx`
- "Dersler" ve "Iletisim" butonlarinin yanina "Blog" butonu eklenir.
- Ayni stil (mobilde ikon, desktop'ta yazi).
- Tiklaninca `/blog` sayfasina `navigate` ile yonlendirir.

### `src/pages/LandingPage.tsx`
- `BlogSection` bileseni `FAQSection` ile `ContactSection` arasina eklenir.

### `src/components/AdminDashboard.tsx`
- Header'daki `rightActions` icinde `AdminNotificationBell` ile "Konular" butonu arasina "Blog" butonu eklenir.
- `AdminBlogManager` dialog state yonetimi eklenir.

### `src/lib/translations.ts`
- Blog ile ilgili ceviri anahtarlari eklenir (header butonu, section basligi, "Devamini oku", "Tum yazilar" vb.).

---

## 4. Tasarim Uyumlulugu

- Mevcut renk paleti kullanilir: pastel pembe arka planlar, `landing-purple` vurgular.
- Kartlar mevcut `Card` bileseni ile olusturulur (ayni radius, golge, spacing).
- Responsive: mobilde tek sutun grid, tablette 2 sutun, desktop'ta 3 sutun.
- Kapak gorselleri `aspect-ratio` ile tutarli boyutlarda, lazy-load (`loading="lazy"`).
- Blog icerik alani sanitize edilir (`dangerouslySetInnerHTML` ile render, icerik kayit sirasinda TipTap'in urettigi guvenli HTML kullanilir).

---

## 5. Teknik Detaylar

### Yeni Bagimliliklar
- `@tiptap/extension-image`
- `@tiptap/extension-link`
- `@tiptap/extension-youtube`
- `@tiptap/extension-placeholder`

### Slug Olusturma
- Basliktan otomatik slug uretimi (Turkce karakter destegi ile). Admin duzenleyebilir.

### Gorsel Yukleme Akisi
1. Admin editorde gorsel ekle butonuna tiklar.
2. Dosya secilir, `blog-media` bucket'ina yuklenir.
3. Public URL alinir ve TipTap'e image node olarak eklenir.

### Video Embed
- YouTube/Vimeo link yapistirma ile embed node eklenir (`@tiptap/extension-youtube`).

### Performans
- Blog listesinde sayfalama (10 yazi/sayfa, "Daha fazla yukle").
- Landing slider sadece 6 yazi ceker.
- Gorseller lazy-load.

