import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'app-assets';

const sanitizeFileName = (fileName: string) => {
  const [rawName, rawExt] = fileName.split(/\.(?=[^.]+$)/);
  const name = (rawName || 'arquivo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'arquivo';

  const ext = (rawExt || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  return ext ? `${name}.${ext}` : name;
};

export const uploadAppAsset = async (file: File, folder: string) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Sua sessão expirou. Faça login novamente para enviar arquivos.');
  }

  const safeFileName = sanitizeFileName(file.name);
  const path = `${user.id}/${folder}/${Date.now()}-${safeFileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, { upsert: true, cacheControl: '3600' });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
};
