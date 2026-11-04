import type { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  gotoUnit,
  selectIV,
  setValue,
  predict,
  runButton,
  resultRows,
  confirmSafetyDialog,
} from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const DIRECT_SUN_WARNING = '⚠ 렌즈로 해를 직접 보면 눈을 크게 다칠 수 있어요.';
const SCORCH_WARNING = '⚠ 종이가 그을리고 있어요. 실제 실험에서는 바로 렌즈를 치워요.';

/** 실행 버튼이 다시 '▶ 실험 실행'이 될 때까지(재생이 끝날 때까지) 기다린다. */
async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 거리를 바꿀 조건으로 골라 기준 시행(5 cm, 많이 볼록, 작은 렌즈)을 한다. */
async function baselineRun(page: Page) {
  await selectIV(page, '렌즈와 종이 사이 거리');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);
}

test('처음 실행할 때 점검표를 거쳐 기준 시행을 하면 30.0과 20.0이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  await selectIV(page, '렌즈와 종이 사이 거리');
  await predict(page, '늘어난다');

  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('렌즈로 해를 직접 보지 않아요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  const row1 = resultRows(page).first();
  await expect(row1).toContainText('20.0'); // 빛 원의 지름(mm)
  await expect(row1).toContainText('햇빛의 4배');
  await expect(row1).toContainText('30.0'); // 1분 뒤 온도
  await expect(row1).not.toContainText('그을림');
  await expect(page.getByText('빛 원 20.0 mm · 30.0 °C')).toBeVisible();
  await expect(page.getByRole('status', { name: '온도', exact: true })).toContainText('°C');
  await expect(page.getByText('가상 온도 센서: 종이 아래')).toBeVisible();
});

test('10 cm에서는 그을리고(늘어났다·거리 전용 질문), 20 cm에서는 다시 줄어든다', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  await baselineRun(page);
  await expect(resultRows(page).first()).toContainText('30.0');

  await setValue(page, '렌즈와 종이 사이 거리', '10 cm');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeHidden(); // 점검표는 한 번만
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('235.1');
  await expect(row2).toContainText('1000배 이상');
  await expect(row2).toContainText('그을림');
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(page.getByText(SCORCH_WARNING)).toBeVisible();
  await expect(page.getByText('햇빛의 1000배 이상')).toBeVisible();
  await expect(tutorBox(page)).toContainText('거리만 바꾸었어요. 빛의 길 화면에서 빛이 한곳에 모이는 곳과 종이의 위치를 비교해 볼까요?');

  // 거리를 더 늘리면 다시 식는다: 증가만 하는 관계가 아니다.
  await setValue(page, '렌즈와 종이 사이 거리', '20 cm');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await finishRun(page);

  const row3 = resultRows(page).nth(2);
  await expect(row3).toContainText('25.0');
  await expect(row3).toContainText('결과: 줄어들었다');
  await expect(page.getByText(SCORCH_WARNING)).toBeHidden();
  await expect(page.getByText('빛 원 40.0 mm · 25.0 °C')).toBeVisible();
});

test('새 페이지에서 5 cm에 렌즈 크기만 큰 렌즈로 바꾸면 변하지 않았다가 나온다', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  await selectIV(page, '렌즈의 크기');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);
  await expect(resultRows(page).first()).toContainText('30.0');

  await setValue(page, '렌즈의 크기', '큰 렌즈 (지름 8 cm)');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('30.0');
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('렌즈의 크기만 바꾸었을 때 빛 원의 크기와 밝기');
});

test('빛의 길 화면에 빛이 모이는 곳과 안내 문구가 보이고, 거리 눈금과 종이 위치가 따라 바뀐다', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  const ray = page.getByRole('figure', { name: '빛의 길로 보기' });
  await expect(ray.getByText('빛이 한곳에 모이는 곳')).toBeVisible();
  await expect(ray.getByText('빛은 렌즈를 지나면서 꺾여요.')).toBeVisible();
  await expect(ray.getByText('종이', { exact: true })).toBeVisible();
  for (const tick of ['0', '5', '10', '15', '20 cm']) await expect(ray.getByText(tick, { exact: true })).toBeVisible();

  // 광선은 7개이고, 거리를 바꾸면 종이에 닿는 광선 끝이 따라 움직인다(많이 볼록, 작은 렌즈: 5 cm → 폭 20 mm).
  const lines = ray.getByTestId('rays').locator('line');
  await expect(lines).toHaveCount(7);
  const endY = () => lines.first().getAttribute('y2');
  const y5 = Number(await endY());
  await setValue(page, '렌즈와 종이 사이 거리', '20 cm');
  const y20 = Number(await endY());
  expect(y20 - y5).toBeCloseTo(15 * 11, 5); // 15 cm × 11 px
});

test('밝기는 글자로도 보이고, 렌즈와 종이 사이 간격이 거리에 따라 눈에 띄게 달라진다', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  const macro = page.getByRole('figure', { name: '눈으로 보기' });
  await expect(macro.getByText('햇빛의 4배')).toBeVisible();
  const spotY = async () => Number(await macro.getByTestId('light-spot').getAttribute('cy'));
  const y5 = await spotY();
  await setValue(page, '렌즈와 종이 사이 거리', '20 cm');
  await expect(macro.getByText('햇빛의 1배')).toBeVisible();
  expect((await spotY()) - y5).toBeGreaterThanOrEqual(100);
});

test('실행 버튼 아래에 해를 직접 보지 말라는 경고가 항상 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  await expect(page.getByText(DIRECT_SUN_WARNING)).toBeVisible();
  await baselineRun(page);
  await expect(page.getByText(DIRECT_SUN_WARNING)).toBeVisible();
});

test.describe('1280x800 화면', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  /** SVG 안 모든 글자의 화면 글자 크기(px) = font-size × (화면 폭 / viewBox 폭). */
  async function renderedFontSizes(svg: Locator) {
    return svg.evaluate((el) => {
      const s = el as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll('text')].map((t) => ({
        text: (t.textContent ?? '').trim(),
        px: parseFloat(getComputedStyle(t).fontSize) * scale,
      }));
    });
  }

  test('두 그림의 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g5-light');
    for (const name of ['눈으로 보기', '빛의 길로 보기']) {
      const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg'));
      expect(sizes.length).toBeGreaterThan(0);
      for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
    }
  });
});
