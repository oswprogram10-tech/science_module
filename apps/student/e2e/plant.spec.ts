import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const micro = (page: Page) => page.getByRole('figure', { name: '잎 확대해 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });

const LEAVES = '잎의 수';
const LIGHT = '빛';
const WIND = '바람';
const START = '처음 물의 양';

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

/** 기준 시행(8장, 밝은 곳, 바람 없음, 100 mL)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '줄어든다');
}

/** 결과표 한 줄의 값: 잎, 빛, 바람, 처음 물 다음의 줄어든 물, 남은 물, 물방울 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 7);
}

test('기준(8장, 밝은 곳, 바람 없음, 100 mL)이면 19.2, 80.8, 많음이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await expect(page.getByRole('heading', { level: 1, name: '식물의 구조와 기능' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 잎이 달린 줄기를 꽂아 둔 물은 어떤 조건에서 더 많이 줄어들까?')).toBeVisible();
  await expect(page.getByText('공변세포')).toHaveCount(0);
  await baselineRun(page, LEAVES);
  expect(await resultCells(resultRows(page).first())).toEqual(['19.2', '80.8', '많음']);
  await expect(page.getByRole('columnheader', { name: '이틀 동안 줄어든 물(mL)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '남은 물(mL)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '비닐봉지 속 물방울' })).toBeVisible();
  // 재생이 끝나면 48시간에 멈춘다.
  await expect(macro(page).getByText('48시간 · 남은 물 80.8 mL')).toBeVisible();
  await expect(macro(page).getByTestId('leaf')).toHaveCount(8);
  await expect(macro(page).getByTestId('droplet')).toHaveCount(18);
  await expect(page.getByText('가상 습도 센서: 비닐봉지 안')).toBeVisible();
  await expect(page.getByText('가상 빛 센서')).toBeVisible();
  await expect(sensor(page, '습도')).toContainText('%');
  await expect(sensor(page, '빛 세기')).toContainText('%');
});

test('잎을 0장으로 바꾸면 0.0, 없음, 줄어들었다이고 잎 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await baselineRun(page, LEAVES);

  await setValue(page, LEAVES, '0장');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['0.0', '100.0', '없음']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('잎의 수만 바꾸었어요. 잎을 모두 딴 줄기와 잎이 달린 줄기에서 비닐봉지 안은 어떻게 달랐나요? 물은 어디로 갔을까요?');
  await expect(macro(page).getByTestId('leaf')).toHaveCount(0);
  await expect(macro(page).getByText('잎을 딴 자국')).toBeVisible();
  await expect(macro(page).getByTestId('droplet')).toHaveCount(0);
  await expect(micro(page).getByText('잎이 없어요', { exact: true })).toBeVisible();
});

test('새 페이지에서 처음 물만 150 mL로 바꾸면 19.2, 130.8, 변하지 않았다이고 처음 물 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await baselineRun(page, START);

  await setValue(page, START, '150 mL');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['19.2', '130.8', '많음']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('처음 물의 양만 바꾸었을 때 줄어든 양은 어떻게 되었나요? 남은 양과 줄어든 양을 구분해서 볼까요?');
  await expect(macro(page).getByText('48시간 · 남은 물 130.8 mL')).toBeVisible();
});

test('어두운 곳이면 4.8이고, 바람이 있으면 28.8이다', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await baselineRun(page, LIGHT);

  await setValue(page, LIGHT, '어두운 곳');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['4.8', '95.2', '조금']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(macro(page).getByTestId('dark-bg')).toBeVisible();
  await expect(macro(page).getByText('어두운 곳', { exact: true })).toBeVisible();
  await expect(micro(page).getByText('기공이 조금만 열렸어요')).toBeVisible();

  await setValue(page, LIGHT, '밝은 곳');
  await setValue(page, WIND, '선풍기 약하게');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['28.8', '71.2', '많음']);
  await expect(macro(page).getByTestId('fan')).toBeVisible();
  await expect(macro(page).getByText('선풍기', { exact: true })).toBeVisible();
});

test('잎 확대 그림에 기공, 물관 라벨과 설명 문구가 보인다', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await expect(micro(page).getByText('기공', { exact: true })).toBeVisible();
  await expect(micro(page).getByText('물관', { exact: true })).toBeVisible();
  await expect(micro(page).getByText('물은 뿌리와 줄기를 거쳐 잎의 기공으로 빠져나가요.')).toBeVisible();
  await expect(micro(page).getByTestId('stoma')).toHaveCount(4);
  await setValue(page, LEAVES, '0장');
  await expect(micro(page).getByText('잎이 없어요', { exact: true })).toBeVisible();
  await expect(micro(page).getByTestId('stoma')).toHaveCount(0);
  await expect(micro(page).getByText('물관', { exact: true })).toBeVisible();
});

test('그래프: x 라벨 "시간(시간)", 눈금 0·12·…·48, "하루" 표식, 슬라이더를 따라 눈으로 보기가 바뀐다', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await baselineRun(page, LEAVES);
  await expect(graph(page).getByText('시간(시간)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toHaveCount(0);
  await expect(graph(page).getByText('남은 물의 양(mL)')).toBeVisible();
  const ticks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(ticks).toEqual(['0', '12', '24', '36', '48']);
  const markers = graph(page).getByTestId('graph-marker');
  await expect(markers).toHaveCount(1);
  await expect(markers.first()).toContainText('하루');

  const s = slider(page);
  await s.focus();
  await s.press('Home');
  await expect(macro(page).getByText('0시간 · 남은 물 100.0 mL')).toBeVisible();
  await expect(macro(page).getByTestId('droplet')).toHaveCount(0);
  await expect(micro(page).getByText('물은 뿌리와 줄기를 거쳐 잎의 기공으로 빠져나가요.')).toBeVisible();
  await s.press('End');
  await expect(macro(page).getByText('48시간 · 남은 물 80.8 mL')).toBeVisible();
  await expect(s).toHaveAttribute('aria-valuetext', /^48시간, 남은 물의 양 /);
});

test('조건을 바꾸면 눈으로 보기 그림이 바뀐다', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await expect(macro(page).getByTestId('leaf')).toHaveCount(8);
  await expect(macro(page).getByTestId('dark-bg')).toHaveCount(0);
  await expect(macro(page).getByTestId('fan')).toHaveCount(0);
  await expect(macro(page).getByText('식용유')).toBeVisible();
  await expect(macro(page).getByText('비닐봉지')).toBeVisible();
  await setValue(page, LEAVES, '4장');
  await expect(macro(page).getByTestId('leaf')).toHaveCount(4);
  await setValue(page, LIGHT, '어두운 곳');
  await expect(macro(page).getByTestId('dark-bg')).toBeVisible();
  await setValue(page, WIND, '선풍기 약하게');
  await expect(macro(page).getByTestId('fan')).toBeVisible();
  await expect(macro(page).getByTestId('wind-lines')).toBeVisible();
});

test.describe('움직임', () => {
  test('수증기 점이 움직이고, 단원을 나가면 멈춘다', async ({ page }) => {
    await gotoUnit(page, 'g6-plant');
    const svg = micro(page).locator('svg');
    await expect(svg).toHaveAttribute('data-animating', 'true');
    const dot = micro(page).getByTestId('vapor-dot').first();
    const y1 = await dot.getAttribute('cy');
    await expect.poll(async () => dot.getAttribute('cy')).not.toBe(y1);
    await setValue(page, LEAVES, '0장');
    await expect(svg).toHaveAttribute('data-animating', 'false');
    await setValue(page, LEAVES, '8장');
    await page.getByRole('link', { name: '← 단원 목록' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  });

  test.describe('움직임 줄이기', () => {
    test.use({ reducedMotion: 'reduce' });
    test('수증기 점이 멈춰 있다', async ({ page }) => {
      await gotoUnit(page, 'g6-plant');
      const svg = micro(page).locator('svg');
      await expect(svg).toHaveAttribute('data-animating', 'false');
      const dot = micro(page).getByTestId('vapor-dot').first();
      const y1 = await dot.getAttribute('cy');
      await page.waitForTimeout(400);
      expect(await dot.getAttribute('cy')).toBe(y1);
      await expect(micro(page).getByTestId('vapor-dot')).toHaveCount(16);
    });
  });
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

  test('그림과 그래프 표식의 글자는 화면에서 13 px 이상이다 (실험 전, 잎 0장·어두운 곳·바람, 실행 뒤)', async ({ page }) => {
    await gotoUnit(page, 'g6-plant');
    const check = async () => {
      for (const name of ['눈으로 보기', '잎 확대해 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();

    await setValue(page, LIGHT, '어두운 곳');
    await setValue(page, WIND, '선풍기 약하게');
    await check();
    await setValue(page, LEAVES, '0장');
    await check();
    await setValue(page, LEAVES, '4장');
    await setValue(page, LIGHT, '밝은 곳');
    await check();

    await selectIV(page, LEAVES);
    await run(page, '줄어든다');
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
