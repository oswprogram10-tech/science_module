import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const HAND = '먼저 손을 넣었던 물';
const TARGET = '재는 것';
const TOOL = '온도계';
const EYE = '눈금을 읽은 눈높이';
const LIMITS = /열전도율|열평형|적외선 복사|섭씨와 화씨/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g5-heat', { experiment: 'thermometer', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '열과 우리 생활' })).toBeVisible();
}

/** 이 활동에는 안전 점검표가 없으므로 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 온도계 눈금·손 느낌: 네 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 6);
}

const face = (page: Page) => macro(page).getByTestId('feel-face');
const barValues = async (page: Page) => bars(page).getByTestId('thermo-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));
const eyeY = async (page: Page) => Number(await macro(page).getByTestId('eye').getAttribute('data-y'));

test('세 번째 활동 탭으로 열리고(탭 넷), 앞의 활동으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
  await expect(activityTab(page, 3)).toContainText('온도계로 온도 재기');
  await expect(page.getByText('탐구 질문: 손으로 느끼는 따뜻함과 온도계로 잰 온도는 같을까?')).toBeVisible();
  await expect(page.getByText('예측: 온도계 눈금은?')).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page).toHaveURL(/#\/unit\/g5-heat\/heat-contact$/);
  await activityTab(page, 3).click();
  await expect(page).toHaveURL(/#\/unit\/g5-heat\/thermometer$/);
  await expect(page.getByRole('group', { name: HAND, exact: true })).toBeVisible();
  await page.reload();
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
});

test('기준(넣지 않음, 미지근한 물, 알코올 온도계, 같은 높이)이면 25·미지근하게 느껴짐이고 실행 전에는 손 느낌 얼굴과 결과가 없다', async ({ page }) => {
  await open(page);
  await expect(face(page)).toHaveCount(0);
  await expect(macro(page).getByTestId('thermo-note')).toContainText('실험하면');
  await expect(bars(page).getByTestId('thermo-bar')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
  expect(await page.locator('main').innerText()).not.toContain('느껴짐');

  await baselineRun(page, HAND);
  expect(await resultCells(resultRows(page).first())).toEqual(['25', '미지근하게 느껴짐']);
  for (const h of ['온도계 눈금(°C)', '손 느낌']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(face(page)).toHaveCount(1);
  await expect(face(page)).toHaveAttribute('data-feel', 'lukewarm');
  await expect(macro(page).getByTestId('thermo-note')).toHaveText('2.0초 · 온도계 눈금 25.0 °C · 손 느낌: 미지근하게 느껴짐');
  expect(await barValues(page)).toEqual([25]);
  await expect(page.getByText('가상 온도계')).toBeVisible();
  await expectSensorNear(page, '온도', 25, 0.5);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('먼저 넣었던 물만 찬물로 바꾸면 눈금은 25 그대로(변하지 않았다)인데 손 느낌은 따뜻하게 느껴짐으로 바뀌고 손 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, HAND);
  await setValue(page, HAND, '찬물(10 °C)');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['25', '따뜻하게 느껴짐']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('먼저 넣었던 물만 바꾸었어요. 같은 물인데 손 느낌은 어떻게 달랐나요? 온도계 눈금은요?');
  await expect(face(page)).toHaveAttribute('data-feel', 'warm');
  await expect(macro(page).getByTestId('prior-cup')).toHaveAttribute('data-prior', 'cold');
  // 따뜻한 물에 넣었던 손은 차갑게 느낀다.
  await setValue(page, HAND, '따뜻한 물(40 °C)');
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['25', '차갑게 느껴짐']);
  await expect(face(page)).toHaveAttribute('data-feel', 'cold');
  expect(await barValues(page)).toEqual([25, 25, 25]);
});

test('재는 것만 철봉·나무 판으로 바꾸면 눈금이 22로 같고(손 느낌은 차갑게/미지근하게로 다름) 재는 것 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, TARGET);
  await setValue(page, TARGET, '같은 방의 철봉');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['22', '차갑게 느껴짐']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('재는 것만 바꾸었어요. 철봉과 나무 판의 눈금과 손 느낌을 견주어 볼까요?');
  await expect(face(page)).toHaveAttribute('data-feel', 'cold');
  await setValue(page, TARGET, '같은 방의 나무 판');
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['22', '미지근하게 느껴짐']);
  await expect(resultRows(page).nth(2)).toContainText('결과: 변하지 않았다');
  expect(await barValues(page)).toEqual([25, 22, 22]);
});

test('눈높이는 알코올 온도계에만 영향을 준다: 위에서 26, 아래에서 24, 적외선 온도계는 25 그대로이고 눈 그림이 없다', async ({ page }) => {
  await open(page);
  await baselineRun(page, EYE);
  const levelY = await eyeY(page);
  await setValue(page, EYE, '위에서');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['26', '미지근하게 느껴짐']);
  await expect(resultRows(page).nth(1)).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('눈높이만 바꾸었어요. 눈금을 읽은 값은 어떻게 달라졌나요? 어느 높이에서 읽어야 할까요?');
  expect(await eyeY(page)).toBeLessThan(levelY);
  await setValue(page, EYE, '아래에서');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['24', '미지근하게 느껴짐']);
  expect(await eyeY(page)).toBeGreaterThan(levelY);
  expect(await barValues(page)).toEqual([25, 26, 24]);
  // 적외선 온도계: 눈높이는 영향이 없고(숫자 화면), 눈 그림도 그리지 않는다.
  await selectIV(page, TOOL);
  await setValue(page, TOOL, '적외선 온도계');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(3))).toEqual(['25', '미지근하게 느껴짐']);
  await expect(tutorBox(page)).toContainText('온도계만 바꾸었어요. 두 온도계의 눈금은 어땠나요?');
  await expect(macro(page).getByTestId('eye')).toHaveCount(0);
  await expect(macro(page).getByTestId('ir-display')).toHaveText('25 °C');
  await selectIV(page, EYE);
  await setValue(page, EYE, '위에서');
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).nth(4))).toEqual(['25', '미지근하게 느껴짐']);
  await expect(resultRows(page).nth(4)).toContainText('결과: 변하지 않았다');
});

test('막대 그래프와 그래프: 시행마다 막대, y축 0~40 °C, x축 0~2초', async ({ page }) => {
  await open(page);
  await expect(bars(page).getByText('온도계 눈금(°C)')).toBeVisible();
  await baselineRun(page, TARGET);
  await setValue(page, TARGET, '같은 방의 철봉');
  await run(page, '줄어든다');
  await expect(bars(page).getByTestId('thermo-bar')).toHaveCount(2);
  const texts = await bars(page).locator('svg text').allTextContents();
  for (const t of ['0', '10', '20', '30', '40', '1', '2', '25', '22']) expect(texts).toContain(t);
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '10', '20', '30', '40']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  // 슬라이더를 처음으로 옮기면 손 느낌 문구가 있어도 눈금이 20 °C로 돌아간다.
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('thermo-note')).toContainText('온도계 눈금 20.0 °C');
});
