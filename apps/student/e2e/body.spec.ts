import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, sensor, createClass, joinClass } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const organs = (page: Page) => page.getByRole('figure', { name: '몸속 기관 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });

// 움직임 줄이기: 몸속 기관 그림의 requestAnimationFrame 반복이 멈춰, 가짜 시계로 시간을 건너뛰는 시험이 빨라진다.
test.use({ reducedMotion: 'reduce' });

const KIND = '운동 종류';
const MINUTES = '운동 시간';
const WRIST = '맥박을 잰 손목';
const NOTICE = '⚠ 이 화면의 맥박은 가상 친구의 값이에요. 내 맥박은 손목을 짚어 직접 세어 봐요.';

async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 처음 실행이면 안전 점검표를 거치고, 이미 확인했으면 바로 재생된다. */
async function run(page: Page, prediction: string, firstTime = false) {
  await predict(page, prediction);
  await runButton(page).click();
  if (firstTime) await confirmSafetyDialog(page);
  else await expect(page.getByRole('dialog')).toHaveCount(0);
  await finishRun(page);
}

/** 기준 시행(걷기, 1분, 왼손)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '늘어난다', true);
}

/** 결과표 한 줄의 값: 운동 종류, 시간, 손목 다음의 맥박, 호흡, 돌아오는 시간 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 6);
}

test('점검표를 거쳐 기준 시행(걷기, 1분, 왼손)을 하면 111, 28, 2.5가 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await expect(page.getByRole('heading', { level: 1, name: '우리 몸의 구조와 기능' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 운동을 하면 맥박과 호흡은 어떻게 달라질까?')).toBeVisible();
  for (const term of ['심박출량', '산소 포화도', '헤모글로빈', '폐활량', '자율 신경']) await expect(page.getByText(term)).toHaveCount(0);
  await selectIV(page, KIND);
  await predict(page, '늘어난다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('어지럽거나 숨이 너무 차면 바로 멈춰요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await resultCells(resultRows(page).first())).toEqual(['111', '28', '2.5']);
  for (const name of ['운동 직후 맥박(회/분)', '운동 직후 호흡(회/분)', '돌아오는 데 걸린 시간(분)']) {
    await expect(page.getByRole('columnheader', { name })).toBeVisible();
  }
  await expect(page.getByText(NOTICE)).toBeVisible();
  await expect(page.getByText('가상 맥박계')).toBeVisible();
  await expect(sensor(page, '맥박')).toContainText('회/분');
});

test('운동 종류를 제자리 달리기로 바꾸면 158, 늘어났다이고 운동 종류 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await baselineRun(page, KIND);
  await setValue(page, KIND, '제자리 달리기');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['158', '42', '4.0']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('운동 종류만 바꾸었어요. 몸속 기관 그림에서 심장과 폐는 어떻게 달라 보였나요? 몸이 무엇을 더 필요로 했을까요?');
  await expect(macro(page).locator('[data-pose=run]')).toBeVisible();
});

test('새 페이지에서 손목만 바꾸면 111, 28, 2.5 그대로이고 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await baselineRun(page, WRIST);
  await setValue(page, WRIST, '오른손 손목');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['111', '28', '2.5']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('손목만 바꾸었을 때 결과가 달라졌나요?');
  await expect(macro(page).getByText('오른손 손목').first()).toBeVisible();
});

test('운동 시간 3분 걷기는 115, 29, 2.7이다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await baselineRun(page, MINUTES);
  await setValue(page, MINUTES, '3분');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['115', '29', '2.7']);
  await expect(macro(page).getByText('4:00 · 맥박 115회/분 · 호흡 29회/분')).toBeVisible();
});

test('"가상 친구" 라벨과 기관 라벨 세 개가 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await expect(macro(page).getByText('가상 친구', { exact: true })).toBeVisible();
  for (const label of ['심장', '폐', '혈관']) await expect(organs(page).getByText(label, { exact: true })).toBeVisible();
  await expect(organs(page).getByText('심장은 혈액을 온몸으로 보내고, 폐는 숨을 쉬어 공기를 들이마셔요.')).toBeVisible();
  await expect(macro(page).getByText('쉬는 중', { exact: true })).toBeVisible();
  // 움직임 줄이기에서는 그림이 멈추고 숫자만 보여 준다.
  await expect(organs(page).locator('svg')).toHaveAttribute('data-animating', 'false');
  await expect(organs(page).getByTestId('organ-numbers')).toContainText('맥박 85회/분 · 호흡 20회/분');
});

test('재생이 끝나면 플레이헤드가 운동 끝에 있다(문구의 시간이 2:00)', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await baselineRun(page, KIND);
  await expect(macro(page).getByText('2:00 · 맥박 111회/분 · 호흡 28회/분')).toBeVisible();
  await expect(macro(page).getByText('운동 후 쉬는 중', { exact: true })).toBeVisible();
  await expect(slider(page)).toHaveAttribute('aria-valuenow', '2');
  const markers = graph(page).getByTestId('graph-marker');
  await expect(markers).toHaveCount(2);
  await expect(markers.nth(0)).toContainText('운동 시작');
  await expect(markers.nth(1)).toContainText('운동 끝');
  // 슬라이더를 따라 그림이 바뀐다.
  const s = slider(page);
  await s.focus();
  await s.press('Home');
  await expect(macro(page).getByText('0:00 · 맥박 85회/분 · 호흡 20회/분')).toBeVisible();
  await s.press('End');
  await expect(macro(page).getByText(/^10:00 · 맥박 \d+회\/분/)).toBeVisible();
});

test('그래프: 두 선(맥박 실선·호흡 점선)과 범례, x 라벨 "시간(분)" 눈금 0~10', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await baselineRun(page, KIND);
  await expect(graph(page).getByTestId('graph-series')).toHaveCount(2);
  await expect(graph(page).getByTestId('graph-legend-item')).toHaveCount(2);
  await expect(graph(page).getByText('맥박(회/분)')).toBeVisible();
  await expect(graph(page).getByText('호흡(회/분)')).toBeVisible();
  await expect(graph(page).getByText('시간(분)', { exact: true })).toBeVisible();
  const ticks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(ticks).toEqual(['0', '2', '4', '6', '8', '10']);
});

test.describe('1280x800 화면', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function renderedFontSizes(svg: Locator, selector = 'text') {
    return svg.evaluate((el, sel) => {
      const s = el as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll(sel)].map((t) => ({
        text: (t.textContent ?? '').trim(),
        px: parseFloat(getComputedStyle(t).fontSize) * scale,
      }));
    }, selector);
  }

  test('그림과 그래프 표식의 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g5-body');
    const check = async () => {
      for (const name of ['눈으로 보기', '몸속 기관 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await setValue(page, KIND, '제자리 달리기');
    await check();
    await setValue(page, KIND, '가만히 앉아 있기');
    await setValue(page, WRIST, '오른손 손목');
    await check();
    await selectIV(page, KIND);
    await setValue(page, KIND, '제자리 달리기');
    await run(page, '늘어난다', true);
    await check();
    const markers = await renderedFontSizes(graph(page).getByRole('slider'), '[data-testid=graph-marker] text');
    expect(markers).toHaveLength(2);
    for (const { text, px } of markers) expect(px, `그래프 표식: "${text}"`).toBeGreaterThanOrEqual(13);
  });
});

// ---- 내 맥박 재기(선택): 사양 §0 H1~H5, §4.1 ----

const panel = (page: Page) => page.locator('details.real-pulse');
const slot = (page: Page, key: 'before' | 'after' | 'later') => panel(page).locator(`[data-slot=${key}]`);
const CONSENT_NOTICE = '내 맥박은 사람마다 달라요. 가상 친구와 똑같지 않아도 괜찮아요.';

async function openPanel(page: Page) {
  await panel(page).locator('summary').click();
}
async function grant(page: Page) {
  await page.getByRole('dialog', { name: '내 맥박 재기' }).getByRole('button', { name: '허가할게요' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
/** 15초 재기 → 센 횟수 입력 → 기록. 가짜 시계(page.clock)로 15초를 건너뛴다. */
async function measureWithClock(page: Page, key: 'before' | 'after' | 'later', count: number) {
  const row = slot(page, key);
  await row.getByRole('button', { name: '15초 재기' }).click();
  await expect(row.getByRole('timer')).toContainText('남은 시간 15초');
  await page.clock.runFor(16_000);
  await row.getByLabel('15초 동안 센 횟수').fill(String(count));
  await row.getByRole('button', { name: '기록(×4)' }).click();
}

/** localStorage, sessionStorage, IndexedDB(모든 DB의 모든 기록), Cache API를 글자로 덤프한다. */
async function dumpStorage(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const out: Record<string, unknown> = {
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
      caches: {} as Record<string, string[]>,
      idb: {} as Record<string, Record<string, unknown[]>>,
    };
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      (out.caches as Record<string, string[]>)[name] = (await c.keys()).map((r) => r.url);
    }
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(info.name!);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const stores: Record<string, unknown[]> = {};
      for (const sn of Array.from(db.objectStoreNames)) {
        stores[sn] = await new Promise<unknown[]>((res, rej) => {
          const q = db.transaction(sn).objectStore(sn).getAll();
          q.onsuccess = () => res(q.result);
          q.onerror = () => rej(q.error);
        });
      }
      db.close();
      (out.idb as Record<string, unknown>)[info.name] = stores;
    }
    return JSON.stringify(out);
  });
}

