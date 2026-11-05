import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const flow = (page: Page) => page.getByRole('figure', { name: '열이 드나드는 모습 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const COVER = '투명 비닐 덮개';
const AIR = '병 속 공기';
const CAP = '병 뚜껑 색';
const CO2_OPTION = '이산화 탄소를 더 넣은 공기';
const NOTICE = '⚠ 전등 갓은 뜨거워요. 이산화 탄소는 선생님이 넣어 줘요.';
const TERMS = ['복사 평형', '적외선 흡수', '복사 강제력', '탄소 순환', 'ppm'];
const LIMITS_TEXT = '실제 지구는 병보다 훨씬 크고, 바다·구름·숲 같은 많은 것이 함께 영향을 줘요.';

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

/** 기준 시행(덮개 없음, 보통 공기, 흰색 뚜껑)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 오른 온도·20분 뒤 온도: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

test('점검표를 거쳐 기준(없음, 보통 공기, 흰색)을 하면 27.8, 5.8이 보이고 상시 문구와 온도계가 있다', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  await expect(page.getByRole('heading', { level: 1, name: '기후변화와 우리 생활' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 공기층을 덮거나 이산화 탄소를 늘리면 병 속 온도는 어떻게 달라질까?')).toBeVisible();
  await expect(page.getByText('예측: 20분 동안 오른 온도는?')).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
  // 실행 전에는 결과를 보여 주지 않는다: 처음 온도뿐, 열 화살표·되돌아오는 열 라벨 없음
  await expect(macro(page).getByTestId('bottle-temp')).toHaveText('22.0°C');
  await expect(macro(page).getByTestId('bottle-note')).not.toContainText('처음보다');
  await expect(flow(page).getByTestId('heat-arrows')).toHaveCount(0);
  await expect(flow(page).getByText('빠져나가는 열')).toHaveCount(0);
  await expect(flow(page).getByText('되돌아오는 열')).toHaveCount(0);
  await expect(flow(page).getByText('공기층은 담요처럼 열이 빠져나가는 것을 늦춰요.')).toHaveCount(0);
  for (const term of TERMS) await expect(page.getByText(term)).toHaveCount(0);
  await expect(page.getByText('가상 온도계: 병 속')).toBeVisible();
  await expect(sensor(page, '온도')).toContainText('°C');

  await selectIV(page, COVER);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('전등 갓은 뜨거우니 만지지 않아요.')).toBeVisible();
  await expect(dialog.getByText('이산화 탄소는 선생님이 넣어 주세요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await resultCells(resultRows(page).first())).toEqual(['+5.8', '27.8']);
  for (const h of ['오른 온도(°C)', '20분 뒤 온도(°C)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByText('20.0분 · 병 속 27.8 °C (처음보다 +5.8 °C)')).toBeVisible();
  await expect(macro(page).getByTestId('bottle-temp')).toHaveText('27.8°C');
  await expect(sensor(page, '온도')).toContainText('27.');
  expect(await page.locator('main').innerText()).not.toMatch(/복사 평형|적외선 흡수|복사 강제력|탄소 순환|ppm/);
});

test('덮개를 씌우면 +9.6, 31.6, 결과: 늘어났다가 보이고 점선 막이 생기며 되돌아오는 열 화살표가 늘어난다', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  await baselineRun(page, COVER);
  await expect(macro(page).getByTestId('film')).toHaveCount(0);
  await expect(flow(page).getByTestId('heat-return')).toHaveCount(3);
  await expect(flow(page).getByTestId('heat-escape')).toHaveCount(5);

  await setValue(page, COVER, '씌움');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['+9.6', '31.6']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(macro(page).getByText('20.0분 · 병 속 31.6 °C (처음보다 +9.6 °C)')).toBeVisible();
  await expect(macro(page).getByTestId('film')).toBeVisible();
  await expect(macro(page).getByTestId('film').locator('rect').first()).toHaveAttribute('stroke-dasharray', '6 4');
  await expect(flow(page).getByTestId('heat-return')).toHaveCount(5);
  await expect(flow(page).getByTestId('heat-escape')).toHaveCount(3);
  await expect(tutorBox(page)).toContainText('투명 비닐 덮개만 바꾸었을 때 오른 온도는 얼마나 달라졌나요?');
});

test('새 페이지에서 공기만 바꾸면 +7.2, 29.2와 공기 전용 질문이 나오고 "이산화 탄소 +" 이름표만 붙는다', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  await baselineRun(page, AIR);
  await expect(macro(page).getByTestId('co2-label')).toHaveCount(0);
  await setValue(page, AIR, CO2_OPTION);
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['+7.2', '29.2']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('병 속 공기만 바꾸었어요. 덮개를 바꾸었을 때와 비교하면 차이가 컸나요, 작았나요? 실제 지구에서는 어떨지 생각해 볼까요?');
  await expect(macro(page).getByTestId('co2-label')).toHaveText('이산화 탄소 +');
  await expect(macro(page).getByText('20.0분 · 병 속 29.2 °C (처음보다 +7.2 °C)')).toBeVisible();
  // 기체는 보이지 않으므로 점이나 연기를 그리지 않는다
  await expect(macro(page).locator('[data-testid*=gas], [data-testid*=smoke], [data-testid*=bubble]')).toHaveCount(0);
});

test('새 페이지에서 뚜껑만 바꾸면 결과: 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  await baselineRun(page, CAP);
  await setValue(page, CAP, '파란색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['+5.8', '27.8']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('뚜껑 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('cap')).toHaveAttribute('data-color', 'blue');
});

test('덮개와 이산화 탄소를 모두 쓰면 +11.1, 33.1이고 되돌아오는 열 화살표가 6개다', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  await baselineRun(page, COVER);
  await setValue(page, COVER, '씌움');
  await setValue(page, AIR, CO2_OPTION);
  // 두 조건이 함께 바뀌어도 실행은 되고 결과는 표에 남는다
  await predict(page, '늘어난다');
  await runButton(page).click();
  await finishRun(page);
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['+11.1', '33.1']);
  await expect(flow(page).getByTestId('heat-return')).toHaveCount(6);
});

test('"모형의 한계" 글이 실행 전에도 있고 접어 두었다가 펼칠 수 있다', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  const limits = flow(page).getByTestId('model-limits');
  await expect(limits.getByText('모형의 한계', { exact: true })).toBeVisible();
  await expect(limits.getByText(LIMITS_TEXT)).toBeHidden();
  await limits.getByText('모형의 한계', { exact: true }).click();
  await expect(limits.getByText(LIMITS_TEXT)).toBeVisible();
  await baselineRun(page, COVER);
  await expect(limits.getByText(LIMITS_TEXT)).toBeVisible();
});

test('열이 드나드는 모습 보기: 시행 뒤 세 라벨과 문구가 보이고 화살표 개수가 맞다', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  await expect(flow(page).getByText('들어오는 빛', { exact: true })).toBeVisible();
  await expect(flow(page).getByTestId('light-arrow')).toHaveCount(4);
  await baselineRun(page, COVER);
  for (const l of ['들어오는 빛', '빠져나가는 열', '되돌아오는 열']) await expect(flow(page).getByText(l, { exact: true })).toBeVisible();
  await expect(flow(page).getByText('공기층은 담요처럼 열이 빠져나가는 것을 늦춰요.')).toBeVisible();
  await expect(flow(page).getByTestId('heat-arrows')).toHaveAttribute('data-total', '8');
});

test('그래프: y축 20~35(20·25·30·35), x축 0~20분, 선 하나', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  await baselineRun(page, COVER);
  await expect(graph(page).getByText('병 속 온도(°C)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(분)', { exact: true })).toBeVisible();
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '5', '10', '15', '20']);
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['20', '25', '30', '35']);
  // 덮개를 씌우고 이산화 탄소를 넣은 가장 높은 곡선(33.1 °C)도 축 안에 있다
  await setValue(page, COVER, '씌움');
  await setValue(page, AIR, CO2_OPTION);
  await predict(page, '늘어난다');
  await runButton(page).click();
  await finishRun(page);
  const yTicks2 = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks2).toEqual(['20', '25', '30', '35']);
});

test('재생이 끝난 뒤 플레이헤드는 끝(20)에 있고, 처음으로 옮기면 22.0 °C', async ({ page }) => {
  await gotoUnit(page, 'g4-climate');
  await baselineRun(page, COVER);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '20');
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByText('0.0분 · 병 속 22.0 °C (처음보다 +0.0 °C)')).toBeVisible();
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

  test('눈으로 보기와 열이 드나드는 모습 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g4-climate');
    const check = async () => {
      for (const name of ['눈으로 보기', '열이 드나드는 모습 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, COVER);
    await check();
    await setValue(page, COVER, '씌움');
    await setValue(page, AIR, CO2_OPTION);
    await run(page, '늘어난다');
    await check();
  });
});
