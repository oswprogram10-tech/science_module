import type { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  gotoUnit,
  selectIV,
  setValue,
  predict,
  runButton,
  resultRows,
  confirmSafetyDialog,
  sensor,
  defineSortSuite,
  VOLCANO_EJECTA_CFG,
} from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const HOT_NOTICE = '⚠ 녹인 물질과 접시는 굳은 뒤에도 한동안 뜨거워요.';
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const grains = (page: Page) => page.getByRole('figure', { name: '알갱이로 보기(돋보기)' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });
const win = (page: Page) => grains(page).locator('[data-testid=grain-window]');

/** 실행 버튼이 다시 '▶ 실험 실행'이 될 때까지(재생이 끝날 때까지) 기다린다. */
async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 기준 시행(실온, 5 g, 유리 접시, 흰색)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);
}

test('처음 실행할 때 점검표를 거쳐 기준 시행을 하면 0.80과 "중간"이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await selectIV(page, '식히는 곳');
  await predict(page, '늘어난다');

  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('녹인 물질은 뜨거우니 선생님이 따라 주세요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  const row1 = resultRows(page).first();
  await expect(row1).toContainText('0.80');
  await expect(row1).toContainText('22.4');
  await expect(row1).toContainText('중간');
  await expect(page.getByText('가상 온도 센서: 녹인 물질')).toBeVisible();
  await expect(sensor(page, '온도')).toContainText('°C');
  await expect(macro(page).getByText('다 굳었어요 · 22.4초')).toBeVisible();
});

test('따뜻한 물 위로 바꾸면 2.04, 화강암 쪽, 늘어났다와 식히는 곳 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await baselineRun(page, '식히는 곳');

  await setValue(page, '식히는 곳', '따뜻한 물 위');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeHidden(); // 점검표는 한 번만
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('2.04');
  await expect(row2).toContainText('55.5');
  await expect(row2).toContainText('화강암 쪽');
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('식히는 곳만 바꾸었어요. 그래프에서 온도가 내려가는 빠르기를 비교해 볼까요?');

  // 얼음물 위는 반대쪽 끝이다.
  await setValue(page, '식히는 곳', '얼음물 위');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await finishRun(page);
  const row3 = resultRows(page).nth(2);
  await expect(row3).toContainText('0.57');
  await expect(row3).toContainText('현무암 쪽');
  await expect(row3).toContainText('결과: 줄어들었다');
});

test('새 페이지에서 색깔만 바꾸면 변하지 않았다와 색깔 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await baselineRun(page, '물질의 색깔');

  await setValue(page, '물질의 색깔', '검은색 색소를 넣음');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('0.80');
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('색깔만 바꾸었을 때 알갱이 크기가 달라졌나요?');
});

test('알루미늄 10 g은 유리 5 g과 같은 결과를 내고, 두 조건이 함께 바뀌면 함께 바뀌었다는 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await baselineRun(page, '녹인 양');

  await setValue(page, '담은 접시', '알루미늄 접시');
  await setValue(page, '녹인 양', '10 g');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('0.80');
  await expect(row2).toContainText('22.4');
  await expect(tutorBox(page)).toContainText('함께 바뀌었어요');
});

test('돋보기 화면에 1 mm 축척이 있고, 다 굳으면 비교 카드가 나오며, 그래프 시각을 앞으로 옮기면 사라진다', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await expect(grains(page).getByText('1 mm', { exact: true })).toBeVisible();
  await expect(grains(page).getByTestId('rock-card')).toBeHidden();
  await expect(win(page)).toHaveAttribute('data-filled', '0');

  await baselineRun(page, '식히는 곳');
  const card = grains(page).getByTestId('rock-card');
  await expect(card).toContainText('중간 크기예요');
  const n = Number(await win(page).getAttribute('data-grains'));
  expect(n).toBe(56); // 0.80 mm: round((6 / 0.8)²)
  await expect(win(page)).toHaveAttribute('data-filled', String(n));

  const s = slider(page);
  await s.focus();
  await s.press('Home');
  await expect(card).toBeHidden();
  await expect(win(page)).toHaveAttribute('data-filled', '0');
  await s.press('End');
  await expect(card).toBeVisible();

  await setValue(page, '식히는 곳', '따뜻한 물 위');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await finishRun(page);
  await expect(grains(page).getByTestId('rock-card')).toContainText('화강암처럼 알갱이가 커요');
  expect(Number(await win(page).getAttribute('data-grains'))).toBeLessThan(n);

  await setValue(page, '식히는 곳', '얼음물 위');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await finishRun(page);
  await expect(grains(page).getByTestId('rock-card')).toContainText('현무암처럼 알갱이가 작아요');
  expect(Number(await win(page).getAttribute('data-grains'))).toBeGreaterThan(n);
});