/** JSON 안에 그 숫자(값)나 그 숫자 글자가 있는지(타임스탬프 같은 글자 속 우연한 일치는 숫자 값만 본다). */
function containsNumber(json: unknown, n: number): boolean {
  if (typeof json === 'number') return json === n;
  if (Array.isArray(json)) return json.some((x) => containsNumber(x, n));
  if (json && typeof json === 'object') return Object.values(json).some((x) => containsNumber(x, n));
  return false;
}

test('허가 전에는 측정 버튼이 비활성이고, 허가 화면은 쉬운 말로 다섯 가지를 알려 준다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await expect(panel(page)).not.toHaveAttribute('open', '');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openPanel(page);
  const dialog = page.getByRole('dialog', { name: '내 맥박 재기' });
  await expect(dialog).toBeVisible();
  for (const t of ['내 맥박을 재서 가상 친구와 비교해 볼 수 있어요.', '잰 값은 이 기기 안에만 잠깐 두고 서버로 보내지 않아요.', '바로 지워져요.', '언제든 그만둘 수 있어요.']) {
    await expect(dialog.getByText(t, { exact: false })).toBeVisible();
  }
  await dialog.getByRole('button', { name: '안 할래요' }).click();
  await expect(dialog).toBeHidden();
  await expect(panel(page).getByText(CONSENT_NOTICE)).toBeVisible();
  await expect(panel(page).getByText('허가 전')).toBeVisible();
  for (const key of ['before', 'after', 'later'] as const) await expect(slot(page, key).getByRole('button', { name: '15초 재기' })).toBeDisabled();
  await expect(panel(page).getByRole('button', { name: '블루투스 심박 센서 연결' })).toBeDisabled();
  // 허가하면 켜진다.
  await panel(page).getByRole('button', { name: '허가 화면 열기' }).click();
  await grant(page);
  await expect(slot(page, 'before').getByRole('button', { name: '15초 재기' })).toBeEnabled();
  await expect(panel(page).getByText('허가함')).toBeVisible();
});

