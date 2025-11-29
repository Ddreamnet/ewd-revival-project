-- Add INSERT policy for learning-resources bucket
-- Allow admins to upload files to learning-resources

CREATE POLICY "Admins can upload learning-resources"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'learning-resources' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Also allow teachers to upload (if needed in future)
CREATE POLICY "Teachers can upload learning-resources"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'learning-resources' 
  AND has_role(auth.uid(), 'teacher'::app_role)
);