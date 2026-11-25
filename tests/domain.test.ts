import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTime, parseTime, parseYoutube, readLibrary, validateRange, type Track } from '../src/domain.ts';

const videoId = 'M7lc1UVf-VE';
const track: Track = { id: 'clip-a', videoId, sourceUrl: 'https://www.youtube.com/watch?v=' + videoId, title: '테스트 영상', startSeconds: 10, endSeconds: 20, createdAt: '2026-11-25T00:00:00Z' };
test('supported YouTube links normalize to a canonical URL and preserve the initial start time', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=' + videoId + '&t=1m20s',
    'https://youtu.be/' + videoId + '?t=80',
    'https://m.youtube.com/shorts/' + videoId + '?start=80',
    'https://www.youtube.com/embed/' + videoId + '#t=80s',
    '공유한 영상 제목\nhttps://youtu.be/' + videoId + '?t=80',
  ]) {
    assert.deepEqual(parseYoutube(url), { videoId, sourceUrl: track.sourceUrl, startSeconds: 80 });
  }
});
test('lookalike hosts, credentials, unsafe schemes, invalid IDs and playlist-only URLs are rejected', () => {
  for (const url of [
    'https://youtube.com.evil.example/watch?v=' + videoId,
    'https://evil.example/youtu.be/' + videoId,
    'https://account:secret@youtube.com/watch?v=' + videoId,
    'javascript:alert(1)', 'https://youtube.com/watch?v=short',
    'https://youtube.com/playlist?list=PL123', 'https://youtube.com:8443/watch?v=' + videoId,
  ]) assert.throws(() => parseYoutube(url));
});
test('time input handles hour boundaries and rejects malformed or excessive values', () => {
  assert.equal(parseTime('02:03'), 123);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime(''), 0);
  assert.equal(formatTime(3723), '1:02:03');
  assert.equal(formatTime(59.8), '0:59');
  for (const value of ['1:60', '1:99:00', '-1:00', '1.5:00', '12', '999999999999999999:00']) assert.throws(() => parseTime(value));
});
test('unknown duration can be validated later without accepting reversed or oversized ranges', () => {
  validateRange(10, 20);
  validateRange(10, null, 60);
  validateRange(10, 60, 60);
  assert.throws(() => validateRange(20, 20));
  assert.throws(() => validateRange(0, -1));
  assert.throws(() => validateRange(60, null, 60));
  assert.throws(() => validateRange(10, 61, 60));
});
test('library restores stable IDs, duplicate-video segments and order', () => {
  const second = { ...track, id: 'clip-b', startSeconds: 30, endSeconds: 40 };
  const library = { version: 1, tracks: [second, track] };
  assert.deepEqual(readLibrary(JSON.stringify(library)), library);
  assert.deepEqual(readLibrary(null), { version: 1, tracks: [] });
});
test('corrupt, future-schema and invalid persisted data never silently become an empty library', () => {
  for (const value of ['{', JSON.stringify({ version: 2, tracks: [] }), JSON.stringify({ version: 1, tracks: [track, track] }),
    JSON.stringify({ version: 1, tracks: [{ ...track, endSeconds: 5 }] }),
    JSON.stringify({ version: 1, tracks: [{ ...track, videoId: 'aaaaaaaaaaa' }] })]) assert.throws(() => readLibrary(value));
});
