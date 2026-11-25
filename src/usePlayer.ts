import { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import type { Track } from './domain';
import { validateRange } from './domain';
import { QueueGuard, neighbor } from './queue';
import { loadYoutube, matchesVideo, playerErrors, type Player, type PlayerEvent, type VideoRequest } from './youtube';

export type Playback = { track: Track | null; status: string; playing: boolean; ready: boolean; error: string | null; errorCode?: number; time: number; duration: number; seekWarning: boolean };
const initial: Playback = { track: null, status: '영상을 등록해 주세요', playing: false, ready: false, error: null, time: 0, duration: 0, seekWarning: false };

export function usePlayer(tracks: Track[]) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const initialized = useRef(false);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const current = useRef<Track | null>(null);
  const guard = useRef(new QueueGuard());
  const suspended = useRef(false);
  const lastSample = useRef<{ time: number; at: number } | null>(null);
  const [playback, setPlayback] = useState<Playback>(initial);
  const [attempt, setAttempt] = useState(0);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  function record(message: string) {
    setDiagnostics(entries => [new Date().toLocaleTimeString('ko-KR') + ' ' + message, ...entries].slice(0, 12));
  }
  function request(track: Track) {
    const target = player.current;
    if (!target) return;
    if (!navigator.onLine) {
      setPlayback(value => ({ ...value, error: '인터넷 연결을 확인한 뒤 다시 재생해 주세요.', playing: false }));
      return;
    }
    guard.current.begin();
    current.current = track;
    lastSample.current = null;
    suspended.current = false;
    setPlayback(value => ({ ...value, track, status: '영상 불러오는 중', playing: false, error: null, errorCode: undefined, time: track.startSeconds, duration: 0, seekWarning: false }));
    const video: VideoRequest = { videoId: track.videoId, startSeconds: track.startSeconds };
    if (track.endSeconds !== null) video.endSeconds = track.endSeconds;
    target.loadVideoById(video);
    record('영상 로드 · ' + track.videoId + ' · ' + track.startSeconds + '~' + (track.endSeconds ?? '끝'));
  }
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    let alive = true;
    const root = container.current;
    if (!root) return;
    const element = document.createElement('div');
    root.append(element);
    const onStateChange = ({ target, data }: PlayerEvent) => {
      if (!alive || target !== player.current || !current.current) return;
      if (target.getPlayerState() !== data) return;
      const track = current.current;
      if (!matchesVideo(target, track.videoId)) return;
      if (data === 1) {
        if (suspended.current || document.visibilityState === 'hidden') { target.pauseVideo(); return; }
        const duration = target.getDuration();
        try {
          validateRange(track.startSeconds, track.endSeconds, duration);
        } catch (error) {
          target.pauseVideo();
          setPlayback(value => ({ ...value, playing: false, error: (error as Error).message, status: '재생 구간 확인 필요' }));
          return;
        }
        guard.current.started(guard.current.generation);
      }
      if (data === 0) {
        // An old ENDED cannot consume a new load before it actually starts playing.
        if (!guard.current.finish(guard.current.generation)) return;
        const next = neighbor(tracksRef.current, track.id, 1);
        if (next && !suspended.current && document.visibilityState !== 'hidden') {
          requestRef.current(next);
          return;
        }
        setPlayback(value => ({ ...value, playing: false, status: '재생목록이 끝났습니다' }));
        return;
      }
      const status: Record<number, string> = { [-1]: '영상 불러오는 중', 1: '재생 중', 2: '일시정지', 3: '버퍼링', 5: '재생 준비' };
      setPlayback(value => ({ ...value, playing: data === 1, status: status[data] ?? value.status }));
    };
    void loadYoutube().then(YT => {
      if (!alive) return;
      player.current = new YT.Player(element, {
        width: '100%', height: '100%',
        playerVars: { playsinline: 1, controls: 1, origin: location.origin, widget_referrer: location.origin, autoplay: 0 },
        events: {
          onReady: () => {
            if (!alive) return;
            initialized.current = true;
            setPlayback(value => ({ ...value, ready: true, status: current.current ? '재생을 눌러 주세요' : '영상을 등록해 주세요' }));
            record('플레이어 준비 · origin ' + location.origin);
          },
          onStateChange,
          onError: event => {
            if (!alive) return;
            record('YouTube 오류 ' + event.data);
            setPlayback(value => ({ ...value, playing: false, errorCode: event.data, error: playerErrors[event.data] ?? '영상을 재생할 수 없습니다.', status: '재생 오류' }));
          },
          onAutoplayBlocked: () => {
            if (!alive) return;
            record('자동재생 차단');
            setPlayback(value => ({ ...value, playing: false, status: '재생을 눌러 계속해 주세요' }));
          },
        },
      });
      const iframe = root.querySelector('iframe');
      iframe?.setAttribute('title', 'YouTube 공식 영상 플레이어');
      iframe?.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe?.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    }).catch(error => { if (alive) setPlayback(value => ({ ...value, ready: false, error: String((error as Error).message), status: '연결 확인 필요' })); });
    const timer = window.setInterval(() => {
      const target = player.current, track = current.current;
      if (!initialized.current || !target || !track || !matchesVideo(target, track.videoId)) return;
      const time = target.getCurrentTime(), duration = target.getDuration(), at = Date.now();
      const previous = lastSample.current;
      // Diagnostic only. Do not infer advertisement state or interrupt ads with a boundary timer.
      const jumped = previous !== null && Math.abs(time - previous.time) > Math.max(3, (at - previous.at) / 1000 + 2);
      lastSample.current = { time, at };
      setPlayback(value => ({ ...value, time, duration, seekWarning: value.seekWarning || (track.endSeconds !== null && jumped && target.getPlayerState() === 1) }));
    }, 500);
    return () => {
      alive = false;
      initialized.current = false;
      window.clearInterval(timer);
      player.current?.destroy();
      player.current = null;
      root.replaceChildren();
    };
  }, [attempt]);

  useEffect(() => {
    const suspend = () => {
      suspended.current = true;
      player.current?.pauseVideo();
      setPlayback(value => ({ ...value, playing: false, status: current.current ? '앱 복귀 후 재생을 눌러 주세요' : value.status }));
    };
    const visibility = () => { if (document.visibilityState === 'hidden') suspend(); };
    const offline = () => {
      suspend();
      setPlayback(value => ({ ...value, error: '네트워크가 끊겼습니다. 연결 후 다시 재생해 주세요.', status: '오프라인' }));
    };
    const subscription = App.addListener('appStateChange', state => { if (!state.isActive) suspend(); });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('music-testbed-suspend', suspend);
    window.addEventListener('offline', offline);
    return () => {
      void subscription.then(handle => handle.remove());
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('music-testbed-suspend', suspend);
      window.removeEventListener('offline', offline);
    };
  }, []);
  return {
    container, playback, diagnostics,
    play: request,
    pause: () => player.current?.pauseVideo(),
    resume: () => {
      suspended.current = false;
      if (current.current) {
        if (playback.seekWarning || playback.error || player.current?.getPlayerState() === 0) request(current.current);
        else player.current?.playVideo();
      } else if (tracks[0]) request(tracks[0]);
    },
    stop: () => {
      guard.current.begin();
      current.current = null;
      player.current?.stopVideo();
      setPlayback(value => ({ ...initial, ready: value.ready }));
    },
    reload: () => {
      if (player.current && current.current) request(current.current);
      else { setPlayback(initial); setAttempt(value => value + 1); }
    },
  };
}
