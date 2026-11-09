import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const micro = (page: Page) => page.getByRole('figure', { name: '씨 하나 확대해 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });

const WATER = '물';
const TEMP = '온도';
const LIGHT = '빛';

/** 실행 버튼이 다시 '▶ 실험 실행'이 될 때까지(재생이 끝날 때까지) 기다린다. */
async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 이 단원은 안전 점검표가 없으므로 실행을 누르면 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await finishRun(page);
}

/** 기준 시행(물 줌, 20 °C, 밝은 곳)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '늘어난다');
}

/** 결과표 한 줄의 값: 물, 온도, 빛 다음의 7일째 수, 처음 싹 튼 날, 떡잎 색 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 6);
}

test('기준 시행(물 줌, 20 °C, 밝은 곳)이면 9, 1.8, 초록색이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g3-lifecycle');
  await expect(page.getByRole('heading', { level: 1, name: '생물의 한살이' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 씨가 싹 트려면 어떤 조건이 필요할까?')).toBeVisible();
  await expect(page.getByText('발아')).toHaveCount(0);
  await baselineRun(page, WATER);
  const row1 = resultRows(page).first();
  expect(await resultCells(row1)).toEqual(['9', '1.8', '초록색']);
  await expect(page.getByRole('columnheader', { name: '7일째 싹 튼 씨앗 수(개)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '처음 싹 튼 날(일)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '떡잎 색' })).toBeVisible();
  // 재생이 끝나면 10일째가 아니라 7일째에 멈춘다.
  await expect(macro(page).getByText('7일째 · 싹 튼 씨앗 9개')).toBeVisible();
  await expect(sensor(page, '온도')).toContainText('°C');
  await expect(sensor(page, '빛 세기')).toContainText('%');
  await expect(page.getByText('가상 온도계')).toBeVisible();
  await expect(page.getByText('가상 빛 센서')).toBeVisible();
});

test('빛만 어둡게 바꾸면 9, 노란색, 변하지 않았다이고 빛 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-lifecycle');
  await baselineRun(page, LIGHT);

  await setValue(page, LIGHT, '어두운 곳');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['9', '1.8', '노란색']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('빛만 바꾸었을 때 싹 튼 씨앗 수와 떡잎 색은 각각 어떻게 되었나요? 두 결과는 무엇이 다를까요?');
  await expect(macro(page).getByText('상자를 덮음')).toBeVisible();
  await expect(macro(page).getByText(/떡잎 노란색/)).toBeVisible();
  await expect(micro(page).getByText('떡잎 색: 노란색')).toBeVisible();
});

test('새 페이지에서 물만 주지 않음으로 바꾸면 0, –, 줄어들었다', async ({ page }) => {
  await gotoUnit(page, 'g3-lifecycle');
  await baselineRun(page, WATER);

  await setValue(page, WATER, '물을 주지 않음');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['0', '–', '–']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('물만 바꾸었을 때 싹 튼 씨앗 수와 처음 싹 튼 날은 각각 어떻게 달라졌나요?');
  await expect(macro(page).getByText('7일째 · 싹 튼 씨앗 0개')).toBeVisible();
  await expect(macro(page).getByTestId('sprout')).toHaveCount(0);
  await expect(micro(page).getByText('지금 단계: 씨')).toBeVisible();
});

test('온도 30 °C면 처음 싹 튼 날이 1.1이고 수는 같다, 냉장고 5 °C면 0이다', async ({ page }) => {
  await gotoUnit(page, 'g3-lifecycle');
  await baselineRun(page, TEMP);

  await setValue(page, TEMP, '따뜻한 곳');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['9', '1.1', '초록색']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('온도만 바꾸었어요. 싹 튼 수가 같아도 다른 점이 있나요? 그래프에서 싹이 트기 시작한 때를 비교해 볼까요?');

  await setValue(page, TEMP, '냉장고');
  await run(page, '줄어든다');
  const row3 = resultRows(page).nth(2);
  expect(await resultCells(row3)).toEqual(['0', '–', '–']);
  await expect(row3).toContainText('결과: 줄어들었다');
});

test('그래프: x 라벨 "날짜(일)", 눈금 0·2·…·10, "7일째" 표식, 슬라이더를 따라 눈으로 보기와 씨 하나가 바뀐다', async ({ page }) => {
  await gotoUnit(page, 'g3-lifecycle');
  await baselineRun(page, WATER);
  await expect(graph(page).getByText('날짜(일)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toHaveCount(0);
  await expect(graph(page).getByText('싹 튼 씨앗 수(개)')).toBeVisible();
  const ticks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(ticks).toEqual(['0', '2', '4', '6', '8', '10']);
  const markers = graph(page).getByTestId('graph-marker');
  await expect(markers).toHaveCount(1);
  await expect(markers.first()).toContainText('7일째');

  const s = slider(page);
  await s.focus();
  await s.press('Home');
  await expect(macro(page).getByText('0일째 · 싹 튼 씨앗 0개')).toBeVisible();
  await expect(micro(page).getByText('지금 단계: 씨')).toBeVisible();
  await s.press('End');
  await expect(macro(page).getByText('10일째 · 싹 튼 씨앗 9개')).toBeVisible();
  await expect(micro(page).getByText('지금 단계: 본잎')).toBeVisible();
  await expect(s).toHaveAttribute('aria-valuetext', /^10일, 싹 튼 씨앗 수 /);
});

test('눈으로 보기와 씨 하나 확대: 조건을 바꾸면 그릇 그림이 바뀐다', async ({ page }) => {
  await gotoUnit(page, 'g3-lifecycle');
  await expect(macro(page).getByText('젖은 솜')).toBeVisible();
  await expect(macro(page).getByText('실온 20 °C')).toBeVisible();
  await expect(macro(page).getByTestId('seed')).toHaveCount(10);
  await expect(macro(page).getByTestId('dark-box')).toHaveCount(0);
  await expect(micro(page).getByText('① 씨')).toBeVisible();
  await expect(micro(page).getByText('④ 본잎')).toBeVisible();

  await setValue(page, WATER, '물을 주지 않음');
  await expect(macro(page).getByText('마른 솜')).toBeVisible();
  await setValue(page, TEMP, '냉장고');
  await expect(macro(page).getByText('냉장고 5 °C')).toBeVisible();
  await expect(macro(page).getByTestId('env-frame')).toHaveAttribute('data-place', 'cold');
  await setValue(page, TEMP, '따뜻한 곳');
  await expect(macro(page).getByTestId('env-frame')).toHaveAttribute('data-place', 'warm');
  await setValue(page, LIGHT, '어두운 곳');
  await expect(macro(page).getByTestId('dark-box')).toBeVisible();
  await expect(macro(page).getByText('상자를 덮음')).toBeVisible();
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

  test('그림과 그래프 표식의 글자는 화면에서 13 px 이상이다 (실험 전, 어두운 곳·냉장고, 실행 뒤)', async ({ page }) => {
    await gotoUnit(page, 'g3-lifecycle');
    const check = async () => {
      for (const name of ['눈으로 보기', '씨 하나 확대해 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();

    await setValue(page, LIGHT, '어두운 곳');
    await setValue(page, TEMP, '냉장고');
    await check();
    await setValue(page, TEMP, '따뜻한 곳');
    await check();

    await selectIV(page, WATER);
    await run(page, '늘어난다');
    await check();
    const s = slider(page);
    await s.focus();
    await s.press('Home');
    await check();
    const markers = await renderedFontSizes(graph(page).locator('svg'), '[data-testid=graph-marker] text');
    expect(markers).toHaveLength(1);
    for (const { text, px } of markers) expect(px, `그래프 표식: "${text}"`).toBeGreaterThanOrEqual(13);
  });
});
