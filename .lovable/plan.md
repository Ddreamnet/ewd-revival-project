
# İletişim Formu - Bire Bir Tasarım Uygulaması

## Hedef
Görseldeki form tasarımını birebir uygulamak: pastel pembe/lila tema, yumuşak kenarlar, border'sız görünüm ama hafif konturlu, şeker/pastel UI hissi.

## Değiştirilecek Dosya

| Dosya | Değişiklik |
|-------|------------|
| `src/components/landing/ContactSection.tsx` | Form kartı tamamen yeniden tasarlanacak |

---

## 1. Kart Genel Yapısı (Dış + İç Katman)

### Dış Katman (Pembe Çerçeve)
- Background: `landing-pink` tonunun yarı-transparan versiyonu (`bg-pink-200/70`)
- Border-radius: `rounded-[20px]`
- Border: yok (sadece hafif shadow)
- Shadow: `shadow-lg` yumuşak gölge
- Padding: `p-3` (iç panele boşluk bırakır)

### İç Katman (Lila/Beyaz Panel)
- Background: çok açık lila, yarı transparan (`bg-white/60` veya `bg-purple-50/50`)
- Border-radius: `rounded-[16px]`
- Padding: `p-4`
- Gingham hafifçe görünsün

### Kart Genişlik
- Desktop: `max-w-[340px]`
- Mobil: `w-full max-w-[340px] mx-auto`

---

## 2. Başlık Stili

- Metin: "İletişim Formu"
- Font: Poppins (zaten site genelinde)
- Font-weight: `font-bold` (700)
- Renk: `text-purple-900` veya koyu morumsu
- Boyut: `text-lg` veya `text-xl` (18-22px arası)
- Hizalama: sol (varsayılan)

---

## 3. Input Alanları Ortak Stili

Tüm input'lar için özel stil class'ları tanımlanacak:

### Input Arka Plan
- `bg-purple-100/60` - çok açık lila, yarı transparan

### Border
- `border border-purple-200/50` - çok hafif, neredeyse görünmez
- veya `border-0` ile sadece shadow

### Border Radius
- `rounded-xl` (12px civarı)

### İç Gölge
- `shadow-sm` veya custom `shadow-inner` hafif

### Placeholder
- `placeholder:text-purple-400` - açık mor/grimsi

### Focus Durumu
- `focus:ring-2 focus:ring-pink-300 focus:border-pink-300`
- `focus:outline-none`

### Input Yüksekliği
- Text/Select: `h-9` veya `h-10` (34-38px)
- Textarea: `min-h-[80px]` (70-90px)

---

## 4. Alanlar ve İkonlar (Sırasıyla)

### (1) Ad Soyad Input
- Placeholder: "Ad Soyad"
- Sağda kullanıcı ikonu (`User` from lucide-react)
- İkon rengi: mor tonlu (`text-purple-400`)
- İkon input'un içinde sağda, dikey ortalı

### (2) Öğrenci Yaşı / Kendim (Select)
- Placeholder: "Öğrenci yaşı / Kendim"
- Sağda aşağı ok ikonu (`ChevronDown`)
- Select de diğer input'larla aynı stilde

### (3) Telefon Alanı (+90 Prefix)
- İki parçalı tek satır:
  - Sol: `+90` chip/kutu - `bg-purple-100/80 rounded-l-xl px-3`
  - Sağ: telefon input - `rounded-r-xl`
- Placeholder: "Telefon Numaranız"
- İkisi birleşik görünsün (arada boşluk yok)

### (4) Mesaj Alanı (Textarea)
- Placeholder: "Mesajınız"
- Yükseklik: `min-h-[80px]`
- Aynı pastel lila background
- Aynı radius

---

## 5. Gönder Butonu (Sarı)

### Boyut ve Şekil
- Full width: `w-full`
- Yükseklik: `h-10` (36-40px)
- Radius: `rounded-xl` (12px)

### Renk ve Gradient
- Base: `bg-landing-yellow`
- Hafif gradient: üst biraz daha açık (CSS gradient)
- `background: linear-gradient(180deg, hsl(45, 100%, 72%) 0%, hsl(45, 95%, 65%) 100%)`

### Yazı
- Metin: "Gönder"
- Font-weight: `font-bold` (700)
- Renk: `text-amber-900` veya koyu morumsu/kahverengi

### Hover
- `hover:brightness-105` - hafif aydınlanma

### Active
- `active:translate-y-[1px]` - basılmış hissi

---

## 6. Buton Altı Açıklama Metni

