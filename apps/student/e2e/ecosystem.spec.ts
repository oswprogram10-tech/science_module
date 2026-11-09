import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const web = (page: Page) => page.getByRole('figure', { name: '먹이 그물로 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });

const RABBITS = '처음 토끼 수';
const FOXES = '처음 여우 수';
const RAIN = '비가 오는 정도';
const FUR = '토끼 털 색';
const NO_FOX = '0마리 (여우 없음)';

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

/** 기준 시행(토끼 10마리, 여우 2마리, 비 보통, 흰색)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '줄어든다');
}

/** 결과표 한 줄의 값: 조건 네 칸 다음의 60일 뒤 풀, 토끼, 여우, 가장 많았던 토끼 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 8);
}

test('기준(토끼 10, 여우 2, 보통, 흰색)이면 71(풀), 6, 2, 10이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await expect(page.getByRole('heading', { level: 1, name: '생물과 환경' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 풀, 토끼, 여우가 사는 곳에서 어떤 조건이 바뀌면 생물의 수는 어떻게 달라질까?')).toBeVisible();
  await expect(page.getByText('로트카')).toHaveCount(0);
  await baselineRun(page, FOXES);
  expect(await resultCells(resultRows(page).first())).toEqual(['71', '6', '2', '10']);
  for (const name of ['60일 뒤 풀(%)', '60일 뒤 토끼(마리)', '60일 뒤 여우(마리)', '가장 많았던 토끼(마리)']) {
    await expect(page.getByRole('columnheader', { name })).toBeVisible();
  }
  // 재생이 끝나면 60일에 멈춘다.
  await expect(macro(page).getByText('60일째 · 풀 71% · 토끼 6마리 · 여우 2마리')).toBeVisible();
  await expect(macro(page).getByTestId('rabbit')).toHaveCount(6);
  await expect(macro(page).getByTestId('fox')).toHaveCount(2);
  await expect(web(page).getByText('71%', { exact: true })).toBeVisible();
  await expect(web(page).getByText('6마리', { exact: true })).toBeVisible();
  await expect(web(page).getByText('2마리', { exact: true })).toBeVisible();
  await expect(web(page).getByText('화살표는 먹고 먹히는 관계를 나타내요.')).toBeVisible();
  // 이 단원에는 센서가 없다.
  await expect(page.getByRole('group', { name: '센서' })).toHaveCount(0);
  await expect(page.getByText('모의 센서')).toHaveCount(0);
});

test('여우를 0으로 바꾸면 4(풀), 22(가장 많았던 토끼), 줄어들었다이고 여우 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await baselineRun(page, FOXES);

  await setValue(page, FOXES, NO_FOX);
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['4', '6', '0', '22']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('여우의 수만 바꾸었어요. 그래프에서 토끼가 가장 많았던 때와 그 뒤 풀의 양은 어떻게 달랐나요? 먹이 그물 그림에서 무엇이 빠졌을까요?');
  await expect(macro(page).getByText('60일째 · 풀 4% · 토끼 6마리 · 여우 0마리')).toBeVisible();
  await expect(macro(page).getByTestId('fox')).toHaveCount(0);
  await expect(web(page).getByTestId('fox-box')).toHaveAttribute('data-empty', 'true');
});

test('새 페이지에서 털 색만 갈색으로 바꾸면 결과가 같고 변하지 않았다이며 털 색 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await baselineRun(page, FUR);

  await setValue(page, FUR, '갈색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['71', '6', '2', '10']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('털 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('rabbit').first()).toHaveAttribute('data-fur', 'brown');
  await expect(macro(page).getByText('토끼 털 색: 갈색')).toBeVisible();
});

test('비가 많으면 82(풀), 7, 3, 10이고 구름과 빗줄기가 늘어난다', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await expect(macro(page).getByTestId('cloud')).toHaveCount(2);
  await expect(macro(page).getByTestId('rain-line')).toHaveCount(6);
  await expect(macro(page).getByText('비 보통')).toBeVisible();
  await baselineRun(page, RAIN);
  await setValue(page, RAIN, '많이');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['82', '7', '3', '10']);
  await expect(macro(page).getByText('비 많이')).toBeVisible();
  await expect(macro(page).getByTestId('cloud')).toHaveCount(3);
  await expect(macro(page).getByTestId('rain-line')).toHaveCount(10);
  // 시행이 있으면 그림은 그 시행의 조건을 보여 주므로, 새 화면에서 비를 적게 바꿔 본다.
  await gotoUnit(page, 'g4-ecosystem');
  await page.reload();
  await setValue(page, RAIN, '적게');
  await expect(macro(page).getByTestId('cloud')).toHaveCount(1);
  await expect(macro(page).getByTestId('rain-line')).toHaveCount(3);
});

test('토끼 20마리면 처음에 20마리가 보이고 결과는 76, 2, 3, 20이며 10마리로 바꾸면 71, 6, 2, 10이다', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await setValue(page, RABBITS, '20마리');
  await expect(macro(page).getByTestId('rabbit')).toHaveCount(20);
  await baselineRun(page, RABBITS);
  expect(await resultCells(resultRows(page).first())).toEqual(['76', '2', '3', '20']);
  await setValue(page, RABBITS, '10마리');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['71', '6', '2', '10']);
  await expect(macro(page).getByTestId('rabbit')).toHaveCount(6);
});

test('그래프: 범례 세 개(글자·선 모양·색), 세 선, x 라벨 "날짜(일)", 눈금 0~60, 슬라이더를 따라 눈으로 보기가 바뀐다', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await expect(graph(page).getByTestId('graph-legend-item')).toHaveCount(0);
  await baselineRun(page, FOXES);
  const legend = graph(page).getByTestId('graph-legend-item');
  await expect(legend).toHaveCount(3);
  await expect(legend.nth(0)).toHaveText('풀의 양(%)');
  await expect(legend.nth(1)).toHaveText('토끼 수(마리)');
  await expect(legend.nth(2)).toHaveText('여우 수(마리)');
  const dashes = await legend.locator('line').evaluateAll((els) => els.map((e) => e.getAttribute('stroke-dasharray')));
  const colors = await legend.locator('line').evaluateAll((els) => els.map((e) => e.getAttribute('stroke')));
  expect(new Set(dashes).size).toBe(3);
  expect(new Set(colors).size).toBe(3);
  await expect(graph(page).getByTestId('graph-series')).toHaveCount(3);
  await expect(graph(page).getByText('날짜(일)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toHaveCount(0);
  await expect(graph(page).getByText('수(마리) / 풀의 양(%)')).toBeVisible();
  const ticks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(ticks).toEqual(['0', '10', '20', '30', '40', '50', '60']);
  await expect(graph(page).getByTestId('graph-marker')).toHaveCount(0);

  const s = slider(page);
  await s.focus();
  await s.press('Home');
  await expect(macro(page).getByText('0일째 · 풀 80% · 토끼 10마리 · 여우 2마리')).toBeVisible();
  await expect(macro(page).getByTestId('rabbit')).toHaveCount(10);
  await s.press('End');
  await expect(macro(page).getByText('60일째 · 풀 71% · 토끼 6마리 · 여우 2마리')).toBeVisible();
  await expect(s).toHaveAttribute('aria-valuetext', /^60일, 풀의 양\(%\) 70\.7, 토끼 수\(마리\) 5\.9, 여우 수\(마리\) 2\.4$/);
});

test('여우 0마리이면 먹이 그물 여우 칸에 "없음"이 보이고, 앞 시행은 풀만 겹쳐 그린다', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await expect(web(page).getByText('없음', { exact: true })).toHaveCount(0);
  await setValue(page, FOXES, NO_FOX);
  await expect(web(page).getByText('없음', { exact: true })).toBeVisible();
  await expect(macro(page).getByText('여우가 없어요')).toBeVisible();
  await expect(web(page).getByTestId('fox-box')).toHaveAttribute('data-empty', 'true');
  await expect(web(page).getByText('비생물 요소')).toBeVisible();
  await expect(web(page).getByText('먹힘', { exact: true })).toHaveCount(2);
  await setValue(page, FOXES, '2마리');
  await expect(web(page).getByText('없음', { exact: true })).toHaveCount(0);

  await baselineRun(page, FOXES);
  await setValue(page, FOXES, NO_FOX);
  await run(page, '줄어든다');
  await expect(graph(page).getByTestId('graph-series')).toHaveCount(3);
  await expect(graph(page).locator('polyline[opacity="0.6"]')).toHaveCount(1);
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

  test('그림의 글자는 화면에서 13 px 이상이다 (실험 전, 여우 0마리, 비 많이·갈색, 실행 뒤)', async ({ page }) => {
    await gotoUnit(page, 'g4-ecosystem');
    const check = async () => {
      for (const name of ['눈으로 보기', '먹이 그물로 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await setValue(page, FOXES, NO_FOX);
    await check();
    await setValue(page, FOXES, '4마리');
    await setValue(page, RAIN, '많이');
    await setValue(page, FUR, '갈색');
    await setValue(page, RABBITS, '20마리');
    await check();

    await selectIV(page, FOXES);
    await run(page, '줄어든다');
    await check();
    const s = slider(page);
    await s.focus();
    await s.press('Home');
    await check();
    await s.press('PageUp');
    await check();
  });
});
