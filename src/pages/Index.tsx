import { useSiteSettings } from '@/hooks/useSiteSettings';
import { optimizedImage } from '@/lib/imageUrl';
import { useEffect } from 'react';

const Index = () => {
  const settings = useSiteSettings();
  const mode = settings?.home_mode || 'text';
  const bg = optimizedImage(settings?.bg_image_url, { width: 1920, quality: 65 });

  useEffect(() => {
    if (!bg) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = bg;
    (link as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = 'high';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [bg]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {bg && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bg})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80" />

      <div className="relative z-10 text-center space-y-4">
        {(mode === 'text' || mode === 'image_text') && settings?.site_title && (
          <h1 className="text-4xl md:text-6xl font-black tracking-wider uppercase text-white" style={{ textShadow: '0 0 40px rgba(255,255,255,0.15)' }}>
            {settings.site_title}
          </h1>
        )}
        {(mode === 'text' || mode === 'image_text') && settings?.site_description && (
          <p className="text-lg md:text-xl text-white/60 max-w-xl mx-auto">
            {settings.site_description}
          </p>
        )}

        {mode === 'image' && !settings?.bg_image_url && (
          <p className="text-lg text-white/40">Nenhuma imagem configurada</p>
        )}
      </div>
    </div>
  );
};

export default Index;
