import { useSiteSettings } from '@/hooks/useSiteSettings';

const Index = () => {
  const settings = useSiteSettings();
  const mode = settings?.home_mode || 'text';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {settings?.bg_image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${settings.bg_image_url})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80" />

      <div className="relative z-10 text-center space-y-4">
        {/* Show title for 'text' and 'image_text' modes */}
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

        {/* Show background image prominently for 'image' and 'image_text' modes — bg already covers via bg_image_url */}
        {mode === 'image' && !settings?.bg_image_url && (
          <p className="text-lg text-white/40">Nenhuma imagem configurada</p>
        )}
      </div>
    </div>
  );
};

export default Index;
