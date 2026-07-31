import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Assina alterações em tempo real do evento e dos participantes.
 * Dispara `onChange` (debounced pelo próprio consumidor) a cada evento.
 */
export function useRaffleRealtime(eventId: string | undefined, onChange: () => void) {
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`raffle_${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'raffle_participants', filter: `event_id=eq.${eventId}` },
        () => onChange())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'raffle_events', filter: `id=eq.${eventId}` },
        () => onChange())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
}