test('눈으로 보기: 받침과 접시 라벨, 굳는 동안 문구, 녹은 물질이 굳는 모양', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await expect(macro(page).getByText('유리 접시', { exact: true })).toBeVisible();
  await expect(macro(page).getByText('실온 (받침 없음)')).toBeVisible();
  await expect(macro(page).getByTestId('support-ice')).toHaveCount(0);
  await setValue(page, '식히는 곳', '얼음물 위');
  await expect(macro(page).getByTestId('support-ice')).toBeVisible();
  await expect(macro(page).getByText('얼음물 위', { exact: true })).toBeVisible();
  await setValue(page, '식히는 곳', '따뜻한 물 위');
  await expect(macro(page).getByTestId('support-warm')).toBeVisible();
  await setValue(page, '담은 접시', '알루미늄 접시');
  await expect(macro(page).getByText('알루미늄 접시', { exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('dish')).toHaveAttribute('data-dish', 'aluminum');

  await setValue(page, '식히는 곳', '실온');
  await setValue(page, '담은 접시', '유리 접시');
  await selectIV(page, '식히는 곳');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);

  const s = slider(page);
  await s.focus();
  await s.press('Home');
  await expect(macro(page).getByText('90.0 °C · 굳는 중')).toBeVisible();
  await expect(macro(page).getByTestId('melt')).toHaveAttribute('data-crystal', '0.000');
  for (let i = 0; i < 4; i++) await s.press('PageUp'); // 그래프 시각 약 11초: 알갱이가 자라기 시작한 뒤
  const crystal = Number(await macro(page).getByTestId('melt').getAttribute('data-crystal'));
  expect(crystal).toBeGreaterThan(0);
  await expect(macro(page).getByText(/°C · 굳는 중$/)).toBeVisible();
  await s.press('End');
  await expect(macro(page).getByTestId('melt')).toHaveAttribute('data-crystal', '1.000');
  await expect(macro(page).getByText('다 굳었어요 · 22.4초')).toBeVisible();
});

test('그래프에 알갱이가 생기기 시작하는 때와 다 자라는 때 표식이 시행마다 다른 시각에 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await baselineRun(page, '식히는 곳');
  const markers = graph(page).getByTestId('graph-marker');
  await expect(markers).toHaveCount(2);
  await expect(markers.nth(0)).toContainText('알갱이 생김');
  await expect(markers.nth(1)).toContainText('다 자람');
  await expect(graph(page).getByText('물질의 온도')).toBeVisible();
  const xs = async () => markers.locator('line').evaluateAll((ls) => ls.map((l) => Number(l.getAttribute('x1'))));
  const room = await xs();
  expect(room[1]!).toBeGreaterThan(room[0]!);

  await setValue(page, '식히는 곳', '따뜻한 물 위');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await finishRun(page);
  await expect(markers).toHaveCount(2);
  expect(await xs()).not.toEqual(room);
});

test('안전: 상시 문구는 이 단원에서만 보이고, 연소·전기 단원 화면은 그대로다', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await expect(page.getByText(HOT_NOTICE)).toBeVisible();
  for (const id of ['g6-combustion', 'g6-electricity']) {
    await gotoUnit(page, id, { dev: true });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(HOT_NOTICE)).toHaveCount(0);
  }
});

test('안전 점검표를 취소하면 실험이 시작되지 않는다', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await selectIV(page, '식히는 곳');
  await predict(page, '늘어난다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(resultRows(page)).toHaveCount(1);
  await expect(page.getByText('아직 실험한 결과가 없어요.')).toBeVisible();
});

