import { Preferences } from '@capacitor/preferences';
import { readLibrary, type Track } from './domain';
const key = 'music-testbed.library';
let tail: Promise<void> = Promise.resolve();
export async function loadTracks() {
  const result = await Preferences.get({ key });
  return readLibrary(result.value).tracks;
}
export function saveTracks(tracks: Track[]): Promise<void> {
  const value = JSON.stringify({ version: 1, tracks });
  const write = tail.then(() => Preferences.set({ key, value }));
  tail = write.catch(() => undefined);
  return write;
}
