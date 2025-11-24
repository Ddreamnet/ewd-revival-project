-- Ödev kaydına kim yükledi bilgisini ekle
ALTER TABLE public.homework_submissions 
ADD COLUMN IF NOT EXISTS uploaded_by_user_id uuid NOT NULL DEFAULT auth.uid();

-- Var olan kayıtlarda, öğrenci mi öğretmen mi yüklemiş belirlemek için:
-- Eğer kayıt yoksa sorun yok. Varsa default olarak student_id ile eşleştirelim.
-- Ancak bu işlem geriye dönük olarak tam doğru olmayabilir.
-- Yeni kayıtlarda bu alan otomatik doldurulacak.