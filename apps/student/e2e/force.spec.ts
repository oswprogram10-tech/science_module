import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const turn = (page: Page) => page.getByRole('figure', { name: '돌리려는 정도 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const COUNT = '오른쪽 추의 수';
const DISTANCE = '오른쪽 추의 거리';
const SHAPE = '추의 모양';

async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 기준 시행(2개, 4칸, 원기둥)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 값: 추의 수, 거리, 모양 다음의 기울어진 쪽, 오른쪽 끝의 높이 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

test('기준(2개, 4칸, 원기둥)은 수평이고 오른쪽 끝의 높이 10이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  await expect(page.getByRole('heading', { level: 1, name: '힘과 우리 생활' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 막대의 수평을 잡으려면 물체를 어디에 놓아야 할까?')).toBeVisible();
  for (const term of ['지레', '돌림힘', '모멘트', '평형', '관성', '토크']) await expect(page.locator('main').getByText(term)).toHaveCount(0);
  await expect(page.getByText('예측: 오른쪽 끝의 높이는?')).toBeVisible();
  await baselineRun(page, DISTANCE);

  expect(await resultCells(resultRows(page).first())).toEqual(['수평', '10']);
  for (const name of ['기울어진 쪽', '오른쪽 끝의 높이(cm)']) await expect(page.getByRole('columnheader', { name })).toBeVisible();
  await expect(macro(page).getByText('기울어진 쪽: 수평이에요 · 오른쪽 끝 높이 10 cm')).toBeVisible();
  await expect(macro(page).getByText('느린 화면')).toBeVisible();
  await expect(macro(page).getByTestId('touch-mark')).toHaveCount(0);
  await expect(sensor(page, '기울기')).toContainText('°');
  await expect(page.getByText('가상 기울기 센서')).toBeVisible();
  // 안전 점검표는 없다
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('거리를 8칸으로 바꾸면 0, 결과: 줄어들었다, 거리 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  await baselineRun(page, DISTANCE);

  await setValue(page, DISTANCE, '받침점에서 8칸');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['오른쪽이 내려감', '0']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('추의 거리만 바꾸었어요. 같은 추라도 놓는 자리에 따라 막대가 어떻게 달라졌나요? 수평이 된 자리가 있었나요?');
  await expect(macro(page).getByText('기울어진 쪽: 오른쪽이 내려갔어요 · 오른쪽 끝 높이 0 cm')).toBeVisible();
  await expect(macro(page).getByTestId('touch-mark')).toBeVisible();
  await expect(sensor(page, '기울기')).toContainText('12.');
  // 그래프: y축 0~20 고정, 라벨, 소수 한 자리 x 눈금
  await expect(graph(page).getByText('오른쪽 끝 높이(cm)')).toBeVisible();
  await expect(graph(page).getByText('시간(초, 느린 화면)', { exact: true })).toBeVisible();
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['0', '5', '10', '15', '20']);
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0.0', '0.2', '0.4', '0.6', '0.8', '1.0']);
  await expect(graph(page).getByTestId('graph-marker')).toHaveCount(0);
});

test('새 페이지에서 추를 1개로 바꾸면 20, 결과: 늘어났다, 추의 수 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  await baselineRun(page, COUNT);

  await setValue(page, COUNT, '1개');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['왼쪽이 내려감', '20']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('추의 수만 바꾸었어요. 추가 늘었을 때 수평을 다시 잡으려면 추를 어디로 옮겨 보면 좋을까요?');
  await expect(macro(page).getByText('기울어진 쪽: 왼쪽이 내려갔어요 · 오른쪽 끝 높이 20 cm')).toBeVisible();
  await expect(sensor(page, '기울기')).toContainText('-12.');
});

test('새 페이지에서 모양만 바꾸면 10 그대로이고 결과: 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  await baselineRun(page, SHAPE);

  await setValue(page, SHAPE, '정육면체');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['수평', '10']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('모양만 바꾸었을 때 막대는 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('weight').first()).toHaveAttribute('data-shape', 'cube');
});

