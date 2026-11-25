import { Capacitor, registerPlugin } from '@capacitor/core';

export type DiagnosticEvent = 'player_ready' | 'player_state' | 'player_error' | 'load_requested' |
  'autoplay_blocked' | 'suspend' | 'visibility' | 'pagehide' | 'app_state' | 'offline' | 'online' | 'timer_sample';
type PlayerSnapshot = { reason?: string; playerState?: number; position?: number; duration?: number };
type Entry = PlayerSnapshot & { event: DiagnosticEvent; timestamp: string; hidden: boolean };
const entries: Entry[] = [];
const native = registerPlugin<{ record(entry: Entry): Promise<void> }>('BackgroundDiagnostics');

/** Diagnostic only. This module never calls a player method or changes lifecycle behavior. */
export function recordBackground(event: DiagnosticEvent, snapshot: PlayerSnapshot = {}): void {
  const entry: Entry = {
    event,
    timestamp: new Date().toISOString(),
    hidden: typeof document !== 'undefined' && document.visibilityState === 'hidden',
    ...snapshot,
  };
  entries.push(entry);
  if (entries.length > 100) entries.shift();
  if (Capacitor.getPlatform() === 'android') {
    void native.record(entry).catch(() => { /* Logging failure cannot change playback. */ });
  }
}
export function backgroundEvents(): readonly Entry[] {
  return entries.map(entry => ({ ...entry }));
}
