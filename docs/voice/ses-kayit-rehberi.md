# Ses Klonu İçin Kayıt Rehberi

Bu kayıt, sitedeki kelime seslendirmelerinin kaynağı olacak. Yapay zekâ bu örnekteki
sesi, tonu ve enerjiyi kopyalıyor — yani kayıt nasılsa 680 kelime/cümle de öyle
seslenecek. Bu yüzden "güzel okumak"tan çok **tutarlı ve temiz** okumak önemli.

---

## 1. Ortam ve teknik ayarlar

| | |
|---|---|
| **Oda** | Halı, perde, yatak, dolap olan bir oda (yatak odası ideal). Banyo, mutfak, boş salon **olmaz** — yankı kaydı bozar. |
| **Gürültü** | Klima, vantilatör, buzdolabı, çamaşır makinesi, açık pencere kapalı. Telefon uçak modunda. |
| **Mikrofon** | Telefonun kendi mikrofonu yeter. Ağzından **15–20 cm** uzakta, tam karşıda değil **hafif yandan** tut (p/b harflerindeki patlamalar için). |
| **Uygulama** | iPhone: Sesli Notlar · Android: Kayıt Cihazı. Varsa "Ses İzolasyonu" / "Gürültü Engelleme" ayarını **kapat** — sesi yapay hâle getiriyor. |
| **Süre** | 60–90 saniye konuşma. (Alt sınır 10 sn, üst sınır 3 dk.) |
| **Başı/sonu** | Kayda basınca 1 saniye bekle, bitince 1 saniye bekle, sonra durdur. |
| **Dosya** | m4a / wav / mp3 — olduğu gibi bilgisayara aktar. **WhatsApp'tan gönderme**, sıkıştırıp kaliteyi düşürüyor. |

---

## 2. Nasıl bir ton?

- **Derste anlatır gibi**: sıcak, net, sakin. Sunucu ya da seslendirme sanatçısı taklidi yok.
- **Hız**: normal konuşmandan bir tık yavaş. Kelimelerin sonunu yutma.
- **Enerji sabit kalsın**: baştaki neşeyle sondaki neşe aynı olsun. Model ortalamayı değil, duyduğu tonu kopyalıyor.
- Fısıldama, bağırma, aşırı vurgulu "öğretmen sesi" yapma. Fazla abartılı okursan 680 kelimenin hepsi abartılı çıkar.
- Gülme, öksürük, "ııı" gibi sesler kaydın içinde kalmasın.
- Takılırsan: 2 saniye sus, o cümleyi baştan oku, devam et. En temiz alma hangisiyse onu gönder.

---

## 3. Okunacak metin (İngilizce)

> Kayıt İngilizce olmalı. Türkçe kayıttan klonlanan ses, İngilizce kelimeleri
> Türkçe aksanla ve yanlış telaffuz ederek okur.

### Bölüm 1 — Doğal konuşma (~35 sn)

> Hi, I'm Dilara. Welcome to today's lesson. Before we begin, take a deep breath and get
> comfortable. Today we're learning three new words together, and I'll say each one slowly
> so you can repeat after me. The fastest way to improve your pronunciation is to listen
> carefully and speak out loud. Don't worry about mistakes; every mistake teaches you
> something useful.

### Bölüm 2 — Tek tek kelimeler (~30 sn)

Her kelimeden sonra **bir saniye** ara ver. Öğrenciye telaffuz gösterir gibi oku.

> apple · happy · friend · water · beautiful · question · thought · weather · measure ·
> choice · journey · village · rhythm · morning · enough · through · family · language ·
> treasure · usually

### Bölüm 3 — Örnek cümleler (~25 sn)

Kartların arkasındaki cümleler bu tempoda okunacak, o yüzden burayı normal cümle akışında oku.

> She looks very happy today. My best friend lives next door. The weather is getting colder
> every morning. I eat an apple every day. Could you say that again, please?

---

## 4. Fransızca (isteğe bağlı)

Sitede 84 Fransızca kelime de var. Fransızca telaffuzun iyiyse ayrı, kısa bir kayıt daha al:

> Bonjour, je m'appelle Dilara. Aujourd'hui, nous allons apprendre trois nouveaux mots
> ensemble. Écoutez bien et répétez après moi. · maison · heureux · bonjour · voyage ·
> travailler · aujourd'hui · fenêtre · chercher · Leur maison a un petit jardin.

Fransızcada kendi sesini istemiyorsan sorun değil — o 84 kelime için ana dili Fransızca
olan hazır bir ses kullanırız, yine de şu anki tarayıcı sesinden çok daha iyi olur.

---

## 5. Bittiğinde

Dosyayı proje klasöründe `assets/voice/` içine koy (ör. `assets/voice/dilara-en.m4a`) ve
yolunu bana söyle. Gerisini ben hallederim: ses klonu oluşturulur, 340 kelime + 340 örnek
cümle üretilir, `public/audio/` altına yazılır ve kartlardaki hoparlör butonu bu dosyaları
çalmaya başlar.
