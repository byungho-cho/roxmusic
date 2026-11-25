import { test, expect, type Page } from '@playwright/test';

async function mockPlayer(page: Page) {
  await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.addInitScript(() => {
    const state = { loads: [] as { videoId: string; startSeconds: number; endSeconds?: number }[], instanceCount: 0, videoId: '', time: 0, state: -1, pauseCount: 0 };
    type MockOptions = { events: { onReady(event: unknown): void; onStateChange(event: unknown): void; onAutoplayBlocked(): void; onError(event: unknown): void } };
    const root = window as unknown as Record<string, unknown>;
    root.mockMusic = state;
    root.YT = { Player: class {
      options: MockOptions;
      constructor(element: HTMLElement, options: MockOptions) {
        this.options = options; state.instanceCount++;
        const iframe = document.createElement('iframe'); iframe.title = 'YouTube 공식 영상 플레이어'; element.replaceWith(iframe);
        root.emitMusicState = (data: number) => { state.state = data; options.events.onStateChange({ target: this, data }); };
        root.emitOldEnded = () => options.events.onStateChange({ target: this, data: 0 });
        root.blockMusic = () => options.events.onAutoplayBlocked();
        root.errorMusic = (data: number) => options.events.onError({ target: this, data });
        queueMicrotask(() => options.events.onReady({ target: this }));
      }
      loadVideoById(request: { videoId: string; startSeconds: number; endSeconds?: number }) {
        state.loads.push(request); state.videoId = request.videoId; state.time = request.startSeconds;
        state.state = 3; this.options.events.onStateChange({ target: this, data: 3 });
        queueMicrotask(() => { state.state = 1; this.options.events.onStateChange({ target: this, data: 1 }); });
      }
      getVideoUrl() { return 'https://www.youtube.com/watch?v=' + state.videoId; }
      getDuration() { return 180; }
      getCurrentTime() { return state.time; }
      getPlayerState() { return state.state; }
      playVideo() { state.state = 1; this.options.events.onStateChange({ target: this, data: 1 }); }
      pauseVideo() { state.pauseCount++; state.state = 2; this.options.events.onStateChange({ target: this, data: 2 }); }
      stopVideo() { state.state = -1; }
      destroy() {}
    } };
  });
}
async function add(page: Page, title: string, start: string, end: string, url = 'https://youtu.be/M7lc1UVf-VE') {
  await page.getByRole('button', { name: '영상 추가', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('YouTube URL').fill(url);
  await form.getByLabel('제목', { exact: true }).fill(title);
  await form.getByLabel('시작', { exact: true }).fill(start);
  await form.getByLabel('종료', { exact: false }).fill(end);
  await form.getByRole('button', { name: '목록에 추가' }).click();
  await expect(form).toHaveCount(0);
}
test('registration, two segments of the same video, serialized persistence, order and deletion', async ({ page }, info) => {
  await mockPlayer(page); await page.goto('/');
  await add(page, '첫 구간', '0:10', '0:20');
  await add(page, '다음 구간', '0:30', '0:40');
  await page.getByRole('button', { name: '다음 구간 위로' }).click();
  await expect(page.locator('.track-info strong')).toHaveText(['다음 구간', '첫 구간']);
  await page.reload();
  await expect(page.locator('.track-info strong')).toHaveText(['다음 구간', '첫 구간']);
  await page.getByRole('button', { name: '첫 구간 재생' }).click();
  await expect(page.locator('.now-playing h2')).toHaveText('첫 구간');
  await page.screenshot({ path: info.outputPath('playlist.png'), fullPage: true });
  expect(await page.locator('.player-frame').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.track').filter({ hasText: '첫 구간' }).getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.locator('.track-info strong')).toHaveText(['다음 구간']);
  await page.reload(); await expect(page.locator('.track-info strong')).toHaveText(['다음 구간']);
});
test('same-video queue advances once, rapid changes retain one player, autoplay block and background pause', async ({ page }) => {
  await mockPlayer(page); await page.goto('/');
  await add(page, 'A', '0:10', '0:20'); await add(page, 'B', '0:30', '0:40');
  await page.getByRole('button', { name: 'A 재생', exact: true }).click();
  await page.evaluate(() => (window as unknown as { emitMusicState: (state: number) => void }).emitMusicState(0));
  await expect(page.locator('.now-playing h2')).toHaveText('B');
  await page.evaluate(() => (window as unknown as { emitOldEnded: () => void }).emitOldEnded());
  await expect(page.locator('.now-playing h2')).toHaveText('B');
  await page.getByRole('button', { name: '이전 항목' }).click(); await page.getByRole('button', { name: '다음 항목' }).click();
  await expect(page.locator('.now-playing h2')).toHaveText('B');
  expect(await page.evaluate(() => (window as unknown as { mockMusic: { instanceCount: number } }).mockMusic.instanceCount)).toBe(1);
  await page.evaluate(() => (window as unknown as { blockMusic: () => void }).blockMusic());
  await expect(page.locator('.status')).toContainText('재생을 눌러');
  await page.getByRole('button', { name: '▶ 재생', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('music-testbed-suspend')));
  await expect(page.locator('.status')).toContainText('복귀 후');
  await page.evaluate(() => (window as unknown as { emitMusicState: (state: number) => void }).emitMusicState(1));
  await expect(page.getByRole('button', { name: '▶ 재생', exact: true })).toBeVisible();
  const events = await page.evaluate(async () => {
    const modulePath = '/src/backgroundDiagnostics.ts';
    const diagnostics = await import(modulePath);
    return diagnostics.backgroundEvents() as { event: string; reason?: string }[];
  });
  expect(events.some(entry => entry.event === 'suspend' && entry.reason === 'native_stop')).toBe(true);
  expect(events.some(entry => entry.event === 'load_requested')).toBe(true);
});
test('invalid URL and ranges stay in the form, player errors expose a recovery path', async ({ page }) => {
  await mockPlayer(page); await page.goto('/');
  await page.getByRole('button', { name: '영상 추가', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('YouTube URL').fill('https://youtube.com.evil.example/watch?v=M7lc1UVf-VE');
  await form.getByLabel('제목', { exact: true }).fill('오류');
  await form.getByRole('button', { name: '목록에 추가' }).click();
  await expect(form.getByRole('alert')).toContainText('YouTube');
  await page.keyboard.press('Escape');
  await add(page, '테스트 영상', '0:00', '');
  await page.getByRole('button', { name: '테스트 영상 재생' }).click();
  await page.evaluate(() => (window as unknown as { errorMusic: (code: number) => void }).errorMusic(153));
  await expect(page.getByRole('alert')).toContainText('Referer');
  await expect(page.getByRole('button', { name: 'YouTube에서 열기' })).toBeVisible();
});
