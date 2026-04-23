import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import PremiumWheel from '@/components/casino/PremiumWheel';
import { useIsMobile } from '@/hooks/use-mobile';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [isResolvingSpin, setIsResolvingSpin] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [fixedPrizeEnabled, setFixedPrizeEnabled] = useState(false);
  const [fixedPrizeSegment, setFixedPrizeSegment] = useState<number | null>(null);
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const [showPostLoginDialog, setShowPostLoginDialog] = useState(false);
  const [showPrizeHistory, setShowPrizeHistory] = useState(false);
  const [prizeHistory, setPrizeHistory] = useState<any[]>([]);
  const [prizeHistoryLoading, setPrizeHistoryLoading] = useState(false);

  const maskId = (id: string) => {
    if (id.length <= 3) return '***';
    return id.substring(0, 2) + '*'.repeat(Math.max(3, id.length - 4)) + id.substring(id.length - 2);
  };

  const extractPrizeAmount = (segment: WheelConfig['segments'][number]) => {
    const currencyHint = /(?:r\$|brl|reais?)/i;
    const nonCashHint = /(?:giro|giros|spin|spins|perdeu|amanh[ãa]|tente|brinde|cupom)/i;

    const parseAmount = (value: string) => {
      const match = value.replace(/\s+/g, '').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?/);
      if (!match) return 0;

      const raw = match[0];
      const normalized = raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');

      const amount = Number(normalized);
      return Number.isFinite(amount) ? amount : 0;
    };

    const title = segment.title?.trim() || '';
    const reward = segment.reward?.trim() || '';
    const message = segment.postSpinMessage?.trim() || '';
    const candidates = [title, reward, message].filter(Boolean);

    const explicitMoneyText = candidates.find((value) => currencyHint.test(value));
    if (explicitMoneyText) return parseAmount(explicitMoneyText);

    const rewardLooksNumeric = /^-?\d+(?:[.,]\d+)?$/.test(reward.replace(/\s+/g, ''));
    if (rewardLooksNumeric && !nonCashHint.test(title)) {
      return parseAmount(reward);
    }

    return 0;
  };


  const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

  const handleShare = useCallback(async (prizeName: string) => {
    if (!pageRef.current) return;

    try {
      const W = 1080;
      const H = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // 1. Background: solid color from operator config
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);

      // 2. Background image from operator config
      if (config.backgroundImageUrl) {
        try {
          const bgImg = await loadImage(config.backgroundImageUrl);
          const scale = Math.max(W / bgImg.width, H / bgImg.height);
          const dw = bgImg.width * scale;
          const dh = bgImg.height * scale;
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
          ctx.restore();
        } catch {}
      }

      // 3. Gradient overlay
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.4)');
      grad.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 4. Glow effect using operator's glowColor
      const glowColor = config.glowColor || '#FFD700';
      const glow = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 450);
      glow.addColorStop(0, `${glowColor}55`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // 5. Draw wheel manually using operator's config colors
      const cx = W / 2;
      const cy = H / 2;
      const wheelR = 360;
      const innerR = 70;
      const segments = config.segments;
      const segAngle = (2 * Math.PI) / segments.length;

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, wheelR + 30, 0, Math.PI * 2);
      ctx.fillStyle = config.outerRingColor || '#8B8B8B';
      ctx.fill();

      // Inner wheel background
      ctx.beginPath();
      ctx.arc(cx, cy, wheelR, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();

      // Draw segments with operator colors
      segments.forEach((seg, i) => {
        const startAngle = i * segAngle - Math.PI / 2;
        const endAngle = startAngle + segAngle;

        // Segment fill with operator color
        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle));
        ctx.arc(cx, cy, wheelR - 18, startAngle, endAngle);
        ctx.lineTo(cx + innerR * Math.cos(endAngle), cy + innerR * Math.sin(endAngle));
        ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();

        // Gradient overlay
        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle));
        ctx.arc(cx, cy, wheelR - 18, startAngle, endAngle);
        ctx.lineTo(cx + innerR * Math.cos(endAngle), cy + innerR * Math.sin(endAngle));
        ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = seg.gradientOverlay;
        ctx.fill();

        // Divider line
        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle));
        ctx.lineTo(cx + (wheelR - 18) * Math.cos(startAngle), cy + (wheelR - 18) * Math.sin(startAngle));
        ctx.strokeStyle = config.dividerColor || '#C0C0C0';
        ctx.lineWidth = config.dividerWidth ?? 3;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Segment text with operator colors
        if (!config.hideSegmentText) {
          const midAngle = startAngle + segAngle / 2;
          const textR = wheelR * 0.62;
          const tx = cx + textR * Math.cos(midAngle);
          const ty = cy + textR * Math.sin(midAngle);
          const s = config.fontSizeScale ?? 1;
          const vSize = (config.valueFontSize ?? 22) * s * 1.5;
          const tSize = (config.titleFontSize ?? 10) * s * 1.5;

          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(midAngle + Math.PI / 2);
          ctx.textAlign = 'center';

          const showValue = !config.hideSegmentValue && !seg.hideValue;
          const showTitle = !config.hideSegmentTitle && !seg.hideTitle;

          // Value (reward number)
          if (showValue) {
            ctx.fillStyle = seg.textColor;
            ctx.font = `900 ${vSize}px 'Orbitron', Arial, sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(seg.reward, 0, showTitle ? -tSize * 0.5 : 0);
          }

          // Title
          if (showTitle) {
            ctx.fillStyle = seg.textColor;
            ctx.font = `700 ${tSize}px 'Orbitron', Arial, sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(seg.title, 0, showValue ? vSize * 0.5 : 0);
          }

          ctx.restore();
        }
      });

      // LEDs on outer ring
      const numLeds = 36;
      const ledSize = config.ledSize ?? 5;
      for (let i = 0; i < numLeds; i++) {
        const angle = (i * 2 * Math.PI / numLeds) - Math.PI / 2;
        const lx = cx + (wheelR + 15) * Math.cos(angle);
        const ly = cy + (wheelR + 15) * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(lx, ly, ledSize * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 !== 0 ? (config.ledColor || '#FFE033') : '#333';
        ctx.fill();
      }

      // Center cap
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      const capGrad = ctx.createRadialGradient(cx - 10, cy - 10, 0, cx, cy, innerR);
      capGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
      capGrad.addColorStop(0.4, config.centerCapColor || '#2a2a2a');
      capGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = capGrad;
      ctx.fill();

      // Center image if exists
      if (config.centerImageUrl) {
        try {
          const centerImg = await loadImage(config.centerImageUrl);
          const cSize = innerR * 1.4;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, innerR - 3, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(centerImg, cx - cSize / 2, cy - cSize / 2, cSize, cSize);
          ctx.restore();
        } catch {}
      }

      // 6. Prize text at bottom with operator's glow color
      ctx.textAlign = 'center';
      ctx.fillStyle = glowColor;
      ctx.font = '900 42px Arial, sans-serif';
      ctx.shadowColor = `${glowColor}88`;
      ctx.shadowBlur = 20;
      ctx.fillText(`🎉 ${prizeName}`, W / 2, H - 60);
      ctx.shadowBlur = 0;

      // Export
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha')), 'image/png');
      });
      const file = new File([blob], 'meu-premio.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ganhei: ${prizeName}!`, text: `🎉 Eu ganhei ${prizeName}!` });
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
  }, [config]);

  // Load config from slug
  useEffect(() => {
    if (!slug) {
      navigate('/', { replace: true });
      return;
    }
    (async () => {
      const { data, error } = await (supabase as any)
        .rpc('get_wheel_config_by_slug', { p_slug: slug });
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || error) {
        toast.error('Roleta não encontrada');
        navigate('/', { replace: true });
        return;
      }
      setOwnerId(row.user_id);
      if (row.config && Object.keys(row.config).length > 0) {
        setConfig({ ...defaultConfig, ...row.config });
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
          owner_id: row.user_id,
          referrer: document.referrer || null,
          page_url: window.location.href,
          page_type: 'roleta',
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

      // OG meta tags for link preview
      const ogImage = config.ogImageUrl;
      const setOgMeta = (property: string, content: string) => {
        let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
        if (!el) { el = document.createElement('meta'); (el as HTMLMetaElement).setAttribute('property', property); document.head.appendChild(el); }
        (el as HTMLMetaElement).setAttribute('content', content);
      };
      if (title) {
        setOgMeta('og:title', title);
        setOgMeta('twitter:title', title);
      }
      if (desc) {
        setOgMeta('og:description', desc);
        setOgMeta('twitter:description', desc);
      }
      if (ogImage) {
        setOgMeta('og:image', ogImage);
        setOgMeta('twitter:image', ogImage);
      }
      setOgMeta('og:type', 'website');
      setOgMeta('og:url', window.location.href);
      setOgMeta('twitter:card', 'summary_large_image');
    };
    applyGlobalFallback();
  }, [config.seoTitle, config.seoDescription, config.faviconUrl, config.ogImageUrl]);

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
          setIsBlacklisted(row.blacklisted ?? false);
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
    setIsBlacklisted(data.blacklisted ?? false);
    if (data.owner_id) setOwnerId(data.owner_id);
    if (data.spins_available < 1) setMessage('Sem giros disponíveis');
    setIdentified(true);
    if (config.postLoginDialogEnabled) setShowPostLoginDialog(true);
    setAuthLoading(false);
  };

  const handleSpinEnd = async (segmentIndex: number) => {
    const seg = config.segments[segmentIndex];
    if (!seg || !accountId || isResolvingSpin) return;

    setIsResolvingSpin(true);
    setCanSpin(false);

    try {
      const { data: spinResultId } = await (supabase as any).rpc('record_spin_result', {
        p_account_id: accountId,
        p_user_name: userName || '',
        p_user_email: emailValue,
        p_prize: seg.title || `Segmento ${segmentIndex + 1}`,
        p_owner_id: ownerId || null,
      });

      // Create prize_payment record via security definer function
      const prizeValue = extractPrizeAmount(seg);
      if (ownerId && prizeValue > 0) {
        try {
          const { data: ppResult, error: ppError } = await (supabase as any).rpc('create_prize_payment', {
            p_owner_id: ownerId,
            p_account_id: accountId,
            p_user_name: userName || '',
            p_user_email: emailValue,
            p_prize: seg.title || `Segmento ${segmentIndex + 1}`,
            p_amount: prizeValue,
            p_spin_result_id: spinResultId || null,
            p_force_auto: !!seg.autoPayment,
          });

          if (ppError) {
            console.error('Failed to create prize_payment:', ppError);
          } else if ((ppResult?.auto_payment || seg.autoPayment) && ppResult?.id) {
            try {
              await supabase.functions.invoke('edpay-pix-transfer', {
                body: { paymentId: ppResult.id, autoPayment: true },
              });
            } catch (autoErr) {
              console.error('Auto-payment trigger failed:', autoErr);
            }
          } else if (ownerId) {
            try {
              await supabase.functions.invoke('send-owner-notification', {
                body: {
                  ownerId,
                  type: 'payment_pending',
                  payload: {
                    userName: userName || '',
                    userEmail: emailValue,
                    prize: seg.title || `Segmento ${segmentIndex + 1}`,
                    amount: prizeValue,
                    accountId,
                  },
                },
              });
            } catch (notifyErr) {
              console.error('Pending payment notification failed:', notifyErr);
            }
          }
        } catch (e) {
          console.error('Failed to create prize_payment:', e);
        }
      }

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
        setMessage(row.spins_available < 1 ? 'Sem giros disponíveis' : '');
        if (!ownerId && row.owner_id) setOwnerId(row.owner_id);
      }
    } catch (error) {
      console.error('Failed to resolve spin:', error);

      const { data: refreshData } = await (supabase as any).rpc('get_wheel_user_spins', {
        p_account_id: accountId,
        p_owner_id: ownerId || null,
      });
      const refreshedRow = Array.isArray(refreshData) ? refreshData[0] : refreshData;
      if (refreshedRow) {
        setSpinsRemaining(refreshedRow.spins_available);
        setCanSpin(refreshedRow.spins_available >= 1);
        setMessage(refreshedRow.spins_available < 1 ? 'Sem giros disponíveis' : '');
        if (!ownerId && refreshedRow.owner_id) setOwnerId(refreshedRow.owner_id);
      }
    } finally {
      setIsResolvingSpin(false);
    }

    // Auto-redirect invisível após ver o prêmio
    if (config.autoRedirectEnabled && config.autoRedirectUrl) {
      const delaySec = config.autoRedirectDelaySec ?? 3;
      setTimeout(() => {
        window.open(config.autoRedirectUrl, '_blank', 'noopener,noreferrer');
      }, delaySec * 1000);
    }
  };

  const fetchPrizeHistory = async () => {
    if (!accountId || !ownerId) return;
    setPrizeHistoryLoading(true);
    const { data } = await (supabase as any).rpc('get_prize_history', {
      p_account_id: accountId,
      p_owner_id: ownerId,
    });
    setPrizeHistory(data || []);
    setPrizeHistoryLoading(false);
  };

  const openPrizeHistory = () => {
    fetchPrizeHistory();
    setShowPrizeHistory(true);
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
    const isMobileView = window.innerWidth < 768;
    const bgImage = isMobileView && ac.authBgImageMobileUrl ? ac.authBgImageMobileUrl : ac.authBgImageUrl;
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{
        background: bgImage
          ? `url(${bgImage}) center/cover no-repeat`
          : ac.authBgColor ?? '#1a0a2e',
      }}>
        {!bgImage && (
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
          <div className="flex items-start justify-between pointer-events-none" style={{ position: 'relative', zIndex: 0 }}>
            <div className="flex-1">
              {(ac.authHeaderMode === 'logo' || ac.authHeaderMode === 'logo_text') && ac.authLogoUrl && (
                <img
                  src={ac.authLogoUrl}
                  alt="Logo"
                  className="object-contain mb-3 pointer-events-none"
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
          <div className="space-y-1.5" style={{ position: 'relative', zIndex: 10 }}>
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
                position: 'relative',
                zIndex: 10,
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
      {(config.headerMode === 'image' || config.headerMode === 'image_text') && config.headerImageUrl && (
        <img
          src={config.headerImageUrl}
          alt="Header"
          className="relative z-10 mb-2 md:mb-4 object-contain max-h-16 md:max-h-none"
          style={{
            height: config.headerImageSize,
            maxWidth: '90vw',
            transform: isMobile
              ? `translate(${config.mobileLogoOffsetX ?? config.headerImageOffsetX ?? 0}px, ${config.mobileLogoOffsetY ?? config.headerImageOffsetY ?? 0}px) scale(${config.mobileLogoScale ?? config.headerImageScale ?? 1})`
              : `translate(${config.headerImageOffsetX ?? 0}px, ${config.headerImageOffsetY ?? 0}px) scale(${config.headerImageScale ?? 1})`,
          }}
        />
      )}
      {(config.headerMode === 'text' || config.headerMode === 'image_text') && (
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
            disabled={accountId ? (!canSpin || isResolvingSpin) : false}
            forcedSegment={
              fixedPrizeEnabled ? fixedPrizeSegment
              : (isBlacklisted && (config as any).blacklistFixedSegmentEnabled && (config as any).blacklistFixedSegment != null)
                ? (config as any).blacklistFixedSegment
                : null
            }
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
            data-close-btn
            onClick={() => { setIdentified(false); setAccountId(''); setInputValue(''); setEmailValue(''); setUserName(null); }}
            className="text-xs text-muted-foreground hover:text-foreground ml-1 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Prize History Button */}
      {accountId && config.prizeHistoryBtnEnabled !== false && (
        <button
          onClick={openPrizeHistory}
          className="relative z-10 mb-2 font-bold uppercase tracking-wider transition-all hover:brightness-110"
          style={{
            background: config.prizeHistoryBtnBgColor ?? config.buttonColor ?? '#FFD700',
            color: config.prizeHistoryBtnTextColor ?? config.buttonTextColor ?? '#000000',
            border: `1px solid ${config.prizeHistoryBtnBorderColor ?? 'transparent'}`,
            borderRadius: config.prizeHistoryBtnBorderRadius ?? 8,
            fontSize: isMobile
              ? (config.prizeHistoryBtnMobileFontSize ?? config.prizeHistoryBtnFontSize ?? 12)
              : (config.prizeHistoryBtnFontSize ?? 12),
            paddingLeft: config.prizeHistoryBtnPaddingX ?? 20,
            paddingRight: config.prizeHistoryBtnPaddingX ?? 20,
            paddingTop: config.prizeHistoryBtnPaddingY ?? 8,
            paddingBottom: config.prizeHistoryBtnPaddingY ?? 8,
          }}
        >
          🏆 {config.prizeHistoryBtnText || 'VER MEUS PRÊMIOS'}
        </button>
      )}

      {/* Prize History Modal */}
      {showPrizeHistory && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowPrizeHistory(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            style={{
              background: config.prizeHistoryModalBgColor ?? '#140c28',
              border: `1px solid ${config.prizeHistoryModalBorderColor ?? '#ffffff14'}`,
              borderRadius: config.prizeHistoryModalBorderRadius ?? 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: config.prizeHistoryModalBorderColor ?? '#ffffff14' }}>
              <h3 className="font-bold text-lg" style={{ color: config.prizeHistoryModalTitleColor ?? '#FFD700' }}>
                🏆 Meus Prêmios
              </h3>
              <button onClick={() => setShowPrizeHistory(false)} className="text-lg opacity-50 hover:opacity-100 transition" style={{ color: config.prizeHistoryModalTextColor ?? '#ffffff' }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {prizeHistoryLoading ? (
                <p className="text-center text-sm animate-pulse" style={{ color: config.prizeHistoryModalTextColor ?? '#ffffffaa' }}>Carregando...</p>
              ) : prizeHistory.length === 0 ? (
                <p className="text-center text-sm py-8" style={{ color: config.prizeHistoryModalTextColor ?? '#ffffffaa' }}>Nenhum prêmio encontrado.</p>
              ) : (
                prizeHistory.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{
                      background: `${config.prizeHistoryModalAccentColor ?? config.glowColor ?? '#FFD700'}10`,
                      border: `1px solid ${config.prizeHistoryModalAccentColor ?? config.glowColor ?? '#FFD700'}20`,
                    }}
                  >
                    <div>
                      <p className="font-bold text-sm" style={{ color: config.prizeHistoryModalAccentColor ?? config.glowColor ?? '#FFD700' }}>{p.prize}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: config.prizeHistoryModalTextColor ?? '#ffffffaa' }}>
                        {new Date(p.spun_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span className="text-lg">🎰</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post-login dialog overlay */}
      {showPostLoginDialog && config.postLoginDialogEnabled && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            backgroundColor: `${config.postLoginDialogBackdropColor ?? '#000000'}${Math.round((config.postLoginDialogBackdropOpacity ?? 70) * 2.55).toString(16).padStart(2, '0')}`,
          }}
          onClick={() => setShowPostLoginDialog(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: isMobile
                ? (config.postLoginDialogMobileWidth ?? config.postLoginDialogWidth ?? 400)
                : (config.postLoginDialogWidth ?? 400),
              maxWidth: '90vw',
              background: config.postLoginDialogBgColor ?? '#140c28',
              border: `${config.postLoginDialogBorderWidth ?? 1}px solid ${config.postLoginDialogBorderColor ?? '#ffffff14'}`,
              borderRadius: config.postLoginDialogBorderRadius ?? 12,
              paddingLeft: isMobile ? (config.postLoginDialogMobilePaddingX ?? config.postLoginDialogPaddingX ?? 20) : (config.postLoginDialogPaddingX ?? 24),
              paddingRight: isMobile ? (config.postLoginDialogMobilePaddingX ?? config.postLoginDialogPaddingX ?? 20) : (config.postLoginDialogPaddingX ?? 24),
              paddingTop: isMobile ? (config.postLoginDialogMobilePaddingY ?? config.postLoginDialogPaddingY ?? 20) : (config.postLoginDialogPaddingY ?? 24),
              paddingBottom: isMobile ? (config.postLoginDialogMobilePaddingY ?? config.postLoginDialogPaddingY ?? 20) : (config.postLoginDialogPaddingY ?? 24),
              boxShadow: `0 ${config.postLoginDialogShadowSize ?? 20}px ${(config.postLoginDialogShadowSize ?? 20) * 3}px ${config.postLoginDialogShadowColor ?? 'rgba(0,0,0,0.6)'}`,
            }}
          >
            <div className="flex justify-end mb-1">
              <button
                onClick={() => setShowPostLoginDialog(false)}
                style={{ color: config.postLoginDialogCloseBtnColor ?? 'rgba(255,255,255,0.4)' }}
                className="hover:opacity-80 transition text-lg leading-none"
              >✕</button>
            </div>
            <h3 style={{
              color: config.postLoginDialogTitleColor ?? '#ffffff',
              fontSize: isMobile
                ? (config.postLoginDialogMobileTitleSize ?? config.postLoginDialogTitleSize ?? 20)
                : (config.postLoginDialogTitleSize ?? 20),
              fontWeight: config.postLoginDialogTitleBold !== false ? 700 : 400,
              fontStyle: config.postLoginDialogTitleItalic ? 'italic' : 'normal',
              fontFamily: config.postLoginDialogTitleFont ?? 'Inter',
              textAlign: config.postLoginDialogTextAlign ?? 'left',
              marginBottom: 10,
            }}>
              {config.postLoginDialogTitle || ''}
            </h3>
            <p style={{
              color: config.postLoginDialogTextColor ?? '#ffffffcc',
              fontSize: isMobile
                ? (config.postLoginDialogMobileBodySize ?? config.postLoginDialogBodySize ?? 14)
                : (config.postLoginDialogBodySize ?? 14),
              lineHeight: 1.6,
              fontWeight: config.postLoginDialogBodyBold ? 700 : 400,
              fontStyle: config.postLoginDialogBodyItalic ? 'italic' : 'normal',
              fontFamily: config.postLoginDialogBodyFont ?? 'Inter',
              textAlign: config.postLoginDialogTextAlign ?? 'left',
              whiteSpace: 'pre-wrap',
              marginBottom: (config.postLoginDialogBtnText || config.postLoginDialogBtnUrl) ? 16 : 0,
            }}>
              {config.postLoginDialogBody || ''}
            </p>
            {config.postLoginDialogBtnEnabled !== false && (config.postLoginDialogBtnText || config.postLoginDialogBtnUrl) && (
              <a
                href={config.postLoginDialogBtnUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowPostLoginDialog(false)}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: config.postLoginDialogBtnBgColor ?? '#0ABACC',
                  color: config.postLoginDialogBtnTextColor ?? '#000000',
                  fontSize: isMobile
                    ? (config.postLoginDialogMobileBtnFontSize ?? config.postLoginDialogBtnFontSize ?? 14)
                    : (config.postLoginDialogBtnFontSize ?? 14),
                  fontWeight: 700,
                  borderRadius: config.postLoginDialogBtnBorderRadius ?? 8,
                  padding: '10px 24px',
                  textDecoration: 'none',
                  transition: 'filter 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
                onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                {config.postLoginDialogBtnText || 'Acessar'}
              </a>
            )}
            {config.postLoginDialogAgreeEnabled && (
              <button
                onClick={() => setShowPostLoginDialog(false)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 12,
                  textAlign: 'center',
                  background: config.postLoginDialogAgreeBgColor ?? '#22c55e',
                  color: config.postLoginDialogAgreeTextColor ?? '#ffffff',
                  fontSize: config.postLoginDialogAgreeFontSize ?? 14,
                  fontWeight: 700,
                  borderRadius: config.postLoginDialogAgreeBorderRadius ?? 8,
                  padding: '10px 24px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'filter 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
                onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                {config.postLoginDialogAgreeText || 'Concordo'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Roleta;