test('1개 8칸이면 수평이다 (추가 적으면 멀리 놓아 수평을 잡는다)', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  await selectIV(page, COUNT);
  await setValue(page, COUNT, '1개');
  await setValue(page, DISTANCE, '받침점에서 8칸');
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).first())).toEqual(['수평', '10']);
  await expect(macro(page).getByText('기울어진 쪽: 수평이에요 · 오른쪽 끝 높이 10 cm')).toBeVisible();
  await expect(macro(page).getByTestId('weight')).toHaveCount(3);
});

test('4개 2칸도 수평이다', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  await selectIV(page, COUNT);
  await setValue(page, COUNT, '4개');
  await setValue(page, DISTANCE, '받침점에서 2칸');
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).first())).toEqual(['수평', '10']);
});

test('돌리려는 정도 그림은 실험을 하면 나타나고 숫자가 없다', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  const t = turn(page);
  await expect(t).toBeVisible();
  // 실험 전에는 두 막대로 답을 미리 비교하지 못하게 한다.
  await expect(t.getByTestId('turn-left')).toHaveCount(0);
  await expect(t.getByText('실험을 하면 두 막대가 나타나요')).toBeVisible();
  await expect(t.getByTestId('arrow')).toHaveCount(4);

  await baselineRun(page, DISTANCE);
  await expect(t.getByTestId('turn-left')).toBeVisible();
  await expect(t.getByTestId('turn-right')).toBeVisible();
  await expect(t.getByText('두 쪽이 같아요')).toBeVisible();
  await expect(t.getByText('추가 막대를 돌리려는 정도는 추의 무게와 놓은 자리에 따라 달라져요.')).toBeVisible();
  expect(await t.innerText()).not.toMatch(/\d/);
  const left = await t.getByTestId('turn-left').evaluate((el) => el.getBoundingClientRect().width);
  const right = await t.getByTestId('turn-right').evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.abs(left - right)).toBeLessThan(0.5);

  await setValue(page, DISTANCE, '받침점에서 8칸');
  await run(page, '늘어난다'); // 일부러 틀리게 예측한다(실제로는 줄어든다).
  await expect(t.getByText('한쪽이 더 커요')).toBeVisible();
  const right2 = await t.getByTestId('turn-right').evaluate((el) => el.getBoundingClientRect().width);
  expect(right2).toBeGreaterThan(left * 1.5);
  expect(await t.innerText()).not.toMatch(/\d/);
  await expect(t.getByTestId('arrow')).toHaveCount(4);
  // 예측과 결과가 달랐으므로 돌리려는 정도 그림을 보라는 질문
  await expect(tutorBox(page)).toContainText('돌리려는 정도 보기');
});

test('곱셈 규칙을 화면 어디에도 말하지 않는다', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  await baselineRun(page, DISTANCE);
  await setValue(page, DISTANCE, '받침점에서 8칸');
  await run(page, '줄어든다');
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/곱하|곱한|무게×|×거리|무게와 거리/);
  expect(text).not.toMatch(/무거운 쪽으로 기울|멀수록 더 많이|가깝게 놓/);
});

test('재생이 끝난 뒤 플레이헤드는 끝(1.0초)에 있고, 다시 실행해도 처음부터 재생된다', async ({ page }) => {
  await gotoUnit(page, 'g3-force');
  await baselineRun(page, DISTANCE);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await expect(slider).toHaveAttribute('aria-valuetext', /^1초, 느린 화면, 오른쪽 끝 높이 10 cm$/);
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByText('기울어진 쪽: 수평이에요 · 오른쪽 끝 높이 10 cm')).toBeVisible();
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

  test('눈으로 보기와 돌리려는 정도 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g3-force');
    const check = async () => {
      for (const name of ['눈으로 보기', '돌리려는 정도 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, DISTANCE);
    await check();
    await setValue(page, DISTANCE, '받침점에서 8칸');
    await setValue(page, SHAPE, '정육면체');
    await run(page, '줄어든다');
    await check();
  });
});
