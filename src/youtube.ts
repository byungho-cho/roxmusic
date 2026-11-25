export type VideoRequest = { videoId: string; startSeconds: number; endSeconds?: number };
export type Player = {
  loadVideoById(request: VideoRequest): void;
  cueVideoById(request: VideoRequest): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoUrl(): string;
};
export function matchesVideo(player: Player, videoId: string): boolean {
  try { return new URL(player.getVideoUrl()).searchParams.get('v') === videoId; }
  catch { return false; }
}
export type PlayerEvent = { target: Player; data: number };
type PlayerOptions = {
  width: string;
  height: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady(event: { target: Player }): void;
    onStateChange(event: PlayerEvent): void;
    onError(event: PlayerEvent): void;
    onAutoplayBlocked(): void;
  };
};
declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: PlayerOptions) => Player };
    onYouTubeIframeAPIReady?: () => void;
  }
}
let api: Promise<NonNullable<Window['YT']>> | undefined;
export function loadYoutube(): Promise<NonNullable<Window['YT']>> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (api) return api;
  api = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      api = undefined;
      script.remove();
      reject(Error('YouTube 플레이어를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'));
    }, 15000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (window.YT) resolve(window.YT);
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      api = undefined;
      reject(Error('YouTube에 연결할 수 없습니다.'));
    };
    document.head.append(script);
  });
  return api;
}
export const playerErrors: Record<number, string> = {
  2: '영상 정보나 재생 구간을 확인해 주세요.',
  5: '이 기기의 WebView에서 재생할 수 없는 영상입니다.',
  100: '삭제되었거나 비공개인 영상입니다.',
  101: '외부 플레이어 재생이 허용되지 않은 영상입니다.',
  150: '외부 플레이어 재생이 허용되지 않은 영상입니다.',
  153: '앱 식별 정보 또는 Referer를 확인해야 합니다. 진단 정보를 확인해 주세요.',
};
