import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
type SharedText = { id: string; text: string };
type ShareInbox = {
  consume(): Promise<{ items: SharedText[] }>;
  addListener(event: 'sharedText', callback: (item: SharedText) => void): Promise<PluginListenerHandle>;
  openYoutube(options: { videoId: string; startSeconds: number }): Promise<void>;
};
export const shareInbox = registerPlugin<ShareInbox>('ShareInbox');
export const nativeAndroid = Capacitor.getPlatform() === 'android';
export async function openYoutube(videoId: string, startSeconds: number): Promise<void> {
  if (nativeAndroid) {
    await shareInbox.openYoutube({ videoId, startSeconds });
  } else {
    window.open('https://www.youtube.com/watch?v=' + videoId + '&t=' + Math.floor(startSeconds) + 's', '_blank', 'noopener');
  }
}
