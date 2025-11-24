-- Öğretmen de ödev yükleyebilsin diye RLS policy ekle
CREATE POLICY "teacher_create_student_homework"
ON public.homework_submissions
FOR INSERT
WITH CHECK (
  is_teacher(auth.uid()) AND 
  auth.uid() = teacher_id AND
  EXISTS (
    SELECT 1 FROM students 
    WHERE students.teacher_id = auth.uid() 
    AND students.student_id = homework_submissions.student_id
  )
);

-- Öğrenci kendi ödevini silebilsin
CREATE POLICY "student_delete_own_homework"
ON public.homework_submissions
FOR DELETE
USING (auth.uid() = student_id);

-- Öğrenci kendi ödevini güncelleyebilsin
CREATE POLICY "student_update_own_homework"
ON public.homework_submissions
FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Öğretmen kendi yüklediği ödevi silebilsin
CREATE POLICY "teacher_delete_own_homework"
ON public.homework_submissions
FOR DELETE
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Öğretmen kendi yüklediği ödevi güncelleyebilsin
CREATE POLICY "teacher_update_own_homework"
ON public.homework_submissions
FOR UPDATE
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id)
WITH CHECK (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Öğretmen kendi öğrencilerinin yüklediği ödev dosyalarını silebilsin (storage)
CREATE POLICY "teacher_delete_student_homework_files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'homework-files' AND
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM students 
    WHERE students.teacher_id = auth.uid() 
    AND students.student_id::text = (storage.foldername(name))[1]
  )
);

-- Öğrenci kendi dosyalarını silebilsin (storage)
CREATE POLICY "student_delete_own_homework_files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'homework-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);