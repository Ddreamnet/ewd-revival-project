# PRIVACY.md — ders medyasında gizlilik kuralları

Ders fotoğrafları ve videoları küçük yaştaki öğrencileri içeriyor. Bu yüzden bağlayıcı kural:

**Ne görünmemeli**
1. Öğrencinin yüzü / bedeni (Zoom kamera kutucuğu).
2. Öğretmenin yüzü (kamera kutucuğu).
3. Zoom ekran adları / isim etiketleri.
4. Öğrenci listesi, e-posta, telefon içeren panel görüntüleri.
5. Öğrenci sesi.

**Nasıl uygulandı**
- Maske **medya dosyasının içine yakıldı** — CSS/HTML katmanı kullanılmadı. Gerekçe: örtü katmanı tam ekranda, sağ tık → "resmi yeni sekmede aç" veya doğrudan dosya adresinde ortadan kalkar; dosyaya yakılan maske kalkmaz.
- Maske görünümü (tasarımın parçası, kaza gibi durmasın): dolgu `#A253BE`, `2–3px` krem (`#FFF8EF`) kenarlık, `12–26px` radius, ortasında krem yıldız + `GİZLİLİK` yazısı.
- Videolar yeniden kodlandı: maske her kareye render edildi ve **ses tamamen kaldırıldı**.
- Bulanıklaştırma (blur) **kullanılmadı** — bazı blur'lar geri çevrilebilir ve düşük yarıçapta yüz tanınabilir kalır.
- Maskesiz orijinal medya bu pakette **yoktur**; projeden de silindi.
- Bölüm başlığının yanında veliye dönük bir bilgi kutusu var: "Gizlilik gereği öğrenci ve öğretmen görüntüleri ile isimler kapatılmıştır."

**Yeni medya eklenirken (boru hattı)**
1. Kareyi/klibi bir canvas'a çiz.
2. Kamera kutucuğu ve isim etiketi bölgelerini yukarıdaki maske stiliyle **doldur** (yarı saydam değil, tam opak).
3. Videoda maskeyi kare kare uygula ve ses kanalını at.
4. Sonucu yeni dosya olarak kaydet; **orijinali yayına alınan klasöre koyma.**
5. Yayına almadan önce tam ekranda ve doğrudan dosya adresinde kontrol et.

**Kullanılmayan medya (bilinçli karar)**
- Öğretmen panelinin göründüğü kare — öğrenci adları ve e-postaları görünüyordu.
- Tam ekran öğrenci yüzü olan iki kalp filtreli fotoğraf.
- `IMG_1283.mp4` — yüz karenin merkezinde ve hareketli; maskeleyince içerik kalmıyor.

**Öneri:** yayına almadan önce velilerden görsel kullanım onayı (yazılı) alınması; onay olmayan karelerin hiç kullanılmaması.
