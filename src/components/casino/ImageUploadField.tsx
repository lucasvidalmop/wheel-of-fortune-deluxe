import { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import { compressImage } from '@/lib/compressImage';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
  className?: string;
}

// Campo padrao pra qualquer imagem do sistema: envia o arquivo do
// computador do operador (comprimido no navegador antes) pro storage
// proprio do projeto, em vez de depender de um link colado que pode
// apontar pra qualquer lugar (inclusive um servico que deixa de existir).
export default function ImageUploadField({ value, onChange, folder, label, className }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const { publicUrl } = await uploadAppAsset(compressed, folder);
      onChange(publicUrl);
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error('Erro ao enviar imagem: ' + (err?.message || 'tente novamente'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      {label && <span className="text-xs text-muted-foreground block mb-1">{label}</span>}
      <div className="flex items-center gap-2">
        {value && (
          <div className="relative shrink-0">
            <img src={value} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5"
            >
              <X size={10} />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Enviando...' : value ? 'Trocar imagem' : 'Enviar imagem'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
