import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import PremiumWheel from '@/components/casino/PremiumWheel';
import { useIsMobile } from '@/hooks/use-mobile';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

const Roleta = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [accountId, setAccountId] = useState('');
  const [identified, setIdentified] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const [config, setConfig] = useState<WheelConfig>(defaultConfig);

  const [spinsRemaining, setSpinsRemaining] = useState<number | null>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [fixedPrizeEnabled, setFixedPrizeEnabled] = useState(false);
  const [fixedPrizeSegment, setFixedPrizeSegment] = useState<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const maskId = (id: string) => {
    if (id.length <= 3) return '***';
    return id.substring(0, 2) + '*'.repeat(Math.max(3, id.length - 4)) + id.substring(id.length - 2);
  };

  const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });

  const handleShare = useCallback(async (prizeName: string) => {
    if (!pageRef.current) return;

    const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
      const words = text.split(' ');
      const lines: string[] = [];
      let current = '';

      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }

      if (current) lines.push(current);
      return lines;
    };

    try {
      const wheelSvg = pageRef.current.querySelector('svg');
      if (!wheelSvg) {
        toast.error('Roleta não encontrada para compartilhar');
        return;
      }

      let wheelImage: HTMLImageElement;

      try {
        const svgClone = wheelSvg.cloneNode(true) as SVGSVGElement;
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        svgClone.setAttribute('width', '600');
        svgClone.setAttribute('height', '600');
        svgClone.setAttribute('viewBox', '0 0 600 600');

        const svgString = new XMLSerializer().serializeToString(svgClone);
        const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
        wheelImage = await loadImage(svgUrl);
      } catch {
        const wheelElement = wheelSvg.parentElement?.parentElement as HTMLElement | null;
        const fallbackCanvas = await html2canvas(wheelElement || (wheelSvg as unknown as HTMLElement), {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
        });
        wheelImage = await loadImage(fallbackCanvas.toDataURL('image/png'));
      }

      const backgroundImage = config.backgroundImageUrl
        ? await loadImage(config.backgroundImageUrl).catch(() => null)
        : null;
      const headerImage = config.headerMode === 'image' && config.headerImageUrl
        ? await loadImage(config.headerImageUrl).catch(() => null)
        : null;

      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        toast.error('Erro ao preparar imagem');
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, config.resultBoxColor || '#12081f');
      bgGradient.addColorStop(0.55, '#09060f');
      bgGradient.addColorStop(1, '#040306');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (backgroundImage) {
        const scale = Math.max(canvas.width / backgroundImage.width, canvas.height / backgroundImage.height);
        const drawWidth = backgroundImage.width * scale;
        const drawHeight = backgroundImage.height * scale;
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.drawImage(backgroundImage, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
        ctx.restore();
      }

      const glow = ctx.createRadialGradient(canvas.width / 2, 760, 60, canvas.width / 2, 760, 520);
      glow.addColorStop(0, `${config.glowColor || '#FFD700'}66`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (headerImage) {
        const maxWidth = 560;
        const maxHeight = 220;
        const scale = Math.min(maxWidth / headerImage.width, maxHeight / headerImage.height);
        const drawWidth = headerImage.width * scale;
        const drawHeight = headerImage.height * scale;
        ctx.drawImage(headerImage, (canvas.width - drawWidth) / 2, 100, drawWidth, drawHeight);
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = config.glowColor || '#FFD700';
        ctx.font = `900 ${Math.max(36, (config.headerTitleSize ?? 36) * 2)}px Orbitron, Arial, sans-serif`;
        ctx.fillText(config.pageTitle || 'ROLETA', canvas.width / 2, 155);
        ctx.fillStyle = `${config.resultTextColor || '#ffffff'}cc`;
        ctx.font = `600 ${Math.max(20, (config.headerSubtitleSize ?? 12) * 2)}px Arial, sans-serif`;
        ctx.fillText(config.pageSubtitle || '', canvas.width / 2, 210);
      }

      drawRoundedRect(ctx, 270, 260, 540, 64, 32);
      ctx.fillStyle = 'rgba(8, 8, 14, 0.58)';
      ctx.fill();
      ctx.strokeStyle = `${config.resultBorderColor || config.glowColor || '#FFD700'}99`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = config.spinsTextColor || config.glowColor || '#FFD700';
      ctx.font = `700 ${Math.max(24, (config.spinsTextSize ?? 14) * 2)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        canSpin ? `Giros restantes: ${spinsRemaining ?? 0}` : (message || 'Sem giros disponíveis'),
        canvas.width / 2,
        302
      );

      ctx.save();
      ctx.shadowColor = `${config.glowColor || '#FFD700'}aa`;
      ctx.shadowBlur = 90;
      ctx.drawImage(wheelImage, 190, 400, 700, 700);
      ctx.restore();

      drawRoundedRect(ctx, 120, 1140, 840, 290, 42);
      ctx.fillStyle = `${config.resultBoxColor || '#130b20'}ee`;
      ctx.fill();
      ctx.strokeStyle = config.resultBorderColor || config.glowColor || '#FFD700';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = `${config.resultTextColor || '#ffffff'}cc`;
      ctx.font = '700 28px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PRÊMIO LIBERADO', canvas.width / 2, 1215);

      ctx.fillStyle = config.glowColor || '#FFD700';
      ctx.font = '900 68px Orbitron, Arial, sans-serif';
      const prizeLines = wrapText(ctx, prizeName, 700);
      prizeLines.slice(0, 2).forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, 1300 + index * 82);
      });

      drawRoundedRect(ctx, 160, 1490, 760, 116, 28);
      ctx.fillStyle = 'rgba(12, 12, 18, 0.72)';
      ctx.fill();
      ctx.strokeStyle = `${config.badgeBorderColor || config.glowColor || '#FFD700'}88`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = config.badgeNameColor || config.glowColor || '#FFD700';
      ctx.font = '800 34px Arial, sans-serif';
      ctx.fillText(userName || 'Usuário', 205, 1540);

      ctx.fillStyle = config.badgeLabelColor || '#a1a1aa';
      ctx.font = '700 20px Arial, sans-serif';
      ctx.fillText('ID PROTEGIDO', 205, 1578);

      ctx.fillStyle = config.badgeIdColor || '#d4d4d8';
      ctx.font = '700 28px monospace';
      ctx.fillText(maskId(accountId), 390, 1578);

      ctx.textAlign = 'center';
      ctx.fillStyle = `${config.resultTextColor || '#ffffff'}99`;
      ctx.font = '500 22px Arial, sans-serif';
      ctx.fillText('Compartilhe sua vitória com segurança', canvas.width / 2, 1730);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Falha ao gerar imagem'));
        }, 'image/png');
      });

      const file = new File([blob], 'meu-premio.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Ganhei: ${prizeName}!`,
          text: `🎉 Eu ganhei ${prizeName}!`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'meu-premio.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Share failed', e);
      toast.error('Erro ao gerar compartilhamento');
    }
  }, [accountId, canSpin, config, message, spinsRemaining, userName]);

  // Load config from slug
  useEffect(() => {
    if (!slug) {
      navigate('/', { replace: true });
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from('wheel_configs')
        .select('user_id, config')
        .eq('slug', slug)
        .maybeSingle();
      if (!data) {
        toast.error('Roleta não encontrada');
        navigate('/', { replace: true });
        return;
      }
      setOwnerId(data.user_id);
      if (data.config && Object.keys(data.config).length > 0) {
        setConfig({ ...defaultConfig, ...data.config });
      }
      setConfigLoading(false);

      // ── Track pageview ──
      const sessionId = (() => {
        let sid = sessionStorage.getItem('pv_session');
        if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('pv_session', sid); }
        return sid;
      })();
      const startTime = Date.now();

      supabase.functions.invoke('track-pageview', {
        body: {
          session_id: sessionId,
          slug,
          owner_id: data.user_id,
          referrer: document.referrer || null,
          page_url: window.location.href,
        },
      }).catch(() => {});

      // Update duration every 30s
      const durationInterval = setInterval(() => {
        const seconds = Math.round((Date.now() - startTime) / 1000);
        supabase.functions.invoke('track-pageview', {
          body: { session_id: sessionId, action: 'update_duration', duration_seconds: seconds },
        }).catch(() => {});
      }, 30000);

      // Final duration on unload
      const handleUnload = () => {
        const seconds = Math.round((Date.now() - startTime) / 1000);
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-pageview`,
          JSON.stringify({ session_id: sessionId, action: 'update_duration', duration_seconds: seconds })
        );
      };
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        clearInterval(durationInterval);
        window.removeEventListener('beforeunload', handleUnload);
      };
    })();
  }, [slug, navigate]);

  // Apply SEO: use operator config, fallback to global site_settings
  useEffect(() => {
    const applyGlobalFallback = async () => {
      let title = config.seoTitle;
      let desc = config.seoDescription;
      let favicon = config.faviconUrl;

      if (!title || !desc || !favicon) {
        const { data } = await (supabase as any).from('site_settings').select('*').eq('id', 1).maybeSingle();
        if (data) {
          if (!title) title = data.site_title || '';
          if (!desc) desc = data.site_description || '';
          if (!favicon) favicon = data.favicon_url || '';
        }
      }

      if (title) document.title = title;
      if (desc) {
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) { meta = document.createElement('meta'); (meta as HTMLMetaElement).name = 'description'; document.head.appendChild(meta); }
        (meta as HTMLMetaElement).content = desc;
      }
      if (favicon) {
        let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = favicon;
      }
    };
    applyGlobalFallback();
  }, [config.seoTitle, config.seoDescription, config.faviconUrl]);

  useEffect(() => {
    if (!accountId || !identified) return;
    setLoading(true);
    (supabase as any).rpc('get_wheel_user_spins', {
      p_account_id: accountId,
      p_owner_id: ownerId || null,
    }).then(({ data }: any) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setUserName(row.name);
          setSpinsRemaining(row.spins_available);
          setCanSpin(row.spins_available >= 1);
          setFixedPrizeEnabled(row.fixed_prize_enabled ?? false);
          setFixedPrizeSegment(row.fixed_prize_segment ?? null);
          if (!ownerId && row.owner_id) setOwnerId(row.owner_id);
          if (row.spins_available < 1) setMessage('Sem giros disponíveis');
        }
        setLoading(false);
      });
  }, [accountId, identified, ownerId]);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = inputValue.trim();
    const trimmedEmail = emailValue.trim();
    if (!trimmedId || !trimmedEmail) return;
    setAuthLoading(true);

    const { data: rpcData, error } = await (supabase as any).rpc('authenticate_wheel_user', {
      p_email: trimmedEmail,
      p_account_id: trimmedId,
      p_owner_id: ownerId || null,
    });
    const data = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    if (error || !data) {
      toast.error('Dados inválidos. Verifique seu email e ID da conta.');
      setAuthLoading(false);
      return;
    }

    setAccountId(data.account_id);
    setUserName(data.name);
    setSpinsRemaining(data.spins_available);
    setCanSpin(data.spins_available >= 1);
    setFixedPrizeEnabled(data.fixed_prize_enabled ?? false);
    setFixedPrizeSegment(data.fixed_prize_segment ?? null);
    if (data.owner_id) setOwnerId(data.owner_id);
    if (data.spins_available < 1) setMessage('Sem giros disponíveis');
    setIdentified(true);
    setSearchParams({ account_id: trimmedId, email: trimmedEmail });
    setAuthLoading(false);
  };

  const handleSpinEnd = async (segmentIndex: number) => {
    const seg = config.segments[segmentIndex];
    if (!seg) return;

    if (accountId) {
      await (supabase as any).rpc('record_spin_result', {
        p_account_id: accountId,
        p_user_name: userName || '',
        p_user_email: emailValue,
        p_prize: seg.title || `Segmento ${segmentIndex + 1}`,
        p_owner_id: ownerId || null,
      });

      // Prêmio pré-definido é desativado automaticamente pelo decrement_wheel_user_spins
      if (fixedPrizeEnabled) {
        setFixedPrizeEnabled(false);
        setFixedPrizeSegment(null);
      }

      const { data: decrementData } = await (supabase as any).rpc('decrement_wheel_user_spins', {
        p_account_id: accountId,
        p_owner_id: ownerId || null,
      });
      const row = Array.isArray(decrementData) ? decrementData[0] : decrementData;
      if (row) {
        setSpinsRemaining(row.spins_available);
        setCanSpin(row.spins_available >= 1);
        if (!ownerId && row.owner_id) setOwnerId(row.owner_id);
        if (row.spins_available < 1) setMessage('Sem giros disponíveis');
      }
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando roleta...</div>
      </div>
    );
  }

  // Login / identification screen
  if (!identified) {
    const ac = config;
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{
        background: ac.authBgImageUrl
          ? `url(${ac.authBgImageUrl}) center/cover no-repeat`
          : ac.authBgColor ?? '#1a0a2e',
      }}>
        {!ac.authBgImageUrl && (
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(80,20,120,0.3) 0%, rgba(10,5,30,0.9) 70%)' }} />
        )}

        <form
          onSubmit={handleIdentify}
          className="relative z-10 w-full max-w-sm mx-4 rounded-xl p-6 space-y-5"
          style={{
            background: ac.authCardBgColor ? `${ac.authCardBgColor}f2` : 'rgba(20, 12, 40, 0.95)',
            border: `1px solid ${ac.authCardBorderColor ?? 'rgba(255,255,255,0.08)'}`,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header: logo, text, or logo+text */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {(ac.authHeaderMode === 'logo' || ac.authHeaderMode === 'logo_text') && ac.authLogoUrl && (
                <img
                  src={ac.authLogoUrl}
                  alt="Logo"
                  className="object-contain mb-3"
                  style={{
                    height: ac.authLogoSize ?? 80,
                    maxWidth: '100%',
                    transform: `translate(${ac.authLogoOffsetX ?? 0}px, ${ac.authLogoOffsetY ?? 0}px) scale(${ac.authLogoScale ?? 1})`,
                  }}
                />
              )}
              {(ac.authHeaderMode === 'text' || ac.authHeaderMode === 'logo_text') && (
                <>
                  <h2 className="font-bold tracking-wide" style={{ color: ac.authLabelColor ?? '#fff', fontSize: ac.authTitleSize ?? 18 }}>
                    {ac.authTitle ?? 'LIBERAR GIRO'}
                  </h2>
                  <p className="mt-1" style={{ color: ac.authTextColor ?? 'rgba(255,255,255,0.5)', fontSize: ac.authSubtitleSize ?? 12 }}>
                    {ac.authSubtitle ?? 'Informe o e-mail e o ID da sua conta para verificarmos seu cadastro.'}
                  </p>
                </>
              )}
              {ac.authHeaderMode === 'logo' && !ac.authLogoUrl && (
                 <h2 className="font-bold tracking-wide" style={{ color: ac.authLabelColor ?? '#fff', fontSize: ac.authTitleSize ?? 18 }}>
                   {ac.authTitle ?? 'LIBERAR GIRO'}
                </h2>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold tracking-wider uppercase" style={{ color: ac.authLabelColor ?? '#ffffff' }}>
              E-MAIL
            </label>
            <input
              type="email"
              value={emailValue}
              onChange={e => setEmailValue(e.target.value)}
              placeholder="seu@email.com"
              maxLength={255}
              required
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `2px solid ${ac.authInputBorderColor ?? '#D4A017'}`,
                color: '#fff',
              }}
              onFocus={e => (e.target.style.borderColor = ac.authInputBorderColor ? `${ac.authInputBorderColor}` : '#FFD700')}
              onBlur={e => (e.target.style.borderColor = ac.authInputBorderColor ?? '#D4A017')}
            />
          </div>

          {/* Account ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold tracking-wider uppercase" style={{ color: ac.authLabelColor ?? '#ffffff' }}>
              ID DA CONTA
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Seu ID na plataforma"
              maxLength={100}
              required
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `2px solid ${ac.authInputBorderColor ?? '#D4A017'}`,
                color: '#fff',
              }}
              onFocus={e => (e.target.style.borderColor = ac.authInputBorderColor ? `${ac.authInputBorderColor}` : '#FFD700')}
              onBlur={e => (e.target.style.borderColor = ac.authInputBorderColor ?? '#D4A017')}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3.5 rounded-lg font-bold text-sm tracking-[0.2em] uppercase transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            style={{
              background: ac.authButtonBgColor ?? '#0ABACC',
              color: ac.authButtonTextColor ?? '#000000',
              boxShadow: `0 4px 20px ${ac.authButtonBgColor ?? '#0ABACC'}55`,
            }}
          >
            {authLoading ? 'VERIFICANDO...' : 'GIRAR AGORA'}
          </button>
        </form>
      </div>
    );
  }

  // Wheel screen
  return (
    <div ref={pageRef} className="min-h-dvh flex flex-col items-center justify-start relative overflow-hidden px-4 pt-4 pb-6 text-center" style={{ background: '#0a0a0f' }}>
      {config.backgroundImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: `url(${config.backgroundImageUrl})`,
            transform: `translate(${config.backgroundImageOffsetX ?? 0}px, ${config.backgroundImageOffsetY ?? 0}px) scale(${config.backgroundImageScale ?? 1})`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/70" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] opacity-15"
        style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
      />

      {/* Logged-in user badge - moved below wheel */}

      {/* Header */}
      {config.headerMode === 'image' && config.headerImageUrl ? (
        <img
          src={config.headerImageUrl}
          alt="Header"
          className="relative z-10 mb-4 md:mb-10 object-contain max-h-16 md:max-h-none"
          style={{
            height: config.headerImageSize,
            maxWidth: '90vw',
            transform: isMobile
              ? `translate(${config.mobileLogoOffsetX ?? config.headerImageOffsetX ?? 0}px, ${config.mobileLogoOffsetY ?? config.headerImageOffsetY ?? 0}px) scale(${config.mobileLogoScale ?? config.headerImageScale ?? 1})`
              : `translate(${config.headerImageOffsetX ?? 0}px, ${config.headerImageOffsetY ?? 0}px) scale(${config.headerImageScale ?? 1})`,
          }}
        />
      ) : (
        <>
          <h1
            className="relative z-10 font-display font-black tracking-[0.3em] uppercase mb-1 md:mb-2 text-center"
            style={{
              fontSize: `clamp(14px, 4vw, ${config.headerTitleSize}px)`,
              color: config.glowColor,
              textShadow: `0 0 30px ${config.glowColor}55`,
            }}
          >
            {config.pageTitle}
          </h1>
          <p
            className="relative z-10 font-display tracking-[0.5em] text-muted-foreground uppercase mb-4 md:mb-10 text-center"
            style={{ fontSize: `clamp(8px, 2.5vw, ${config.headerSubtitleSize}px)` }}
          >
            {config.pageSubtitle}
          </p>
        </>
      )}

      {/* Spins info */}
      {accountId && (
        <div
          className="relative z-10 mb-4 text-center"
          style={isMobile ? { transform: `translate(${config.mobileSpinsOffsetX ?? 0}px, ${config.mobileSpinsOffsetY ?? 0}px)` } : undefined}
        >
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Verificando giros...</p>
          ) : spinsRemaining !== null && spinsRemaining >= 0 ? (
            <p className="font-bold" style={{
              color: config.spinsTextColor ?? config.glowColor,
              fontSize: config.spinsTextSize ?? 14,
              fontFamily: config.spinsTextFont || undefined,
            }}>
              Giros restantes: {spinsRemaining}
            </p>
          ) : null}
          {!canSpin && message && (
            <p className="mt-1" style={{
              color: config.noSpinsTextColor ?? '#ef4444',
              fontSize: config.noSpinsTextSize ?? 14,
              fontFamily: config.noSpinsTextFont || undefined,
            }}>{message}</p>
          )}
        </div>
      )}

      {/* Wheel */}
      <div
        className="relative z-10 mb-8 md:mb-16 w-full flex items-center justify-center"
        style={isMobile ? { transform: `translate(${config.mobileWheelOffsetX ?? 0}px, ${config.mobileWheelOffsetY ?? 0}px)` } : undefined}
      >
        <div
          className="aspect-square w-[min(75vw,320px)] sm:w-[min(70vw,420px)] md:w-[min(60vw,520px)] lg:w-[min(55vw,620px)] xl:w-[min(50vw,700px)] mx-auto"
          style={isMobile ? { scale: String(config.mobileWheelScale ?? 1) } : undefined}
        >
          <PremiumWheel
            config={config}
            onSpinEnd={handleSpinEnd}
            disabled={accountId ? !canSpin : false}
            forcedSegment={fixedPrizeEnabled ? fixedPrizeSegment : null}
            isMobile={isMobile}
            onShare={handleShare}
          />
        </div>
      </div>

      {/* Spacer to push badge to bottom */}
      <div className="flex-1" />

      {/* User badge at footer */}
      {accountId && (
        <div className="relative z-10 mb-2 flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: config.badgeBgColor ?? 'rgba(20,20,30,0.85)', border: `1px solid ${(config.badgeBorderColor ?? config.glowColor)}33` }}>
          {userName && (
            <span className="text-sm font-bold font-display" style={{ color: config.badgeNameColor ?? config.glowColor }}>{userName}</span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: config.badgeLabelColor ?? '#a1a1aa' }}>ID:</span>
            <span data-share-id className="text-xs font-mono" style={{ color: config.badgeIdColor ?? '#a1a1aa' }}>{accountId}</span>
          </div>
          <button
            onClick={() => { setIdentified(false); setAccountId(''); setInputValue(''); setEmailValue(''); setUserName(null); setSearchParams({}); }}
            className="text-xs text-muted-foreground hover:text-foreground ml-1 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default Roleta;
