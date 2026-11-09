import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const grains = (page: Page) => page.getByRole('figure', { name: '흙 알갱이 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const SLOPE = '언덕의 기울기';
const WATER = '흘려보내는 물의 양';
const VESSEL = '물을 붓는 그릇';

async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 안전 점검표가 없는 단원이므로 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await finishRun(page);
}

/** 기준 시행(완만하게, 1 L, 컵)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 깎인 흙·쌓인 흙: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

test('기준(완만하게, 1 L, 컵)이면 20, 16이 보이고 안전 점검표 없이 바로 실행되며 가상 전자저울이 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await expect(page.getByRole('heading', { level: 1, name: '지구와 바다' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 흐르는 물은 흙 언덕을 어떻게 바꿀까?')).toBeVisible();
  await expect(page.getByText('예측: 깎인 흙의 양은?')).toBeVisible();
  // 실행 전에는 결과(문구의 숫자)를 보여 주지 않는다
  await expect(macro(page).getByTestId('stream-note')).not.toContainText('깎인 흙');
  await expect(macro(page).getByTestId('groove')).toHaveAttribute('data-depth', '0.0');
  await expect(macro(page).getByTestId('deposit-fan')).toHaveCount(0);
  await expect(macro(page).getByTestId('vessel')).toHaveCount(0);
  for (const term of ['침식', '퇴적', '운반', '유속', '삼각주', '선상지']) await expect(page.getByText(term)).toHaveCount(0);

  await baselineRun(page, SLOPE);
  expect(await resultCells(resultRows(page).first())).toEqual(['20', '16']);
  await expect(page.getByRole('columnheader', { name: '깎인 흙(g)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '쌓인 흙(g)' })).toBeVisible();
  await expect(macro(page).getByText('60.0초 · 깎인 흙 20 g · 쌓인 흙 16 g')).toBeVisible();
  await expect(page.getByText('가상 전자저울: 쌓인 흙')).toBeVisible();
  await expect(sensor(page, '무게')).toContainText('g');
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(/침식|퇴적|운반|유속|삼각주|선상지/);
});

test('기울기를 가파르게 바꾸면 50, 결과: 늘어났다, 기울기 전용 질문이 나오고 골이 더 깊다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, SLOPE);
  const gentleDepth = Number(await macro(page).getByTestId('groove').getAttribute('data-depth'));

  await setValue(page, SLOPE, '가파르게');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['50', '40']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('기울기만 바꾸었어요. 물이 흐르는 빠르기는 어떻게 달라 보였나요? 흙 알갱이 그림도 살펴볼까요?');
  await expect(macro(page).getByText('60.0초 · 깎인 흙 50 g · 쌓인 흙 40 g')).toBeVisible();
  expect(Number(await macro(page).getByTestId('groove').getAttribute('data-depth'))).toBeGreaterThan(gentleDepth);
});

test('새 페이지에서 물을 2 L로 바꾸면 40이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, WATER);
  await setValue(page, WATER, '2 L');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['40', '32']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(macro(page).getByText('60.0초 · 깎인 흙 40 g · 쌓인 흙 32 g')).toBeVisible();
});

test('새 페이지에서 그릇만 바꾸면 결과: 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, VESSEL);
  await setValue(page, VESSEL, '페트병');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['20', '16']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('그릇만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
});

test('눈으로 보기: "깎인 곳", "쌓인 곳" 라벨이 보이고, 붓는 동안에만 그릇 아이콘이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea', { playback: 8 });
  for (const l of ['깎인 곳', '쌓인 곳']) await expect(macro(page).getByText(l, { exact: true })).toBeVisible();
  await selectIV(page, SLOPE);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  // 붓는 동안(재생 앞부분)에는 그릇이 보이고 물줄기가 흐른다
  await expect(macro(page).getByTestId('vessel')).toHaveAttribute('data-kind', 'cup');
  await expect(macro(page).getByTestId('water-stream')).toHaveCount(1);
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 20_000 });
  await expect(macro(page).getByTestId('vessel')).toHaveCount(0);
  await expect(macro(page).getByTestId('water-stream')).toHaveCount(0);
  for (const l of ['깎인 곳', '쌓인 곳']) await expect(macro(page).getByText(l, { exact: true })).toBeVisible();
  // 시각을 처음으로 옮기면 골과 흙 더미가 없다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '60');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(macro(page).getByTestId('groove')).toHaveAttribute('data-depth', '0.0');
  await expect(macro(page).getByTestId('deposit-fan')).toHaveCount(0);
});

test('흙 알갱이 보기: 라벨 "물", "흙 알갱이"와 문구가 보이고, 작은 알갱이와 큰 알갱이가 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  for (const l of ['물', '흙 알갱이']) await expect(grains(page).getByText(l, { exact: true })).toBeVisible();
  await expect(grains(page).getByText('흐르는 물은 흙 알갱이를 함께 옮겨요.')).toBeVisible();
  await expect(grains(page).getByTestId('small-grain')).toHaveCount(9);
  await expect(grains(page).getByTestId('big-grain')).toHaveCount(3);
  await baselineRun(page, SLOPE);
  for (const l of ['물', '흙 알갱이']) await expect(grains(page).getByText(l, { exact: true })).toBeVisible();
  await expect(grains(page).getByTestId('grains')).toHaveAttribute('data-state', 'settled');
});

test('그래프: 두 선(실선·점선), y축 0~100, x축 0~60초, 표식 "붓기 끝"', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, WATER);
  await expect(graph(page).getByText('흙의 양(g)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(초)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('붓기 끝')).toBeVisible();
  await expect(graph(page).getByTestId('graph-series')).toHaveCount(2);
  await expect(graph(page).locator('[data-series=eroded]')).not.toHaveAttribute('stroke-dasharray', /.+/);
  await expect(graph(page).locator('[data-series=deposited]')).toHaveAttribute('stroke-dasharray', '7 4');
  await expect(graph(page).getByTestId('graph-legend-item')).toHaveCount(2);
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '10', '20', '30', '40', '50', '60']);
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['0', '20', '40', '60', '80', '100']);
  // 2 L이면 표식이 40초 쪽으로 옮겨 간다
  const x20 = (await graph(page).getByTestId('graph-marker').locator('line').boundingBox())!.x;
  await setValue(page, WATER, '2 L');
  await run(page, '늘어난다');
  const x40 = (await graph(page).getByTestId('graph-marker').locator('line').boundingBox())!.x;
  expect(x40).toBeGreaterThan(x20);
});

test('재생이 끝난 뒤 플레이헤드는 끝(60)에 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, WATER);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '60');
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByText('0.0초 · 깎인 흙 0 g · 쌓인 흙 0 g')).toBeVisible();
});

test('알갱이는 붓는 동안에만 움직이고, 단원을 떠나면 애니메이션 요청이 남지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: Set<number> };
    w.__raf = new Set();
    const raf = window.requestAnimationFrame.bind(window);
    const caf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      const id = raf((t) => {
        w.__raf.delete(id);
        cb(t);
      });
      w.__raf.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      w.__raf.delete(id);
      caf(id);
    };
  });
  await gotoUnit(page, 'g3-earth-sea', { playback: 5 });
  await selectIV(page, SLOPE);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(grains(page).getByTestId('grains')).toHaveAttribute('data-running', 'true');
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 15_000 });
  await expect(grains(page).getByTestId('grains')).toHaveAttribute('data-running', 'false');
  const b = await grains(page).getByTestId('small-grain').first().getAttribute('cx');
  await page.waitForTimeout(300);
  expect(await grains(page).getByTestId('small-grain').first().getAttribute('cx')).toBe(b);

  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(grains(page).getByTestId('grains')).toHaveAttribute('data-running', 'true');
  expect(await page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBeGreaterThan(0);
  await page.getByRole('link', { name: '← 단원 목록' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBe(0);
});

test('움직임 줄이기이면 알갱이가 가만히 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoUnit(page, 'g3-earth-sea', { playback: 5 });
  await selectIV(page, SLOPE);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(grains(page).getByTestId('grains')).toHaveAttribute('data-running', 'false');
  const first = () => grains(page).getByTestId('small-grain').first().getAttribute('cx');
  const a = await first();
  await page.waitForTimeout(400);
  expect(await first()).toBe(a);
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 15_000 });
});

test.describe('1280x800 화면', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function renderedFontSizes(svg: Locator) {
    return svg.evaluate((el) => {
      const s = el as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll('text')].map((t) => ({ text: (t.textContent ?? '').trim(), px: parseFloat(getComputedStyle(t).fontSize) * scale }));
    });
  }

  test('눈으로 보기와 흙 알갱이 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g3-earth-sea');
    const check = async () => {
      for (const name of ['눈으로 보기', '흙 알갱이 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, SLOPE);
    await check();
    await setValue(page, SLOPE, '가파르게');
    await setValue(page, WATER, '2 L');
    await run(page, '늘어난다');
    await check();
  });
});
