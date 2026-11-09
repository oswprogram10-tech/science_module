import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const reachView = (page: Page) => page.getByRole('figure', { name: '자석의 힘이 미치는 곳' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const GAP = '자석과 클립 사이의 거리';
const MAGNETS = '자석의 수';
const BETWEEN = '사이에 둔 물체';
const NOTICE = '⚠ 자석은 휴대 전화·카드와 떨어진 곳에서 써요.';

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

/** 기준 시행(0.5 cm, 1개, 없음)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 끌려온 클립 수: 세 조건 다음 칸 */
async function clipsCell(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 4);
}

test('점검표를 거쳐 기준(0.5 cm, 1개, 없음)을 하면 5가 보이고 상시 문구와 가상 거리 센서가 있다', async ({ page }) => {
  await gotoUnit(page, 'g4-magnet');
  await expect(page.getByRole('heading', { level: 1, name: '자석의 이용' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 자석과 클립 사이의 거리가 멀어지면 자석이 끌어당기는 클립의 수는 어떻게 달라질까?')).toBeVisible();
  await expect(page.getByText('예측: 끌려온 클립의 수는?')).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
  // 실행 전에는 답(붙은 클립 수)을 보여 주지 않는다
  await expect(macro(page).getByTestId('magnet-note')).not.toContainText(/\d개/);
  await expect(macro(page).getByTestId('clips')).toHaveAttribute('data-count', '0');
  for (const term of ['자기력', '자기장', '자기력선', '투자율', '강자성']) await expect(page.getByText(term)).toHaveCount(0);

  await selectIV(page, GAP);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('작은 자석은 입에 넣지 않아요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await clipsCell(resultRows(page).first())).toEqual(['5']);
  await expect(page.getByRole('columnheader', { name: '끌려온 클립의 수(개)' })).toBeVisible();
  await expect(macro(page).getByText('6.0초 · 자석 높이 5.0 cm · 붙은 클립 5개')).toBeVisible();
  await expect(macro(page).getByTestId('clips')).toHaveAttribute('data-count', '5');
  await expect(page.getByText('가상 거리 센서')).toBeVisible();
  await expect(sensor(page, '거리')).toContainText('cm');
  await expect(reachView(page).getByText('자석의 힘은 자석에서 멀어질수록 약해져요.')).toBeVisible();
  // 안전 경고 문구는 산·염기 전용이 아니다
  expect(await page.locator('main').innerText()).not.toMatch(/산성|용액|자기력|자기장/);
});

test('거리를 2 cm로 바꾸면 0, 결과: 줄어들었다, 거리 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-magnet');
  await baselineRun(page, GAP);

  await setValue(page, GAP, '2 cm');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await clipsCell(row2)).toEqual(['0']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText("거리만 바꾸었어요. '자석의 힘이 미치는 곳' 그림에서 클립 더미는 어디쯤에 있었나요?");
  await expect(macro(page).getByText('붙은 클립 0개')).toBeVisible();
});

test('새 페이지에서 사이 물체를 종이로 바꾸면 5, 결과: 변하지 않았다, 사이 물체 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-magnet');
  await baselineRun(page, BETWEEN);

  await setValue(page, BETWEEN, '종이');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await clipsCell(row2)).toEqual(['5']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('사이에 둔 물체만 바꾸었어요. 어떤 물체를 두었을 때 클립이 끌려왔고, 어떤 물체일 때 달랐나요? 그 물체는 무엇으로 만들어졌을까요?');
  await expect(macro(page).getByTestId('between')).toHaveAttribute('data-kind', 'paper');
  await expect(macro(page).getByText('종이', { exact: true })).toBeVisible();
});

test('새 페이지에서 사이 물체를 얇은 철판으로 바꾸면 0이고 철판 안에 무늬가 모인다', async ({ page }) => {
  await gotoUnit(page, 'g4-magnet');
  await baselineRun(page, BETWEEN);

  await setValue(page, BETWEEN, '얇은 철판');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await clipsCell(row2)).toEqual(['0']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(macro(page).getByTestId('between')).toHaveAttribute('data-kind', 'iron');
  await expect(macro(page).getByText('얇은 철판', { exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('clips')).toHaveAttribute('data-count', '0');
  await expect(reachView(page).getByTestId('reach-dots')).toHaveAttribute('data-extent', '0.0');
});

test('자석 2개, 0 cm이면 19이다', async ({ page }) => {
  await gotoUnit(page, 'g4-magnet');
  await selectIV(page, MAGNETS);
  await setValue(page, MAGNETS, '2개 (겹쳐서)');
  await setValue(page, GAP, '0 cm (닿게)');
  await run(page, '늘어난다', true);
  expect(await clipsCell(resultRows(page).first())).toEqual(['19']);
  await expect(macro(page).getByTestId('clips')).toHaveAttribute('data-count', '19');
  await expect(macro(page).getByTestId('bar-magnet')).toHaveCount(2);
  await expect(macro(page).getByText('붙은 클립 19개')).toBeVisible();
});

test('그래프: y축 정수 눈금, x축 0~6초, 표식 두 개', async ({ page }) => {
  await gotoUnit(page, 'g4-magnet');
  await baselineRun(page, GAP);
  await expect(graph(page).getByText('붙은 클립의 수(개)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(초)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('가장 가까이')).toBeVisible();
  await expect(graph(page).getByText('들어 올리기')).toBeVisible();
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '1', '2', '3', '4', '5', '6']);
});

test('재생이 끝난 뒤 플레이헤드는 끝(6)에 있다', async ({ page }) => {
  await gotoUnit(page, 'g4-magnet');
  await baselineRun(page, GAP);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '6');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(macro(page).getByText('붙은 클립 0개')).toBeVisible();
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

  test('눈으로 보기와 자석의 힘이 미치는 곳의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g4-magnet');
    const check = async () => {
      for (const name of ['눈으로 보기', '자석의 힘이 미치는 곳']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, GAP);
    await check();
    await setValue(page, BETWEEN, '플라스틱 판');
    await setValue(page, MAGNETS, '2개 (겹쳐서)');
    await run(page, '늘어난다');
    await check();
  });
});
