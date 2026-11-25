import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatTime, parseTime, parseYoutube, validateRange, type Track } from './domain';
import { loadTracks, saveTracks } from './storage';
import { nativeAndroid, openYoutube, shareInbox } from './native';
import { usePlayer } from './usePlayer';
import packageInfo from '../package.json';

type Draft = { url: string; title: string; artist: string; start: string; end: string };
const blank: Draft = { url: '', title: '', artist: '', start: '0:00', end: '' };

export default function Application() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const tracksRef = useRef(tracks);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const savingRef = useRef(false);
  const music = usePlayer(tracks);
  const pauseRef = useRef(music.pause);
  pauseRef.current = music.pause;
  const { playback } = music;
  const selected = playback.track;

  useEffect(() => {
    let alive = true;
    void loadTracks().then(value => {
      if (alive) { tracksRef.current = value; setTracks(value); setLoaded(true); }
    }).catch(() => { if (alive) setStorageError('재생목록을 읽지 못했습니다. 저장된 원본을 보존했습니다. 앱을 다시 열어 주세요.'); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!nativeAndroid) return;
    let alive = true;
    const seen = new Set<string>();
    const receive = (item: { id: string; text: string }) => {
      if (!alive || seen.has(item.id)) return;
      seen.add(item.id);
      try {
        const parsed = parseYoutube(item.text);
        pauseRef.current();
        setDraft({ ...blank, url: parsed.sourceUrl, start: formatTime(parsed.startSeconds) });
        setEditing(null); setFormError(null); setShowForm(true);
      } catch (error) { setMessage((error as Error).message); }
    };
    const listener = shareInbox.addListener('sharedText', item => {
      receive(item);
      void shareInbox.consume().then(result => result.items.forEach(receive)).catch(() => { if (alive) setMessage('공유 내용을 읽지 못했습니다. URL을 직접 붙여넣어 주세요.'); });
    });
    void listener.then(() => shareInbox.consume()).then(result => result.items.forEach(receive)).catch(() => {
      if (alive) setMessage('공유 수신을 준비하지 못했습니다. URL을 직접 붙여넣어 주세요.');
    });
    return () => { alive = false; void listener.then(handle => handle.remove()); };
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const previous = document.activeElement as HTMLElement | null;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) { event.preventDefault(); setShowForm(false); }
      if (event.key !== 'Tab') return;
      const controls = document.querySelectorAll<HTMLElement>('.dialog button:not(:disabled),.dialog input,.dialog textarea');
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [showForm, saving]);

  async function persist(next: Track[]): Promise<boolean> {
    if (!loaded || savingRef.current) return false;
    savingRef.current = true; setSaving(true);
    try {
      await saveTracks(next);
      tracksRef.current = next;
      setTracks(next);
      setStorageError(null);
      return true;
    } catch {
      setMessage('저장하지 못했습니다. 변경 전 목록을 유지했습니다. 다시 시도해 주세요.');
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  }

  function edit(track: Track) {
    music.pause();
    setEditing(track.id);
    setDraft({ url: track.sourceUrl, title: track.title, artist: track.artist ?? '', start: formatTime(track.startSeconds), end: track.endSeconds === null ? '' : formatTime(track.endSeconds) });
    setFormError(null); setShowForm(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const parsed = parseYoutube(draft.url), start = parseTime(draft.start), end = draft.end.trim() ? parseTime(draft.end) : null;
      if (!draft.title.trim()) throw Error('목록에 표시할 제목을 입력해 주세요.');
      validateRange(start, end, selected?.videoId === parsed.videoId ? playback.duration : undefined);
      const previous = tracksRef.current.find(track => track.id === editing);
      const track: Track = {
        id: previous?.id ?? crypto.randomUUID(), videoId: parsed.videoId, sourceUrl: parsed.sourceUrl,
        title: draft.title.trim(), ...(draft.artist.trim() ? { artist: draft.artist.trim() } : {}),
        startSeconds: start, endSeconds: end, createdAt: previous?.createdAt ?? new Date().toISOString(),
      };
      const next = previous ? tracksRef.current.map(item => item.id === track.id ? track : item) : [...tracksRef.current, track];
      if (await persist(next)) {
        if (selected?.id === editing) music.stop();
        setShowForm(false); setDraft(blank); setEditing(null);
      }
    } catch (error) { setFormError((error as Error).message); }
  }
  function fillUrl() {
    if (!draft.url.trim()) return;
    try {
      const parsed = parseYoutube(draft.url);
      setDraft(value => ({ ...value, url: parsed.sourceUrl, start: value.start === '0:00' ? formatTime(parsed.startSeconds) : value.start }));
      setFormError(null);
    } catch (error) { setFormError((error as Error).message); }
  }
  function markTime(field: 'start' | 'end') {
    try {
      if (!selected || !playback.duration) throw Error('먼저 영상을 재생해 주세요.');
      if (parseYoutube(draft.url).videoId !== selected.videoId) throw Error('현재 재생 중인 영상과 등록 영상이 다릅니다.');
      setDraft(value => ({ ...value, [field]: formatTime(playback.time) }));
      setFormError(null);
    } catch (error) { setFormError((error as Error).message); }
  }
  async function remove(track: Track) {
    if (!window.confirm('“' + track.title + '” 항목을 삭제할까요?')) return;
    if (await persist(tracksRef.current.filter(item => item.id !== track.id))) {
      if (selected?.id === track.id) music.stop();
    }
  }
  async function move(index: number, delta: number) {
    const next = [...tracksRef.current], target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    await persist(next);
  }
  function skip(direction: number) {
    const index = tracks.findIndex(track => track.id === selected?.id);
    const next = tracks[index + direction];
    if (next) music.play(next);
  }
  const index = tracks.findIndex(track => track.id === selected?.id);
  return <main className="app">
    <header className="header">
      <div><span className="eyebrow">MY VIDEO QUEUE</span><h1>RoxMusic<span>{packageInfo.version}</span></h1></div>
      <button className="add circle" aria-label="영상 추가" disabled={!loaded || saving} onClick={() => { music.pause(); setDraft(blank); setEditing(null); setFormError(null); setShowForm(true); }}>＋</button>
    </header>
    <section className="player-section" aria-label="영상 재생">
      <div className="player-frame">
        <div className="player-mount" ref={music.container} />
        {!selected && <div className="player-empty"><span className="play-symbol">▶</span><p>당신의 음악, 원하는 구간부터.</p><small>영상을 추가하고 재생을 눌러 주세요.</small></div>}
      </div>
      <div className="now-playing">
        <div className="status"><span className={playback.playing ? 'dot active' : 'dot'} />{playback.status}</div>
        <h2>{selected?.title ?? '재생할 영상을 골라 주세요'}</h2>
        <p className="artist">{selected?.artist ?? (selected ? 'YouTube' : 'YouTube 공식 플레이어')}</p>
        {selected && <div className="timing"><span>{formatTime(playback.time)} <span className="muted">/ {playback.duration ? formatTime(playback.duration) : '—'}</span></span><span className="segment">{formatTime(selected.startSeconds)} — {selected.endSeconds === null ? '끝까지' : formatTime(selected.endSeconds)}</span></div>}
        <div className="transport">
          <button aria-label="이전 항목" disabled={!playback.ready || index <= 0} onClick={() => skip(-1)}>이전</button>
          <button className="primary play-toggle" disabled={!playback.ready || tracks.length === 0} onClick={() => playback.playing ? music.pause() : music.resume()}>{playback.playing ? 'Ⅱ 일시정지' : '▶ 재생'}</button>
          <button aria-label="다음 항목" disabled={!playback.ready || index >= tracks.length - 1} onClick={() => skip(1)}>다음</button>
        </div>
        {playback.error && <div className="notice error" role="alert"><p>{playback.error}{playback.errorCode ? ' (' + playback.errorCode + ')' : ''}</p><button onClick={music.reload}>다시 시도</button>{selected && <button onClick={() => void openYoutube(selected.videoId, selected.startSeconds).catch(() => setMessage('YouTube를 열지 못했습니다.'))}>YouTube에서 열기 ↗</button>}</div>}
        {!playback.ready && playback.error && <button className="secondary" onClick={music.reload}>플레이어 연결 다시 시도</button>}
        {playback.seekWarning && <div className="notice"><p>탐색 후 구간 종료가 유지되지 않을 수 있습니다.</p><button onClick={music.reload}>지정 구간 다시 시작</button></div>}
      </div>
    </section>
    {storageError && <div className="notice error" role="alert">{storageError}</div>}
    {message && <div className="notice" role="status"><p>{message}</p><button onClick={() => setMessage(null)}>닫기</button></div>}
    <section className="playlist" aria-label="재생목록">
      <div className="section-heading"><h2>재생목록 <span>{tracks.length}</span></h2><span className="muted">{saving ? '저장 중…' : '이 기기에 저장'}</span></div>
      {!loaded && !storageError && <p className="empty-list">재생목록을 읽는 중입니다.</p>}
      {loaded && tracks.length === 0 && <div className="empty-list"><h3>좋아하는 장면을 모아 보세요.</h3><p>YouTube URL로 영상 전체나 한 구간을 등록할 수 있어요.</p><button className="secondary" onClick={() => { setDraft(blank); setEditing(null); setShowForm(true); }}>첫 영상 추가</button></div>}
      <ol className="track-list">{tracks.map((track, position) => <li key={track.id} className={selected?.id === track.id ? 'track selected' : 'track'}>
        <button className="track-select" aria-label={track.title + ' 재생'} disabled={!playback.ready} onClick={() => music.play(track)}>
          <span className="track-number">{selected?.id === track.id && playback.playing ? '♫' : String(position + 1).padStart(2, '0')}</span>
          <span className="track-info"><strong>{track.title}</strong><span>{track.artist ? track.artist + ' · ' : ''}{formatTime(track.startSeconds)} — {track.endSeconds === null ? '끝까지' : formatTime(track.endSeconds)}</span></span>
          <span className="track-play">▶</span>
        </button>
        <div className="track-actions"><button aria-label={track.title + ' 위로'} disabled={position === 0 || saving} onClick={() => void move(position, -1)}>↑</button><button aria-label={track.title + ' 아래로'} disabled={position === tracks.length - 1 || saving} onClick={() => void move(position, 1)}>↓</button><button disabled={saving} onClick={() => edit(track)}>편집</button><button disabled={saving} onClick={() => void remove(track)}>삭제</button><button onClick={() => void openYoutube(track.videoId, track.startSeconds).catch(() => setMessage('YouTube를 열지 못했습니다.'))}>YouTube ↗</button></div>
      </li>)}</ol>
    </section>
    <footer>
      <p>화면이 켜진 상태에서 사용해 주세요. 앱을 벗어나면 재생을 멈춥니다.</p>
      <details><summary>테스트 안내 · 진단</summary>
        <p>Premium 적용과 광고 발생 여부는 실기기 검증 전입니다. 계정 로그인은 제공하지 않습니다.</p>
        <p>YouTube에서 열면 구간 자동 종료·연속 재생은 보장되지 않습니다.</p>
        <p>기본 구간은 공식 endSeconds를 사용합니다. 플레이어에서 탐색한 뒤의 종료 경계는 미검증입니다. 프리미어·라이브는 지원 범위 밖입니다.</p>
        <p>앱 식별 주소 <code>{location.origin}</code></p>
        <p>진단에는 영상 ID·상태·오류 코드만 표시하며 목록과 함께 저장하지 않습니다.</p>
        <ul className="diagnostics">{music.diagnostics.map((entry, i) => <li key={i}>{entry}</li>)}</ul>
      </details>
    </footer>
    {showForm && <div className="dialog-backdrop">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="section-heading"><h2 id="form-title">{editing ? '항목 편집' : '영상 추가'}</h2><button aria-label="등록창 닫기" disabled={saving} onClick={() => setShowForm(false)}>✕</button></div>
        <form onSubmit={event => void submit(event)}>
          <label>YouTube URL<textarea autoFocus value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} onBlur={fillUrl} placeholder="https://youtu.be/…" required rows={2} /></label>
          <label>제목<input value={draft.title} maxLength={200} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="목록에 표시할 제목" required /></label>
          <label>가수 <span className="muted">선택</span><input value={draft.artist} maxLength={100} onChange={event => setDraft({ ...draft, artist: event.target.value })} placeholder="가수 또는 채널" /></label>
          <div className="time-fields">
            <div><label>시작<input value={draft.start} onChange={event => setDraft({ ...draft, start: event.target.value })} placeholder="0:00" inputMode="text" /></label><button type="button" onClick={() => markTime('start')}>현재 시각</button></div>
            <div><label>종료 <span className="muted">선택</span><input value={draft.end} onChange={event => setDraft({ ...draft, end: event.target.value })} placeholder="영상 끝까지" inputMode="text" /></label><button type="button" onClick={() => markTime('end')}>현재 시각</button></div>
          </div>
          <p className="form-hint">MM:SS 또는 HH:MM:SS · 종료를 비우면 끝까지 재생합니다.</p>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-buttons"><button type="button" disabled={saving} onClick={() => setShowForm(false)}>취소</button><button className="primary" disabled={saving || !loaded} type="submit">{saving ? '저장 중…' : editing ? '변경 저장' : '목록에 추가'}</button></div>
        </form>
      </section>
    </div>}
  </main>;
}
