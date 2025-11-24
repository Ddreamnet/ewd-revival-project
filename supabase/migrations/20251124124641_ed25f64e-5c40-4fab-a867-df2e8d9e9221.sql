-- Storage policies for homework-files bucket

-- Students can upload their own homework files
CREATE POLICY "Students can upload own homework"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Students can view and download their own homework files
CREATE POLICY "Students can view own homework"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Teachers can view and download homework files from their students
CREATE POLICY "Teachers can view student homework"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files' AND
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id::text = (storage.foldername(name))[1]
  )
);

-- Teachers can upload homework for their students
CREATE POLICY "Teachers can upload student homework"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework-files' AND
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id::text = (storage.foldername(name))[1]
  )
);

-- Users can delete their own uploaded files (check second folder level for uploader)
CREATE POLICY "Users can delete own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'homework-files' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Admins have full access
CREATE POLICY "Admins full access homework files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'homework-files' AND
  public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'homework-files' AND
  public.has_role(auth.uid(), 'admin'::app_role)
);