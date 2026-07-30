import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveParticipant {
  id: string;
  event_id: string;
  account_id: string;
  user_email: string;
  user_name: string;
  entry_number: number;
  has_won: boolean;
  wheel_user_id: string | null;
  created_at: string;
}

export interface LiveRoom {
  id: string;
  tag: string;
  name: string;
  status: string;
  is_active: boolean;
  created_at: string;
}

const slugify = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** Gerencia a "sala ao vivo" do operador (uma sala aberta por vez). */
export const useLiveRoom = (ownerId?: string, enabled = false) => {
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoom = useCallback(async () => {
    if (!ownerId) return null;
    const { data } = await (supabase as any)
      .from('gorjeta_events')
      .select('id, tag, name, status, is_active, created_at')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .neq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(1);
    const next = (data?.[0] as LiveRoom) || null;
    setRoom(next);
    return next;
  }, [ownerId]);

  const fetchParticipants = useCallback(async (eventId?: string) => {
    if (!eventId) { setParticipants([]); return; }
    const { data } = await (supabase as any)
      .from('gorjeta_event_participants')
      .select('id, event_id, account_id, user_email, user_name, entry_number, has_won, wheel_user_id, created_at')
      .eq('event_id', eventId)
      .order('entry_number', { ascending: true });
    setParticipants((data as LiveParticipant[]) || []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetchRoom();
    await fetchParticipants(r?.id);
    setLoading(false);
  }, [fetchRoom, fetchParticipants]);

  useEffect(() => {
    if (!enabled || !ownerId) return;
    refresh();
    pollRef.current = setInterval(() => {
      setRoom((current) => {
        if (current) fetchParticipants(current.id);
        return current;
      });
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
  }, [enabled, ownerId, refresh, fetchParticipants]);

  const openRoom = useCallback(async (name: string, tagInput?: string) => {
    if (!ownerId) return null;
    setBusy(true);
    const base = slugify(tagInput || name || 'live') || 'live';
    const tag = `${base}-${Date.now().toString(36).slice(-4)}`;
    const { data, error } = await (supabase as any)
      .from('gorjeta_events')
      .insert({
        owner_id: ownerId,
        tag,
        name: name || 'Sala ao vivo',
        status: 'live',
        is_active: true,
        require_pix: false,
      })
      .select('id, tag, name, status, is_active, created_at')
      .single();
    setBusy(false);
    if (error) throw error;
    setRoom(data as LiveRoom);
    setParticipants([]);
    return data as LiveRoom;
  }, [ownerId]);

  const closeRoom = useCallback(async () => {
    if (!room) return;
    setBusy(true);
    await (supabase as any)
      .from('gorjeta_events')
      .update({ status: 'finished', is_active: false })
      .eq('id', room.id);
    setBusy(false);
    setRoom(null);
    setParticipants([]);
  }, [room]);

  const markWon = useCallback(async (participantId: string) => {
    await (supabase as any).from('gorjeta_event_participants')
      .update({ has_won: true }).eq('id', participantId);
    setParticipants((p) => p.map((x) => (x.id === participantId ? { ...x, has_won: true } : x)));
  }, []);

  const link = room ? `${window.location.origin}/live=${room.tag}` : '';

  return { room, participants, loading, busy, openRoom, closeRoom, refresh, markWon, link };
};