- Metin: "Formu doldurduktan sonra en kısa sürede sizinle iletişime geçiyoruz."
- Boyut: `text-xs` (11-12px)
- Renk: `text-purple-700/70` - koyu mor ama hafif
- Hizalama: `text-center`
- Margin: `mt-3`

---

## 7. Renk Tanımları

Mevcut sitedeki renklerle uyumlu:
- Pembe çerçeve: `--landing-pink` tabanlı açık ton
- Sarı buton: `--landing-yellow` 
- Lila input'lar: `--landing-purple` tabanlı çok açık ton

---

## 8. Responsive Davranış

### Desktop
- Form kartı: `max-w-[340px]`
- Grid içinde ortalı duracak

### Mobil
- `w-full max-w-[340px] mx-auto`
- Padding korunacak
- Input yükseklikleri parmak dostu kalacak
- Yatay scroll olmayacak

---

## Teknik Uygulama Detayları

### ContactSection.tsx İçindeki Değişiklikler

Form kartı bölümü (satır 120-170 arası) tamamen yeniden yazılacak:

```tsx
{/* Form Kartı - Dış Pembe Çerçeve */}
<div className="w-full max-w-[340px] mx-auto lg:mx-0">
  <div className="bg-pink-200/70 rounded-[20px] p-3 shadow-lg">
    {/* İç Panel - Lila/Beyaz */}
    <div className="bg-white/60 backdrop-blur-sm rounded-[16px] p-4">
      
      {/* Başlık */}
      <h3 className="text-lg font-bold text-purple-900 mb-4">
        İletişim Formu
      </h3>
      
      <form className="space-y-3">
        {/* Ad Soyad - Sağda User ikonu */}
        <div className="relative">
          <input 
            className="w-full h-9 px-3 pr-10 bg-purple-100/60 border-0 rounded-xl 
                       placeholder:text-purple-400 text-sm
                       focus:ring-2 focus:ring-pink-300 focus:outline-none"
            placeholder="Ad Soyad"
          />
          <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
        </div>
        
        {/* Select - Öğrenci yaşı */}
        <Select>
          <SelectTrigger className="h-9 bg-purple-100/60 border-0 rounded-xl ...">
            <SelectValue placeholder="Öğrenci yaşı / Kendim" />
          </SelectTrigger>
          ...
        </Select>
        
        {/* Telefon - +90 prefix birleşik */}
        <div className="flex">
          <div className="flex items-center px-3 bg-purple-100/80 rounded-l-xl 
                          text-sm font-medium text-purple-700 border-r border-purple-200/50">
            +90
          </div>
          <input 
            className="flex-1 h-9 px-3 bg-purple-100/60 border-0 rounded-r-xl ..."
            placeholder="Telefon Numaranız"
          />
        </div>
        
        {/* Mesaj Textarea */}
        <textarea 
          className="w-full min-h-[80px] px-3 py-2 bg-purple-100/60 border-0 rounded-xl 
                     placeholder:text-purple-400 text-sm resize-none
                     focus:ring-2 focus:ring-pink-300 focus:outline-none"
          placeholder="Mesajınız"
        />
        
        {/* Sarı Gönder Butonu */}
        <button 
          type="submit"
          className="w-full h-10 rounded-xl font-bold text-amber-900
                     bg-gradient-to-b from-yellow-300 to-landing-yellow
                     hover:brightness-105 active:translate-y-[1px] transition-all"
        >
          Gönder
        </button>
        
        {/* Alt açıklama */}
        <p className="text-xs text-center text-purple-700/70 mt-2">
          Formu doldurduktan sonra en kısa sürede sizinle iletişime geçiyoruz.
        </p>
      </form>
    </div>
  </div>
</div>
```

### Select Dropdown Stili

SelectContent için özel stiller:
- `bg-white` arka plan (transparan değil)
- `z-[60]` yüksek z-index
- Aynı pastel tema

---

## Özet Checklist

- [ ] Dış pembe çerçeve (rounded-[20px], shadow-lg)
- [ ] İç lila/beyaz panel (rounded-[16px], yarı transparan)
- [ ] Başlık: "İletişim Formu" sol üst, Poppins bold, koyu mor
- [ ] Ad Soyad input + sağda User ikonu
- [ ] Öğrenci yaşı Select + aşağı ok
- [ ] +90 prefix + telefon input (birleşik)
- [ ] Mesaj textarea (daha yüksek)
- [ ] Sarı Gönder butonu (gradient, hover/active efektleri)
- [ ] Alt açıklama metni (küçük, ortalı)
- [ ] Tüm input'lar: pastel lila bg, border yok, yumuşak radius, focus pembe ring
- [ ] Max-width 340px, responsive
