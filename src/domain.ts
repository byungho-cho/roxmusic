export type Track = {
  id: string;
  videoId: string;
  sourceUrl: string;
  title: string;
  artist?: string;
  startSeconds: number;
  endSeconds: number | null;
  createdAt: string;
};
export type Library = { version: 1; tracks: Track[] };
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const hosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);

export function parseTime(input: string): number {
  const value = input.trim();
  if (!value) return 0;
  if (!/^\d+(?::\d{1,2}){1,2}$/.test(value)) throw Error('시간은 MM:SS 또는 HH:MM:SS로 입력해 주세요.');
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some(part => part > 59)) throw Error('분·초는 00~59 사이로 입력해 주세요.');
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  if (!Number.isSafeInteger(seconds)) throw Error('시간이 너무 큽니다.');
  return seconds;
}

export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor(safe / 60) % 60;
  const rest = String(safe % 60).padStart(2, '0');
  return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + rest : Math.floor(safe / 60) + ':' + rest;
}

function urlTime(input: string | null): number {
  if (!input) return 0;
  if (/^\d+$/.test(input)) {
    const seconds = Number(input);
    return Number.isSafeInteger(seconds) ? seconds : 0;
  }
  const match = input.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match[0]) return 0;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return Number.isSafeInteger(seconds) ? seconds : 0;
}

export function parseYoutube(input: string): { videoId: string; sourceUrl: string; startSeconds: number } {
  const urls = input.trim().match(/https?:\/\/[^\s<>"「」]+/g) ?? [input.trim()];
  for (const candidate of urls) {
    let url: URL;
    try { url = new URL(candidate); } catch { continue; }
    if (!['https:', 'http:'].includes(url.protocol) || !hosts.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) continue;
    const parts = url.pathname.split('/').filter(Boolean);
    const videoId = url.hostname.endsWith('youtu.be') ? parts.length === 1 ? parts[0] : null
      : url.pathname === '/watch' ? url.searchParams.get('v')
      : parts.length === 2 && ['shorts', 'embed'].includes(parts[0] ?? '') ? parts[1] : null;
    if (!videoId || !videoIdPattern.test(videoId)) continue;
    const startSeconds = urlTime(url.searchParams.get('t') ?? url.searchParams.get('start') ?? new URLSearchParams(url.hash.slice(1)).get('t'));
    return { videoId, startSeconds, sourceUrl: 'https://www.youtube.com/watch?v=' + videoId };
  }
  throw Error('지원하는 YouTube 영상 URL을 입력해 주세요.');
}

export function validateRange(start: number, end: number | null, duration?: number): void {
  if (!Number.isSafeInteger(start) || start < 0 || (end !== null && (!Number.isSafeInteger(end) || end <= start))) {
    throw Error('종료 시각은 시작 시각보다 뒤여야 합니다.');
  }
  if (duration !== undefined && duration > 0 && (start >= duration || (end !== null && end > duration))) {
    throw Error('재생 구간이 영상 길이를 벗어납니다.');
  }
}

export function readLibrary(raw: string | null): Library {
  if (raw === null) return { version: 1, tracks: [] };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('tracks' in value) || !Array.isArray(value.tracks)) {
    throw Error('지원하지 않거나 손상된 재생목록입니다. 원본 데이터는 보존했습니다.');
  }
  const ids = new Set<string>();
  for (const item of value.tracks as unknown[]) {
    if (!item || typeof item !== 'object') throw Error('재생목록 항목을 읽을 수 없습니다.');
    const track = item as Track;
    if (typeof track.id !== 'string' || !track.id || ids.has(track.id) || typeof track.title !== 'string' || !track.title.trim() ||
      !videoIdPattern.test(track.videoId) || typeof track.sourceUrl !== 'string' ||
      (track.artist !== undefined && typeof track.artist !== 'string') || !Number.isFinite(Date.parse(track.createdAt))) {
      throw Error('재생목록 항목을 읽을 수 없습니다. 원본 데이터는 보존했습니다.');
    }
    validateRange(track.startSeconds, track.endSeconds);
    if (parseYoutube(track.sourceUrl).videoId !== track.videoId) throw Error('재생목록 영상 정보가 일치하지 않습니다.');
    ids.add(track.id);
  }
  return value as Library;
}
