

# Özel Scrollbar Tasarımı Ekleme Planı

## Özet

Yüzen, şeffaf arkaplanı ve mor renkli thumb'ı olan özel bir scrollbar tasarımı eklenecek. Tasarım metinlerde kullanılan mor tonuyla (landing-purple-dark) uyumlu olacak.

## Yapılacak Değişiklikler

### Scrollbar Tasarım Özellikleri

```text
┌─────────────────────────────────────┐
│                                     │
│  • Track: Tamamen şeffaf            │
│  • Thumb: Mor renk (rgba)           │
│  • Genişlik: 6px (ince & zarif)     │
│  • Yuvarlak köşeler: 50px           │
│  • Hover: Daha koyu mor             │
│  • Yüzen his için border efekti     │
│                                     │
└─────────────────────────────────────┘
```

### CSS Değişkenleri

| Değişken | Değer |
|----------|-------|
| Track rengi | `transparent` |
| Thumb rengi | `rgba(157, 89, 192, 0.75)` |
| Scrollbar genişliği | `6px` |
| Hover durumu | `rgba(157, 89, 192, 0.9)` |

### Teknik Detaylar

**Dosya: `src/index.css`**

Mevcut `body` stilinin altına scrollbar CSS'i eklenecek:

```css
/* Custom Scrollbar - Floating Purple Design */
body {
  /* Track tamamen şeffaf */
  --sb-track-color: transparent;
  /* Thumb rengi - landing-purple-dark tonunda */
  --sb-thumb-color: rgba(157, 89, 192, 0.75);
  --sb-size: 6px;
  /* Scrollbar alanı her zaman ayrı kalsın */
  scrollbar-gutter: stable both-edges;
}

body::-webkit-scrollbar {
  width: var(--sb-size);
}

body::-webkit-scrollbar-track {
  background: var(--sb-track-color);
  border-radius: 50px;
  box-shadow: none;
}

body::-webkit-scrollbar-thumb {
  background: var(--sb-thumb-color);
  border-radius: 50px;
  /* Yüzen his için border efekti */
  border: 2px solid transparent;
  background-clip: padding-box;
}

body::-webkit-scrollbar-thumb:hover {
  background: rgba(157, 89, 192, 0.9);
}

/* Firefox desteği */
@supports not selector(::-webkit-scrollbar) {
  body {
    scrollbar-color: rgba(157, 89, 192, 0.75) transparent;
    scrollbar-width: thin;
  }
}
```

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/index.css` | Scrollbar stilleri ekleme (satır ~209 civarına) |

## Tarayıcı Desteği

- **Chrome/Edge/Safari**: WebKit scrollbar pseudo-elementleri
- **Firefox**: `scrollbar-color` ve `scrollbar-width` fallback