test('움직임 줄이기: 진행 애니메이션 없이 진행도만큼 채운다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoUnit(page, 'g4-land');
  await baselineRun(page, '식히는 곳');
  const n = await win(page).getAttribute('data-grains');
  await expect(win(page)).toHaveAttribute('data-filled', n!);
  const s = slider(page);
  await s.focus();
  await s.press('Home');
  for (let i = 0; i < 4; i++) await s.press('PageUp');
  const filled = Number(await win(page).getAttribute('data-filled'));
  expect(filled).toBeGreaterThan(0);
  expect(filled).toBeLessThan(Number(n));
  const anims = await page.evaluate(() => document.getAnimations().length);
  expect(anims).toBe(0);
});

test.describe('1280x800 화면', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  /** SVG 안 글자의 화면 글자 크기(px) = font-size × (화면 폭 / viewBox 폭). */
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

  test('그림과 그래프 표식의 글자는 화면에서 13 px 이상이다 (실험 전, 얼음물·알루미늄, 따뜻한 물 위)', async ({ page }) => {
    await gotoUnit(page, 'g4-land');
    const check = async () => {
      for (const name of ['눈으로 보기', '알갱이로 보기(돋보기)']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();

    await selectIV(page, '식히는 곳');
    await setValue(page, '식히는 곳', '얼음물 위');
    await setValue(page, '담은 접시', '알루미늄 접시');
    await check();
    await predict(page, '줄어든다');
    await runButton(page).click();
    await confirmSafetyDialog(page);
    await finishRun(page);
    await check();
    const markers = await renderedFontSizes(graph(page).locator('svg'), '[data-testid=graph-marker] text');
    expect(markers).toHaveLength(2);
    for (const { text, px } of markers) expect(px, `그래프 표식: "${text}"`).toBeGreaterThanOrEqual(13);

    await setValue(page, '식히는 곳', '따뜻한 물 위');
    await setValue(page, '담은 접시', '유리 접시');
    await setValue(page, '녹인 양', '10 g');
    await check();
  });

  test('그래프 표식 라벨이 서로 겹치거나 다른 표식 선을 가로지르거나 그래프 밖으로 나가지 않는다', async ({ page }) => {
    await gotoUnit(page, 'g4-land');
    await selectIV(page, '식히는 곳');
    for (const place of ['얼음물 위', '실온', '따뜻한 물 위']) {
      await setValue(page, '식히는 곳', place);
      await predict(page, '늘어난다');
      await runButton(page).click();
      if (place === '얼음물 위') await confirmSafetyDialog(page);
      await finishRun(page);
      const boxes = await graph(page).locator('[data-testid=graph-marker] text').evaluateAll((ts) =>
        ts.map((t) => {
          const r = t.getBoundingClientRect();
          return { l: r.left, r: r.right, t: r.top, b: r.bottom };
        }),
      );
      const svg = await graph(page).locator('svg').first().boundingBox();
      expect(boxes).toHaveLength(2);
      for (const b of boxes) {
        expect(b.l, place).toBeGreaterThanOrEqual(svg!.x);
        expect(b.r, place).toBeLessThanOrEqual(svg!.x + svg!.width);
      }
      const [a, b] = boxes as [(typeof boxes)[0], (typeof boxes)[0]];
      // 표식 선(세로 점선)이 다른 표식의 라벨 글자 상자를 가로지르지 않는다.
      const xs = await graph(page).locator('[data-testid=graph-marker] line').evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().left));
      expect(xs).toHaveLength(2);
      expect(xs[1]!, `${place}: 두 번째 표식 선이 첫 번째 라벨을 가로지름`).toBeGreaterThanOrEqual(a.r);
      expect(b.l, `${place}: 첫 번째 표식 선이 두 번째 라벨을 가로지름`).toBeGreaterThanOrEqual(xs[0]!);
      const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      expect(overlap, `${place}: 표식 라벨 겹침`).toBe(false);
    }
  });
});

// ---- 땅의 변화 세 번째 활동: 화산에서 나오는 것 나누기(카드 분류 groups, 활동 탭 3개) ----

defineSortSuite(VOLCANO_EJECTA_CFG);
