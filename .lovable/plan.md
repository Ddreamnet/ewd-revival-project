
Amaç: Önce gerçekten eski sürümün çalıştığını teyit ettim; sonra bunu düzeltecek uygulama planını veriyorum. Henüz uygulama yok.

## Ne buldum
Kaynak kod şu an gerçekten eski sürüm:

- `supabase/functions/data-recovery/index.ts`
  - Eski fallback mantığı hâlâ var:
    - `unmatchedSlots`
    - `unmatchedIdx`
    - `"has no matching template slot ... Used fallback slot"`
    - `"ran out of template slots. Used first slot"`
  - Yiğit için gördüğünüz `"NO template slots"` mesajını üreten kod da hâlâ mevcut.
  - `SAFE_APPLY / MANUAL_REVIEW / SKIP_ARCHIVED / HARD_BLOCKER` sınıflandırma yapısı yok.
  - Response hâlâ eski formatta dönüyor: `{ log, manualReview, errors, dryRun }`

- `public/recovery.html`
  - Hâlâ sadece düz metin log basıyor.
  - Yeni isim-bazlı sınıflandırma UI’si yok.
  - Structured result beklemiyor; sadece `result.log` ve `result.manualReview` gösteriyor.

- `supabase/config.toml`
  - `data-recovery` için ayrı function config görünmüyor.

Sonuç: Bu bir preview/cache problemi gibi görünmüyor; repo içindeki gerçek kaynak da eski sürüm.

## Uygulama planı

### 1) `data-recovery` edge function’ı yeni SAFE APPLY mimarisine geçir
Mevcut fallback akışını tamamen kaldıracağım ve iki aşamalı yapı kuracağım:

- Pass 1: Classify
  - Her öğrenci için verdict üret:
    - `SAFE_APPLY`
    - `MANUAL_REVIEW`
    - `SKIP_ARCHIVED`
    - `HARD_BLOCKER`
  - Reason code üret:
    - `NO_TEMPLATE`
    - `DAY_MISMATCH`
    - `SLOT_OVERFLOW`
    - `EMPTY_DATES`
    - `EMPTY_DATES_WITH_COMPLETED`
    - `LPW_CONFLICT`
    - `NON_CONTIGUOUS`
    - `ARCHIVED`

- Pass 2: Execute
  - Sadece `SAFE_APPLY` grubunu işler
  - `LIVE RUN` sırasında diğer tüm öğrenciler kesin skip edilir

### 2) Eski fallback logic’i fiziksel olarak kaldır
Şunlar tamamen silinecek/değişecek:

- `unmatchedSlots`
- `unmatchedIdx`
- fallback slot atama
- “used fallback slot”
- “used first slot”
- “ran out of template slots” sonrası zorla yazma davranışı

Yeni kural:
- deterministic exact mapping yoksa yazma yok
- ambiguous mapping varsa `MANUAL_REVIEW`

### 3) İsim bazlı sınıflandırma verisi ekle
Function içinde profile/student lookup ile şu alanlar üretilecek:

- `student_name`
- `teacher_name`
- `student_id`
- `teacher_id`
- `completed_count`
- `total_lessons`
- `lesson_dates_count`
- `template_slot_count`
- `verdict`
- `reason_code`
- `reason_detail`

Özellikle Doğukan / Emir / Yiğit örnekleri restore truth’a göre doğru raporlanacak.

### 4) `recovery.html` dry run ekranını yeni response formatına göre yenile
Düz log ekranı yerine bölümlü çıktı gösterecek:

- `SAFE_APPLY`
- `MANUAL_REVIEW`
- `SKIP_ARCHIVED`
- `HARD_BLOCKER`

Her satırda:
- öğrenci adı
- öğretmen adı
- UUID
- completed/total
- slot count
- reason code
- kısa açıklama

Ayrıca üstte özet:
- safe apply count
- manual review count
- archived count
- hard blocker count
- safe apply delete estimate
- safe apply insert estimate

### 5) `LIVE RUN` davranışını güvenli hale getir
Butona basıldığında:
- yalnızca `SAFE_APPLY` listesi işlensin
- `MANUAL_REVIEW / SKIP_ARCHIVED / HARD_BLOCKER` kesinlikle dokunulmasın
- çıktı satır bazında `APPLY` / `SKIP` / `MANUAL REVIEW` olarak netsin

### 6) Deploy ve doğrulama planı
Uygulama sonrası sırasıyla:

1. `data-recovery` edge function deploy
2. `public/recovery.html` güncellemesi preview build’e yansıtma
3. function response kontrolü:
   - artık `log/manualReview` ağırlıklı eski format değil
   - structured classification dönmeli
4. fallback logic doğrulaması:
   - kaynakta fallback kodu kalmamalı
   - dry run çıktısında fallback mesajı kalmamalı
5. preview doğrulaması:
   - `/recovery.html` doğrudan açılmalı
   - gerekirse cache-busting ile yeni preview alınmalı

## Beklenen yeni dry run formatı
Örnek çıktı yapısı:

```text
=== SUMMARY ===
SAFE_APPLY: X
MANUAL_REVIEW: Y
SKIP_ARCHIVED: Z
HARD_BLOCKER: W
SAFE DELETE ESTIMATE: N
SAFE INSERT ESTIMATE: M

=== SAFE_APPLY ===
APPLY | Doğukan | Fatih Teacher | 3cf78ec1-... | 4/8 | dates=8 | slots=2 | OK_EXACT_MATCH
APPLY | Emir    | Fatih Teacher | ab6741ab-... | 7/8 | dates=8 | slots=2 | OK_EXACT_MATCH
APPLY | Yiğit   | Eren Teacher  | dabfdf47-... | 2/8 | dates=8 | slots=2 | OK_EXACT_MATCH

=== MANUAL_REVIEW ===
MANUAL REVIEW | ... | reason=SLOT_OVERFLOW | ...

=== SKIP_ARCHIVED ===
SKIP | ... | reason=ARCHIVED
```

## Neden şu an LIVE RUN yapılmamalı
Çünkü mevcut kod:
- fallback ile yazabiliyor
- yanlış `NO_TEMPLATE` raporu üretebiliyor
- güvenli grup ayrımı yapmıyor
- UI eski log formatını gösteriyor

Bu yüzden önce edge function + recovery.html birlikte güncellenmeli; sonra yeni dry run alınmalı; ondan sonra LIVE RUN onayı mantıklı olur.
