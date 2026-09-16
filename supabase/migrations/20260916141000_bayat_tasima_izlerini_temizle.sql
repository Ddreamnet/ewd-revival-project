-- Bir önceki göç original_date'in anlamını değiştirdi: artık "en baştaki yer"
-- değil, "son taşımadan hemen önceki yer". Eski kuralla birikmiş satırlarda
-- saklanan değer yeni anlama göre yanlış — birden fazla kez taşınmış bir
-- dersin orada yazan tarihi aylar öncesine ait olabiliyor.
--
-- Somut tehlike: Elifsu'nun Ağustos'taki beş dersinde kayıtlı çıkış noktası
-- Haziran'ı gösteriyordu. "Geri Al" denseydi dersler Haziran'a uçacaktı.
--
-- Doğru çıkış noktasını geriye dönük hesaplamanın yolu yok (ara adımlar hiçbir
-- yerde tutulmuyordu), o yüzden uydurmak yerine siliniyor: "nereden geldiği
-- bilinmiyor" demek, yanlış bir tarih göstermekten iyidir. Bir sonraki taşıma
-- doğru değeri kendisi yazacak.
--
-- Hiçbir dersin tarihi, saati ya da işlendi durumu değişmiyor — yalnızca
-- taşınma rozeti ve sayaç sıfırlanıyor.

UPDATE public.lesson_instances
   SET original_date = NULL,
       original_start_time = NULL,
       original_end_time = NULL,
       rescheduled_count = 0,
       is_manual_override = false,
       updated_at = now()
 WHERE status = 'planned'
   AND rescheduled_count >= 2;
