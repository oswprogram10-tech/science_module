import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers';

// 교사 앱(교사 PC 수업 서버가 내보내는 화면, 포트 8790)의 「튜터 모델 고르기」: 두 예시 모델의 답을 견주고, 반에서 쓸 모델을 고른다.
const HOST = 'http://localhost:8790/';
const picker = (page: Page) => page.getByRole('dialog', { name: '튜터 모델 고르기' });

async function openPicker(page: Page) {
  await page.goto(HOST);
  await page.getByRole('button', { name: '튜터 모델 고르기' }).click();
  await expect(picker(page)).toBeVisible();
  await expect(picker(page).getByTestId('mp-sample').first()).toBeVisible(); // 비교 자료를 따로 불러온다
}

test.describe('튜터 모델 고르기', () => {
  test('모델을 고르고 답을 평가하면 이 PC에 남는다', async ({ page }) => {
    await openPicker(page);
    const d = picker(page);
    await expect(d).toContainText('아직 모델을 고르지 않았어요');
    // 수업 서버가 내보낸 화면이므로 모델 파일 넣기 칸이 있다(준비 중 표시는 없다).
    await expect(d.getByTestId('mp-files')).toBeVisible();
    await expect(d).not.toContainText('준비 중');

    await d.getByTestId('mp-model-qwen3-1.7b').getByRole('button', { name: '이 모델 쓰기' }).click();
    await expect(d).toContainText('이 반에서 쓸 모델: Qwen3 1.7B');

    // 기본은 이름을 가리고 답 A·B로 보여 준다.
    const first = d.getByTestId('mp-sample').first();
    await expect(first).toContainText('답 A');
    await expect(first).not.toContainText('Qwen3 1.7B');
    await first.getByRole('button', { name: '답 A가 더 나아요' }).click();
    await expect(d.getByTestId('mp-tally')).toContainText('평가한 문항 1/');
    await d.getByRole('button', { name: '모델 이름 보기' }).click();
    await expect(first.getByRole('button', { name: /(Qwen3 4B \(고사양 기기용\)|Qwen3 1.7B)가 더 나아요/ }).first()).toHaveAttribute('aria-pressed', 'true');

    // 아직 평가하지 않은 문항만: 방금 평가한 문항이 빠진다.
    const firstText = (await first.locator('.mp-situation').textContent()) ?? '';
    await d.getByRole('button', { name: '아직 평가하지 않은 문항만' }).click();
    await expect(d.getByTestId('mp-sample').first().locator('.mp-situation')).not.toHaveText(firstText);
    // 거른 채로 평가해도 그 문항은 이번에 보는 동안 남고, 누른 단추에 포커스가 남는다.
    const next = d.getByTestId('mp-sample').first();
    const nextText = (await next.locator('.mp-situation').textContent()) ?? '';
    const voteBtn = next.getByRole('group', { name: '1번 문항: 어느 답이 더 나은가요?' }).getByRole('button', { name: '비슷해요' });
    await voteBtn.click();
    await expect(d.getByTestId('mp-sample').first().locator('.mp-situation')).toHaveText(nextText);
    await expect(voteBtn).toBeFocused();
    await expect(d.getByTestId('mp-tally')).toContainText('평가한 문항 2/');
    await voteBtn.click(); // 다시 누르면 평가를 지운다
    await expect(d.getByTestId('mp-tally')).toContainText('평가한 문항 1/');

    // 어려운 말 문항만 거른다.
    await d.getByLabel('문항 종류').selectOption('redteam');
    await expect(d.getByTestId('mp-sample').first()).toContainText('어려운 말:');

    // 닫았다가 새로고침해도 남아 있다(교사 PC의 브라우저 저장소).
    await d.getByRole('button', { name: '닫기' }).click();
    await expect(picker(page)).toHaveCount(0);
    await openPicker(page);
    await expect(picker(page)).toContainText('이 반에서 쓸 모델: Qwen3 1.7B');
    await expect(picker(page).getByTestId('mp-tally')).toContainText('평가한 문항 1/');
    await page.keyboard.press('Escape');
    await expect(picker(page)).toHaveCount(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`화면 접근성(${scheme === 'light' ? '밝게' : '어둡게'})과 좁은 화면에서 가로 스크롤이 없다`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openPicker(page);
      await picker(page).getByRole('button', { name: '자동 검사에 걸린 문항만' }).click(); // 검사 표시(주황 칩)도 대비를 본다
      await picker(page).getByTestId('mp-model-qwen3-4b').getByRole('button', { name: '이 모델 쓰기' }).click();
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `폭 ${width}`).toEqual([]);
        const overflow = await page.evaluate(() => document.querySelector('.te-backdrop')!.scrollWidth - document.querySelector('.te-backdrop')!.clientWidth);
        expect(overflow, `폭 ${width}: 가로 스크롤`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('모델 파일 넣기: 올리면 sha256이 보이고 목록에 나오며, 수업의 학생에게 알림이 가고 모둠 카드에 받기 상태가 보인다', async ({ page, request, errors }) => {
    await openPicker(page);
    const d = picker(page);
    const files = d.getByTestId('mp-files');
    // 모델을 고르기 전에는 넣을 수 없다.
    await expect(files.getByLabel(/^모델 파일 넣기/)).toBeDisabled();
    await d.getByTestId('mp-model-qwen3-4b').getByRole('button', { name: '이 모델 쓰기' }).click();

    // 모델이 아닌 파일은 거절한다.
    await files.getByLabel(/^모델 파일 넣기/).setInputFiles({ name: 'bad.gguf', mimeType: 'application/octet-stream', buffer: Buffer.from('not a model file') });
    await expect(d.getByRole('alert').filter({ hasText: '모델 파일(GGUF)이 아니에요' })).toBeVisible();
    // 서버가 400으로 거절한 요청을 브라우저가 콘솔 오류로 남긴다. 의도한 것이므로 이 한 건만 뺀다.
    const rejected = errors.findIndex((e) => e.includes('status of 400'));
    expect(rejected).toBeGreaterThanOrEqual(0);
    errors.splice(rejected, 1);

    // 가짜 GGUF(머리 4바이트 + 채움)를 올린다.
    const fake = Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(300_000, 9)]);
    const sha = createHash('sha256').update(fake).digest('hex');
    await files.getByLabel(/^모델 파일 넣기/).setInputFiles({ name: 'qwen3-4b-q4_k_m.gguf', mimeType: 'application/octet-stream', buffer: fake });
    await expect(d.getByTestId('mp-upload-state')).toContainText(sha);
    await expect(d.getByTestId('mp-upload-state')).toContainText('Qwen3 4B');
    await expect(d.getByTestId('mp-file-qwen3-4b')).toContainText(sha);
    await expect(d.getByTestId('mp-file-qwen3-4b')).toContainText('있어요');
    await expect(d.getByTestId('mp-host-state')).toContainText('이 PC에 모델 파일이 있어요');

    // 서버: 목록과 Range 내려받기(교실 LAN 누구나)
    const list = (await (await request.get('http://localhost:8790/tutor-models')).json()) as Array<{ id: string; size: number; sha256: string }>;
    expect(list.find((m) => m.id === 'qwen3-4b')).toEqual({ id: 'qwen3-4b', size: fake.length, sha256: sha });
    const part = await request.get('http://localhost:8790/tutor-models/qwen3-4b.gguf', { headers: { range: 'bytes=0-3' } });
    expect(part.status()).toBe(206);
    expect(part.headers()['content-range']).toBe(`bytes 0-3/${fake.length}`);
    expect((await part.body()).toString()).toBe('GGUF');

    // 수업을 만들면 서버가 학생에게 tutorModel을 보내고, 학생이 알린 받기 상태가 모둠 카드에 보인다.
    await d.getByRole('button', { name: '닫기' }).click();
    await page.getByRole('button', { name: '수업 만들기' }).click();
    const code = (await page.getByTestId('class-code').textContent())!.trim();
    const got = await page.evaluate(
      ({ code }) =>
        new Promise<unknown>((resolve, reject) => {
          const ws = new WebSocket('ws://localhost:8790/ws');
          (window as unknown as { __student: WebSocket }).__student = ws;
          const timer = setTimeout(() => reject(new Error('tutorModel을 받지 못했어요')), 5000);
          ws.onopen = () => ws.send(JSON.stringify({ t: 'join', code, group: 4, deviceTier: 'A', appVersion: '0.0.0' }));
          ws.onmessage = (e) => {
            const m = JSON.parse(String(e.data)) as { t: string };
            if (m.t === 'tutorModel') {
              clearTimeout(timer);
              ws.send(JSON.stringify({ t: 'status', phase: 'idle', trials: 0, safetyLocked: false, model: 'downloading' }));
              resolve(m);
            }
          };
        }),
      { code },
    );
    expect(got).toEqual({ t: 'tutorModel', model: { id: 'qwen3-4b', sha256: sha, size: fake.length } });
    await expect(page.getByTestId('model-chip-4')).toHaveText('튜터 모델 받는 중');
    const sendStatus = (model: string) =>
      page.evaluate((model) => (window as unknown as { __student: WebSocket }).__student.send(JSON.stringify({ t: 'status', phase: 'idle', trials: 0, safetyLocked: false, model })), model);
    await sendStatus('ready');
    await expect(page.getByTestId('model-chip-4')).toHaveText('튜터 모델 준비됨');
    await sendStatus('error');
    await expect(page.getByTestId('model-chip-4')).toHaveText('튜터 모델 오류');
    await sendStatus('none');
    await expect(page.getByTestId('model-chip-4')).toHaveCount(0);
  });

  test('수업 서버가 내보낸 화면이 아니면(미리보기 교사 화면) 모델 파일 넣기가 없다', async ({ page }) => {
    await page.goto('http://localhost:4175/');
    await page.getByRole('button', { name: '튜터 모델 고르기' }).click();
    const d = picker(page);
    await expect(d.getByTestId('mp-not-hosted')).toContainText('수업 서버가 켜진 PC');
    await expect(d.getByTestId('mp-files')).toHaveCount(0);
  });
});
