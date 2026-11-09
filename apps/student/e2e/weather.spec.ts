import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const air = (page: Page) => page.getByRole('figure', { name: '공기의 움직임 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const sandSensor = (page: Page) => page.getByRole('status', { name: '모래 온도', exact: true });
const waterSensor = (page: Page) => page.getByRole('status', { name: '물 온도', exact: true });

const PHASE = '때';
const LAMP = '전등과의 거리';
const BOWL = '그릇';
const NOTICE = '⚠ 향과 전등은 선생님과 함께 다뤄요.';
const TERMS = ['비열', '대류', '해풍', '육풍', '기압 경도력', '열용량'];

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

/** 기준 시행(낮, 20 cm, 플라스틱 그릇)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 모래·물·온도 차·바람 방향: 세 조건 다음 네 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 7);
}

test('점검표를 거쳐 기준(낮, 20 cm, 플라스틱)을 하면 34.7, 26.3, +8.4, 바다 → 육지가 보이고 상시 문구와 온도계 두 개가 있다', async ({ page }) => {
  await gotoUnit(page, 'g5-weather');
  await expect(page.getByRole('heading', { level: 1, name: '날씨와 우리 생활' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 낮과 밤에 바닷가에서는 바람이 어느 쪽으로 불까?')).toBeVisible();
  await expect(page.getByText('예측: 모래 온도와 물 온도의 차이(모래 − 물)는?')).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
  // 실행 전에는 결과를 보여 주지 않는다: 숫자 "?", 곧은 연기, 공기 그림에 화살표·라벨 없음
  await expect(macro(page).getByTestId('breeze-note')).not.toContainText('바람:');
  await expect(macro(page).getByTestId('sand-temp')).toHaveText('? °C');
  await expect(macro(page).getByTestId('smoke')).toHaveAttribute('data-lean', 'none');
  await expect(air(page).getByTestId('air-arrow')).toHaveCount(0);
  for (const l of ['따뜻한 쪽', '차가운 쪽', '바닥 근처 바람']) await expect(air(page)).not.toContainText(l);
  for (const term of TERMS) await expect(page.getByText(term)).toHaveCount(0);
  await expect(page.getByText('가상 온도계: 모래')).toBeVisible();
  await expect(page.getByText('가상 온도계: 물')).toBeVisible();
  await expect(sandSensor(page)).toContainText('°C');
  await expect(waterSensor(page)).toContainText('°C');

  await selectIV(page, PHASE);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('전등은 뜨거우니 갓을 만지지 않아요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await resultCells(resultRows(page).first())).toEqual(['34.7', '26.3', '+8.4', '바다 → 육지']);
  for (const h of ['모래 온도(°C)', '물 온도(°C)', '온도 차(°C)', '바람 방향']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByText('10.0분 · 모래 34.7 °C · 물 26.3 °C · 바람: 바다 → 육지')).toBeVisible();
  await expect(macro(page).getByTestId('sand-temp')).toHaveText('34.7 °C');
  await expect(macro(page).getByTestId('water-temp')).toHaveText('26.3 °C');
  await expect(sandSensor(page)).toContainText('34.');
  await expect(waterSensor(page)).toContainText('26.');
  await expect(macro(page).getByTestId('smoke')).toHaveAttribute('data-lean', 'left');
  expect(await page.locator('main').innerText()).not.toMatch(/비열|대류|해풍|육풍|기압 경도력|열용량/);
});

test('때를 밤으로 바꾸면 −2.6, 육지 → 바다, 결과: 줄어들었다, 때 전용 질문이 나오고 밤 라벨이 붙는다', async ({ page }) => {
  await gotoUnit(page, 'g5-weather');
  await baselineRun(page, PHASE);
  await expect(macro(page).getByText('밤', { exact: true })).toHaveCount(0);

  await setValue(page, PHASE, '밤');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['21.2', '23.8', '−2.6', '육지 → 바다']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('때만 바꾸었어요. 어느 쪽이 더 따뜻했나요? 공기의 움직임 그림에서 화살표가 위로 올라가는 곳은 어디였나요?');
  await expect(macro(page).getByText('10.0분 · 모래 21.2 °C · 물 23.8 °C · 바람: 육지 → 바다')).toBeVisible();
  await expect(macro(page).getByText('밤', { exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-on', 'false');
  await expect(macro(page).getByTestId('smoke')).toHaveAttribute('data-lean', 'right');
});

test('새 페이지에서 거리를 40 cm로 바꾸면 +2.1이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-weather');
  await baselineRun(page, LAMP);
  await setValue(page, LAMP, '40 cm');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['23.7', '21.6', '+2.1', '바다 → 육지']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(macro(page).getByText('10.0분 · 모래 23.7 °C · 물 21.6 °C · 바람: 바다 → 육지')).toBeVisible();
  await expect(macro(page).getByText('40 cm', { exact: true })).toBeVisible();
});

test('새 페이지에서 그릇만 바꾸면 결과: 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g5-weather');
  await baselineRun(page, BOWL);
  await setValue(page, BOWL, '유리 그릇');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['34.7', '26.3', '+8.4', '바다 → 육지']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('그릇만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
});

test('밤 시행은 낮이 끝난 상태에서 시작한다: 시각을 처음으로 옮기면 모래 34.7 °C, 연기는 육지 쪽', async ({ page }) => {
  await gotoUnit(page, 'g5-weather');
  await selectIV(page, PHASE);
  await setValue(page, PHASE, '밤');
  await run(page, '변하지 않는다', true);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '10');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(macro(page).getByText('0.0분 · 모래 34.7 °C · 물 26.3 °C · 바람: 바다 → 육지')).toBeVisible();
  await expect(macro(page).getByTestId('smoke')).toHaveAttribute('data-lean', 'left');
  await expect(air(page).getByTestId('air-loop')).toHaveAttribute('data-warm', 'left');
  await slider.press('End');
  await expect(macro(page).getByTestId('smoke')).toHaveAttribute('data-lean', 'right');
  await expect(air(page).getByTestId('air-loop')).toHaveAttribute('data-warm', 'right');
});

test('공기의 움직임 보기: 낮에는 육지가 따뜻한 쪽, 밤에는 바다가 따뜻한 쪽으로 라벨이 붙고 문구가 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-weather');
  await baselineRun(page, PHASE);
  for (const l of ['따뜻한 쪽', '차가운 쪽', '바닥 근처 바람']) await expect(air(page).getByText(l, { exact: true })).toBeVisible();
  await expect(air(page).getByText('땅 가까이에서는 공기가 차가운 쪽에서 따뜻한 쪽으로 옮겨 가요.')).toBeVisible();
  await expect(air(page).getByTestId('air-loop')).toHaveAttribute('data-warm', 'left');
  const x = async (id: string) => (await air(page).getByTestId(id).boundingBox())!.x;
  expect(await x('label-warm')).toBeLessThan(await x('label-cool'));

  await setValue(page, PHASE, '밤');
  await run(page, '줄어든다');
  await expect(air(page).getByTestId('air-loop')).toHaveAttribute('data-warm', 'right');
  expect(await x('label-warm')).toBeGreaterThan(await x('label-cool'));
  for (const l of ['따뜻한 쪽', '차가운 쪽', '바닥 근처 바람']) await expect(air(page).getByText(l, { exact: true })).toBeVisible();
});

test('그래프: 두 선(실선·점선), y축 15~40, x축 0~10분, 표식 없음', async ({ page }) => {
  await gotoUnit(page, 'g5-weather');
  await baselineRun(page, PHASE);
  await expect(graph(page).getByText('온도(°C)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(분)', { exact: true })).toBeVisible();
  await expect(graph(page).getByTestId('graph-series')).toHaveCount(2);
  await expect(graph(page).locator('[data-series=sand]')).not.toHaveAttribute('stroke-dasharray', /.+/);
  await expect(graph(page).locator('[data-series=water]')).toHaveAttribute('stroke-dasharray', '7 4');
  await expect(graph(page).getByTestId('graph-legend-item')).toHaveCount(2);
  await expect(graph(page).getByTestId('graph-marker')).toHaveCount(0);
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '2', '4', '6', '8', '10']);
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['15', '20', '25', '30', '35', '40']);
});

test('재생이 끝난 뒤 플레이헤드는 끝(10)에 있다', async ({ page }) => {
  await gotoUnit(page, 'g5-weather');
  await baselineRun(page, PHASE);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '10');
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByText('0.0분 · 모래 20.0 °C · 물 20.0 °C · 바람: 거의 없음')).toBeVisible();
  await expect(air(page).getByTestId('air-arrow')).toHaveCount(0);
});

test('공기 화살표는 실험 중에만 움직이고, 단원을 떠나면 애니메이션 요청이 남지 않는다', async ({ page }) => {
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
  await gotoUnit(page, 'g5-weather', { playback: 5 });
  await selectIV(page, PHASE);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await page.waitForTimeout(1200);
  await expect(air(page).getByTestId('air-loop')).toHaveAttribute('data-running', 'true');
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 15_000 });
  await expect(air(page).getByTestId('air-loop')).toHaveAttribute('data-running', 'false');
  const b = await air(page).getByTestId('air-arrow').first().getAttribute('data-x');
  await page.waitForTimeout(300);
  expect(await air(page).getByTestId('air-arrow').first().getAttribute('data-x')).toBe(b);

  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await page.waitForTimeout(1200);
  await expect(air(page).getByTestId('air-loop')).toHaveAttribute('data-running', 'true');
  expect(await page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBeGreaterThan(0);
  await page.getByRole('link', { name: '← 단원 목록' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBe(0);
});

test('움직임 줄이기이면 공기 화살표가 가만히 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoUnit(page, 'g5-weather', { playback: 5 });
  await selectIV(page, PHASE);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await page.waitForTimeout(1200);
  await expect(air(page).getByTestId('air-loop')).toHaveAttribute('data-running', 'false');
  const first = () => air(page).getByTestId('air-arrow').first().getAttribute('data-x');
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

  test('눈으로 보기와 공기의 움직임 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g5-weather');
    const check = async () => {
      for (const name of ['눈으로 보기', '공기의 움직임 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, PHASE);
    await check();
    await setValue(page, PHASE, '밤');
    await setValue(page, LAMP, '40 cm');
    await run(page, '줄어든다');
    await check();
  });
});
