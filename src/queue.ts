import type { Track } from './domain';

/** Only a playing, current request can consume an end event, and it can do so once. */
export class QueueGuard {
  generation = 0;
  private playing = false;
  private ended = false;
  begin(): number {
    this.generation += 1;
    this.playing = false;
    this.ended = false;
    return this.generation;
  }
  started(generation: number): void {
    if (generation === this.generation) this.playing = true;
  }
  finish(generation: number): boolean {
    if (generation !== this.generation || !this.playing || this.ended) return false;
    this.ended = true;
    return true;
  }
}
export function neighbor(tracks: Track[], id: string, direction: -1 | 1): Track | undefined {
  const index = tracks.findIndex(track => track.id === id);
  return index < 0 ? undefined : tracks[index + direction];
}
