import { useEffect } from 'react';

/**
 * Bloqueia ferramentas de desenvolvedor no site em produção:
 * - Desativa menu de contexto (clique direito)
 * - Bloqueia atalhos comuns: F12, Ctrl+Shift+I/J/C, Ctrl+U, Cmd+Opt+I/J/C, Cmd+U
 * - Detecta DevTools aberto (diferença de window outer/inner) e redireciona para about:blank
 *
 * Observação: nenhuma técnica client-side é 100% à prova de bypass, mas isso impede o uso casual.
 * Desabilitado em ambientes de desenvolvimento/preview para não atrapalhar o trabalho.
 */
export const useBlockDevtools = () => {
  useEffect(() => {
    const host = window.location.hostname;
    const isDev =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.lovable.app') ||
      host.endsWith('.lovableproject.com') ||
      host.endsWith('.lovable.dev');
    if (isDev) return;

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd + Shift + I/J/C/K
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) {
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd + U (view source)
      if ((e.ctrlKey || e.metaKey) && key === 'u') {
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd + S (save page)
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        return;
      }
    };

    // Atenção: a antiga detecção por diferença outerWidth/innerWidth foi removida
    // porque gerava falso-positivo (barra lateral do navegador, zoom, mobile com
    // teclado virtual, monitor secundário) e causava tela branca ao limpar o body.

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
};
