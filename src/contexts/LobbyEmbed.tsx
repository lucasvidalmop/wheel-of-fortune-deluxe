import { createContext, useContext, ReactNode } from 'react';
import type { LobbySession } from '@/lib/lobbySession';

export interface LobbyEmbedValue {
  session: LobbySession;
  onExitToLobby: () => void;
  onSignOut: () => void;
}

const Ctx = createContext<LobbyEmbedValue | null>(null);

export const LobbyEmbedProvider = ({ value, children }: { value: LobbyEmbedValue; children: ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export function useLobbyEmbed(): LobbyEmbedValue | null {
  return useContext(Ctx);
}