test('내 맥박은 가상 친구의 같은 시점 값 옆에 나란히 보이고, 잰 값은 저장소 어디에도 없다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await baselineRun(page, KIND);
  await openPanel(page);
  await grant(page);
  await page.clock.install();
  await measureWithClock(page, 'before', 19); // 19 × 4 = 76
  await measureWithClock(page, 'after', 23); // 23 × 4 = 92
  await expect(slot(page, 'before').getByLabel('운동 전 내 맥박')).toHaveText('76회/분');
  await expect(slot(page, 'after').getByLabel('운동 직후 내 맥박')).toHaveText('92회/분');
  await expect(slot(page, 'before').getByLabel('운동 전 가상 친구 맥박')).toHaveText('85회/분');
  await expect(slot(page, 'after').getByLabel('운동 직후 가상 친구 맥박')).toHaveText('111회/분');
  await expect(slot(page, 'later').getByLabel('3분 뒤 가상 친구 맥박')).toHaveText(/^\d+회\/분$/);
  // 비교만 하고 판정하지 않는다.
  await expect(panel(page)).not.toContainText(/틀렸|정상|비정상|높아요|낮아요/);
  // 결과표와 가상 친구 값은 그대로다.
  expect(await resultCells(resultRows(page).first())).toEqual(['111', '28', '2.5']);

  const dump = await dumpStorage(page);
  for (const needle of ['76', '92', '"19"', '"23"']) expect(dump, `저장소 덤프에 ${needle}`).not.toContain(needle);
  expect(await page.evaluate(() => window.location.href)).not.toMatch(/76|92/);
  // 새로고침해도(앱을 다시 켜도) 값과 허가가 없다.
  await page.reload();
  await openPanel(page);
  await expect(page.getByRole('dialog', { name: '내 맥박 재기' })).toBeVisible();
});

