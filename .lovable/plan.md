

# "DILARA" Fontu ve SSS Güncellemesi

## 1. Aprilia Font Sorunu

### Tespit Edilen Sorun

Font dosyaları (`public/uploads/fonts/Aprilia.woff2` ve `Aprilia.woff`) mevcut değil! Bu nedenle:

- CSS'de tanımlanan `@font-face` çalışmıyor
- Tarayıcı fallback font olan "Dancing Script" kullanıyor
- `font-aprilia` sınıfı doğru tanımlı ama font dosyası yüklenemiyor

Mevcut yapı:
```css
/* index.css */
@font-face {
  font-family: "Aprilia";
  src:
    url("/uploads/fonts/Aprilia.woff2") format("woff2"),
    url("/uploads/fonts/Aprilia.woff") format("woff");
  /* ... */
}

/* Fallback tanımı */
@import url("https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap");
```

### Çözüm Yaklaşımı

**Seçenek A (Önerilen)**: Font dosyalarını yükle
- `Aprilia.woff2` ve `Aprilia.woff` dosyalarını `public/uploads/fonts/` klasörüne yüklemeniz gerekiyor
- Bu dosyalar mevcutsa font otomatik çalışacak

**Seçenek B**: Google Fonts'tan benzer bir font kullan
- "Pacifico", "Satisfy", "Great Vibes" gibi script fontları alternatif olabilir
- Bu durumda CSS güncellemesi yapılır

Mevcut "DILARA" yazıları doğru şekilde `font-aprilia` sınıfı kullanıyor:
- `HeroSection.tsx` satır 37: `className="... font-aprilia ..."`
- `WhySection.tsx` satır 32: `className="font-aprilia ..."`

---

## 2. SSS'e Yeni Soru Ekleme

### Eklenecek İçerik

**Türkçe:**
- Soru: "Neden giriş yapamıyorum?"
- Cevap: "Derslerimize kaydolduğunuzda size giriş yapabilmeniz için bir mail ve şifre veriliyor. Bu bilgilerle sisteme giriş yaparsanız hesabınızı açtığınızda öğrenci panelinize erişebileceksiniz. Ödev gönderimi, işlenen dersler bu panelden takip edilir."

**İngilizce:**
- Soru: "Why can't I log in?"
- Cevap: "When you register for our courses, you are given an email and password to log in. If you log in with this information, you will be able to access your student panel once you create your account. Assignment submissions and course progress are tracked through this panel."

### Değişiklikler

| Dosya | Değişiklik |
|-------|------------|
| `src/lib/translations.ts` | `faq.questions` altına `login` objesi ekleme |
| `src/components/landing/FAQSection.tsx` | `faqItems` dizisine yeni soru ekleme |

---

## Teknik Detaylar

### translations.ts Güncelleme

```typescript
faq: {
  // ... mevcut sorular
  questions: {
    duration: { ... },
    freeTrial: { ... },
    platform: { ... },
    lessonType: { ... },
    // YENİ SORU:
    login: {
      question: { 
        tr: 'Neden giriş yapamıyorum?', 
        en: 'Why can\'t I log in?' 
      },
      answer: { 
        tr: 'Derslerimize kaydolduğunuzda size giriş yapabilmeniz için bir mail ve şifre veriliyor. Bu bilgilerle sisteme giriş yaparsanız hesabınızı açtığınızda öğrenci panelinize erişebileceksiniz. Ödev gönderimi, işlenen dersler bu panelden takip edilir.',
        en: 'When you register for our courses, you are given an email and password to log in. If you log in with this information, you will be able to access your student panel once you create your account. Assignment submissions and course progress are tracked through this panel.'
      },
    },
  },
}
```

### FAQSection.tsx Güncelleme

```typescript
const faqItems = [
  // ... mevcut 4 soru
  {
    question: t.faq.questions.login.question,
    answer: t.faq.questions.login.answer,
  },
];
```

---

## Font Dosyası Hakkında Not

Aprilia fontunu zorunlu kılmak için font dosyalarının yüklenmesi gerekiyor. Eğer font dosyalarınız varsa, bunları projeye yükleyebilirsiniz. Alternatif olarak, benzer bir Google Font kullanılabilir - bu durumda hangi fontu tercih ettiğinizi belirtmeniz yeterli.

