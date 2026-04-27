import { useCallback, useRef, useState } from 'react';

/**
 * Hook para controlar disparos em massa com PAUSAR / RETOMAR / PARAR.
 *
 * Uso dentro de um loop de envio:
 *
 *   const ctrl = useBulkSendControl();
 *   ctrl.start();
 *   for (...) {
 *     if (await ctrl.shouldStop()) break;     // respeita "Parar" e aguarda em "Pausar"
 *     await sendOne(...);
 *   }
 *   ctrl.finish();
 */
export function useBulkSendControl() {
  const [paused, setPausedState] = useState(false);
  const [stopped, setStoppedState] = useState(false);
  const [active, setActive] = useState(false);

  // Refs para evitar problemas de closure dentro de loops async
  const pausedRef = useRef(false);
  const stoppedRef = useRef(false);

  const start = useCallback(() => {
    pausedRef.current = false;
    stoppedRef.current = false;
    setPausedState(false);
    setStoppedState(false);
    setActive(true);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPausedState(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPausedState(false);
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    pausedRef.current = false;
    setStoppedState(true);
    setPausedState(false);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    pausedRef.current = false;
    stoppedRef.current = false;
    setPausedState(false);
    setStoppedState(false);
  }, []);

  /**
   * Deve ser chamado no início de cada iteração do loop.
   * - Retorna `true` se o disparo foi PARADO (loop deve dar `break`).
   * - Se está PAUSADO, fica aguardando até retomar ou parar.
   */
  const shouldStop = useCallback(async (): Promise<boolean> => {
    while (pausedRef.current && !stoppedRef.current) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return stoppedRef.current;
  }, []);

  return {
    paused,
    stopped,
    active,
    start,
    pause,
    resume,
    stop,
    finish,
    shouldStop,
  };
}

export type BulkSendControl = ReturnType<typeof useBulkSendControl>;