test('단원 목록으로 나갔다 오면 값이 비어 있고 다시 허가를 묻는다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await openPanel(page);
  await grant(page);
  await page.clock.install();
  await measureWithClock(page, 'before', 19);
  await expect(slot(page, 'before').getByLabel('운동 전 내 맥박')).toHaveText('76회/분');
  await page.getByRole('link', { name: '← 단원 목록' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  await page.getByRole('region', { name: '5학년' }).getByRole('button', { name: /우리 몸의 구조와 기능/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '우리 몸의 구조와 기능' })).toBeVisible();
  await openPanel(page);
  await expect(page.getByRole('dialog', { name: '내 맥박 재기' })).toBeVisible();
  await page.getByRole('button', { name: '안 할래요' }).click();
  await expect(slot(page, 'before').getByLabel('운동 전 내 맥박')).toHaveText('–');
  await expect(slot(page, 'before').getByRole('button', { name: '15초 재기' })).toBeDisabled();
});

test('"지금 지우기"는 값만 지우고, "그만두기"는 허가도 거둔다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await openPanel(page);
  await grant(page);
  await page.clock.install();
  await measureWithClock(page, 'before', 19);
  await measureWithClock(page, 'later', 25);
  await panel(page).getByRole('button', { name: '지금 지우기' }).click();
  await expect(slot(page, 'before').getByLabel('운동 전 내 맥박')).toHaveText('–');
  await expect(slot(page, 'later').getByLabel('3분 뒤 내 맥박')).toHaveText('–');
  await expect(panel(page).getByText('내 맥박을 지웠어요.')).toBeVisible();
  await expect(slot(page, 'before').getByRole('button', { name: '15초 재기' })).toBeEnabled();

  await measureWithClock(page, 'after', 30);
  await panel(page).getByRole('button', { name: '그만두기' }).click();
  await expect(slot(page, 'after').getByLabel('운동 직후 내 맥박')).toHaveText('–');
  await expect(slot(page, 'after').getByRole('button', { name: '15초 재기' })).toBeDisabled();
  await expect(panel(page).getByText('허가 전')).toBeVisible();
});

test('마지막 측정 뒤 30분이 지나면 지워진다(가짜 시계)', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await openPanel(page);
  await grant(page);
  await page.clock.install();
  await measureWithClock(page, 'before', 19);
  await page.clock.fastForward(29 * 60 * 1000);
  await expect(slot(page, 'before').getByLabel('운동 전 내 맥박')).toHaveText('76회/분');
  await page.clock.fastForward(2 * 60 * 1000);
  await expect(slot(page, 'before').getByLabel('운동 전 내 맥박')).toHaveText('–');
  await expect(panel(page).getByText('30분이 지나서 내 맥박을 지웠어요.')).toBeVisible();
});

test('pagehide(앱 종료 직전)에서 값이 지워지고 허가를 다시 묻는다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await openPanel(page);
  await grant(page);
  await page.clock.install();
  await measureWithClock(page, 'before', 19);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(slot(page, 'before').getByLabel('운동 전 내 맥박')).toHaveText('–');
  await expect(panel(page).getByText('허가 전')).toBeVisible();
});

