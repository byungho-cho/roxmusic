import assert from 'node:assert/strict';
import test from 'node:test';
import { QueueGuard, neighbor } from '../src/queue.ts';
import type { Track } from '../src/domain.ts';
const tracks: Track[] = ['a', 'b', 'c'].map((id, index) => ({ id, videoId: 'M7lc1UVf-VE', sourceUrl: 'https://youtu.be/M7lc1UVf-VE', title: id, startSeconds: index * 20, endSeconds: index * 20 + 10, createdAt: '2026-11-25T00:00:00Z' }));
test('the same video can advance to a distinct segment and the final item has no successor', () => {
  assert.equal(neighbor(tracks, 'a', 1)?.id, 'b');
  assert.equal(neighbor(tracks, 'b', -1)?.id, 'a');
  assert.equal(neighbor(tracks, 'c', 1), undefined);
  assert.equal(neighbor(tracks, 'deleted-id', 1), undefined);
});
test('ended events before playing or from a previous generation cannot advance the queue', () => {
  const guard = new QueueGuard();
  const first = guard.begin();
  assert.equal(guard.finish(first), false);
  guard.started(first);
  const second = guard.begin();
  assert.equal(guard.finish(first), false);
  guard.started(first);
  assert.equal(guard.finish(second), false);
  guard.started(second);
  assert.equal(guard.finish(second), true);
  assert.equal(guard.finish(second), false);
});
