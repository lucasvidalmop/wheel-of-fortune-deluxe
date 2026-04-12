
-- Allow authenticated users to upload to whatsapp-media folder in app-assets
CREATE POLICY "Users can upload whatsapp media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-assets'
  AND (storage.foldername(name))[1] = 'whatsapp-media'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to update/overwrite their whatsapp media
CREATE POLICY "Users can update whatsapp media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-assets'
  AND (storage.foldername(name))[1] = 'whatsapp-media'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