test('15초 센 횟수는 5~60만 받는다', async ({ page }) => {
  await gotoUnit(page, 'g5-body');
  await openPanel(page);
  await grant(page);
  await page.clock.install();
  const row = slot(page, 'before');
  await row.getByRole('button', { name: '15초 재기' }).click();
  await page.clock.runFor(16_000);
  await row.getByLabel('15초 동안 센 횟수').fill('3');
  await row.getByRole('button', { name: '기록(×4)' }).click();
  await expect(panel(page).getByRole('alert')).toContainText('5에서 60 사이');
  await expect(row.getByLabel('운동 전 내 맥박')).toHaveText('–');
  await row.getByLabel('15초 동안 센 횟수').fill('60');
  await row.getByRole('button', { name: '기록(×4)' }).click();
  await expect(row.getByLabel('운동 전 내 맥박')).toHaveText('240회/분');
});

test('실측값은 xAPI 기록과 교사 대시보드로 가는 메시지에 없다', async ({ page: teacher, context }) => {
  test.setTimeout(90_000);
  const code = await createClass(teacher);
  const student = await context.newPage();
  // 학생 화면이 보내는 WebSocket 메시지와 xAPI 기록(console.debug)을 모두 가로챈다.
  const frames: string[] = [];
  student.on('websocket', (ws) => ws.on('framesent', (f) => frames.push(String(f.payload))));
  const xapi: Promise<unknown>[] = [];
  student.on('console', (m) => {
    if (m.type() === 'debug' && m.text().startsWith('[xAPI]')) xapi.push(m.args()[1]!.jsonValue());
  });
  await joinClass(student, code, 3);
  await student.evaluate(() => {
    window.location.hash = '#/unit/g5-body';
  });
  await expect(student.getByRole('heading', { level: 1, name: '우리 몸의 구조와 기능' })).toBeVisible();

  await openPanel(student);
  await grant(student);
  // 실제 15초를 기다린다(가짜 시계는 수업 연결의 시간 도구도 멈추므로 쓰지 않는다).
  const row = slot(student, 'before');
  await row.getByRole('button', { name: '15초 재기' }).click();
  await expect(row.getByLabel('15초 동안 센 횟수')).toBeVisible({ timeout: 25_000 });
  await row.getByLabel('15초 동안 센 횟수').fill('19'); // 76회/분
  await row.getByRole('button', { name: '기록(×4)' }).click();
  await expect(row.getByLabel('운동 전 내 맥박')).toHaveText('76회/분');

  // 측정한 뒤 시행을 하나 해서 xAPI 기록과 수업 진행 알림이 실제로 나가게 한다.
  await selectIV(student, KIND);
  await predict(student, '늘어난다');
  await runButton(student).click();
  await confirmSafetyDialog(student);
  await expect(runButton(student)).toHaveText('▶ 실험 실행');
  await expect(resultRows(student)).toHaveCount(1);
  await expect(teacher.getByRole('listitem', { name: '3모둠', exact: true })).toContainText('시행 1회');
  await expect(row.getByLabel('운동 전 내 맥박')).toHaveText('76회/분');

  const statements = await Promise.all(xapi);
  expect(statements.length).toBeGreaterThan(0);
  for (const s of statements) {
    expect(containsNumber(s, 76), JSON.stringify(s)).toBe(false);
    expect(JSON.stringify(s)).not.toMatch(/real|내 맥박|myPulse/);
  }
  expect(frames.length).toBeGreaterThan(0);
  for (const f of frames) {
    let parsed: unknown = f;
    try {
      parsed = JSON.parse(f);
    } catch {
      /* 글자 그대로 본다 */
    }
    expect(containsNumber(parsed, 76), f).toBe(false);
    expect(f).not.toMatch(/"?(pulse|bpm|heart|slots)"?\s*:/i);
  }
  // 시험이 실제로 의미 있었는지: 수업 진행 알림이 한 번은 나갔다.
  expect(frames.some((f) => f.includes('g5-body'))).toBe(true);
  expect(student.url()).not.toMatch(/76/);
});
