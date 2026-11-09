import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const calc = (page: Page) => page.getByRole('figure', { name: '속력 계산해 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const HEIGHT = '출발 높이';
const FLOOR = '바닥';
const LOAD = '수레에 실은 추';

async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 기준 시행(20 cm, 나무 판, 추 없음)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 값: 높이, 바닥, 추 다음의 걸린 시간, 속력 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

test('기준(20 cm, 나무 판, 추 없음)이면 0.55, 1.82가 보이고 실행 전에는 결과가 보이지 않는다', async ({ page }) => {
  await gotoUnit(page, 'g6-motion');
  await expect(page.getByRole('heading', { level: 1, name: '물체의 운동' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 수레를 놓는 높이를 바꾸면 수레의 빠르기는 어떻게 달라질까?')).toBeVisible();
  await expect(page.getByText('예측: 수레의 속력은?')).toBeVisible();
  // 실행 전에는 답을 보여 주지 않는다
  await expect(calc(page).getByText('걸린 시간 ?')).toBeVisible();
  await expect(calc(page).getByTestId('division')).toHaveCount(0);
  const before = await page.locator('main').innerText();
  expect(before).not.toMatch(/0\.55|1\.82/);
  await expect(macro(page).getByTestId('ghost')).toHaveCount(0);

  await baselineRun(page, HEIGHT);
  expect(await resultCells(resultRows(page).first())).toEqual(['0.55', '1.82']);
  for (const name of ['1 m 가는 데 걸린 시간(초)', '속력(m/s)']) await expect(page.getByRole('columnheader', { name })).toBeVisible();
  await expect(macro(page).getByText('1.2초 · 출발선에서 1.50 m · 1 m까지 0.55초')).toBeVisible();
  await expect(macro(page).getByText('느린 화면', { exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('finish-flag')).toBeVisible();
  await expect(macro(page).getByTestId('wall')).toBeVisible();
  await expect(macro(page).getByTestId('ramp-height')).toHaveText('20 cm');
  await expect(page.getByText('가상 속력 센서')).toBeVisible();
  await expect(sensor(page, '속력')).toContainText('m/s');
  // 쓰지 않는 말
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/가속도|에너지|마찰 계수|관성/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('계산 식 "1 ÷ 0.55 = 1.82 (m/s)"가 실행 뒤에 보인다', async ({ page }) => {
  await gotoUnit(page, 'g6-motion');
  await baselineRun(page, HEIGHT);
  await expect(calc(page).getByText('이동 거리 1 m')).toBeVisible();
  await expect(calc(page).getByText('걸린 시간 0.55초')).toBeVisible();
  await expect(calc(page).getByTestId('division')).toHaveText('1 ÷ 0.55 = 1.82 (m/s)');
  await expect(calc(page).getByText('지금 빠르기')).toBeVisible();
});

test('높이를 40 cm로 바꾸면 2.63, 결과: 늘어났다, 높이 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-motion');
  await baselineRun(page, HEIGHT);

  await setValue(page, HEIGHT, '40 cm');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['0.38', '2.63']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('출발 높이만 바꾸었어요. 같은 1 m를 가는 데 걸린 시간이 어떻게 달랐나요? 시간이 짧으면 속력은 어떻게 될까요?');
  await expect(calc(page).getByTestId('division')).toHaveText('1 ÷ 0.38 = 2.63 (m/s)');
  // 수레는 1.5 m 멈춤 벽 앞에 서 있다
  await expect(macro(page).getByTestId('cart-pos')).toHaveAttribute('data-x', '1.500');
});

test('새 페이지에서 추만 2개로 바꾸면 0.55, 1.82, 결과: 변하지 않았다, 추 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-motion');
  await baselineRun(page, LOAD);

  await setValue(page, LOAD, '2개');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['0.55', '1.82']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('실은 추만 바꾸었을 때 걸린 시간이 달라졌나요? 처음 예상과 비교해 볼까요?');
  await expect(macro(page).getByTestId('cart-weight')).toHaveCount(2);
});

test('수건 바닥이면 0.59, 1.69이고 바닥 무늬가 나무 판과 다르다', async ({ page }) => {
  await gotoUnit(page, 'g6-motion');
  await baselineRun(page, FLOOR);
  await expect(macro(page).getByTestId('floor')).toHaveAttribute('data-floor', 'wood');

  await setValue(page, FLOOR, '수건을 깐 바닥');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['0.59', '1.69']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(macro(page).getByTestId('floor')).toHaveAttribute('data-floor', 'towel');
  await expect(macro(page).getByText('바닥: 수건을 깐 바닥 · 추: 없음')).toBeVisible();
  await expect(calc(page).getByTestId('division')).toHaveText('1 ÷ 0.59 = 1.69 (m/s)');
});

test('그래프 y축 눈금 0·0.5·1·1.5, x축 0.0~1.2, "1 m 도착" 표식이 있다', async ({ page }) => {
  await gotoUnit(page, 'g6-motion');
  await baselineRun(page, HEIGHT);

  await expect(graph(page).getByText('출발선에서의 거리(m)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(초)', { exact: true })).toBeVisible();
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['0', '0.5', '1', '1.5']);
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0.0', '0.2', '0.4', '0.6', '0.8', '1.0', '1.2']);
  await expect(graph(page).getByTestId('graph-marker')).toHaveCount(1);
  await expect(graph(page).getByTestId('graph-marker')).toContainText('1 m 도착');
});

test('재생이 끝난 뒤 플레이헤드는 끝(1.2)에 있다', async ({ page }) => {
  await gotoUnit(page, 'g6-motion');
  await baselineRun(page, HEIGHT);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '1.2');
  await expect(slider).toHaveAttribute('aria-valuetext', /^1\.2초, 출발선에서의 거리 1\.5 m$/);
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(calc(page).getByText('걸린 시간 ?')).toBeVisible();
  await expect(calc(page).getByTestId('division')).toHaveCount(0);
});

test('잔상 점은 수레 뒤에 남는다', async ({ page }) => {
  await gotoUnit(page, 'g6-motion');
  await baselineRun(page, HEIGHT);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  // 0.1초마다 한 점: 0.4초 부근에서는 3~4개
  for (let i = 0; i < 20; i++) await slider.press('ArrowRight');
  const n = await macro(page).getByTestId('ghost').count();
  expect(n).toBeGreaterThanOrEqual(2);
  expect(n).toBeLessThanOrEqual(12);
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

  test('눈으로 보기와 속력 계산해 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g6-motion');
    const check = async () => {
      for (const name of ['눈으로 보기', '속력 계산해 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, HEIGHT);
    await check();
    await setValue(page, HEIGHT, '40 cm');
    await setValue(page, FLOOR, '수건을 깐 바닥');
    await setValue(page, LOAD, '2개');
    await run(page, '늘어난다');
    await check();
  });
});
