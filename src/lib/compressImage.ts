// Redimensiona e comprime uma imagem no navegador antes do upload, pra
// nunca mandar pro storage um arquivo cru gigante (o que deixava a pagina
// pesada tanto no envio quanto depois, pra quem carrega a imagem).
export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  const { maxDimension = 1280, quality = 0.82 } = opts;

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file; // SVG e nao-imagem passam direto
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  );
  if (!blob) return file;

  // So usa a versao comprimida se ela realmente ficou menor.
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], newName, { type: 'image/webp' });
}
