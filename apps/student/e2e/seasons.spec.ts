import type { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  gotoUnit,
  setValue,
  predict,
  runButton,
  resultRows,
  confirmSafetyDialog,
  sensor,
} from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const SUN_NOTICE = '⚠ 태양을 직접 바라보면 눈을 다칠 수 있어요.';
const LENS_NOTICE = '⚠ 렌즈로 해를 직접 보면 눈을 크게 다칠 수 있어요.';
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const space = (page: Page) => page.getByRole('figure', { name: '우주에서 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });

// 이 단원의 변인 이름. 첫 이름은 ')'로 끝나지만 괄호 앞 낱말(계절)로 조사를 맞춘다.
const SEASON = '계절(공전 위치)';
const TILT = '자전축 기울기';
const STICK = '막대 길이';

/** 바꿀 조건(조작변인) 라디오를 고른다. */
async function selectIV(page: Page, label: string) {
  const name = label === SEASON ? `${label}을 바꿀 조건으로 고르기` : `${label}를 바꿀 조건으로 고르기`;
  await page.getByRole('radio', { name }).check();
}

/** 실행 버튼이 다시 '▶ 실험 실행'이 될 때까지(재생이 끝날 때까지) 기다린다. */
async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 기준 시행(봄, 23.5°, 10 cm)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);
}

test('처음 실행할 때 점검표를 거쳐 기준 시행(봄, 23.5°, 10 cm)을 하면 52.5와 7.7이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await selectIV(page, SEASON);
  await predict(page, '늘어난다');

  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('태양을 직접 보지 않아요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  const row1 = resultRows(page).first();
  await expect(row1).toContainText('52.5');
  await expect(row1).toContainText('7.7');
  await expect(row1).toContainText('12시간 0분');
  await expect(row1).toContainText('100');
  await expect(page.getByRole('columnheader', { name: '하루 동안 받은 에너지(봄 = 100)' })).toBeVisible();
  await expect(page.getByText('가상 빛 세기 센서')).toBeVisible();
  // 재생이 끝나면 밤(24시)이 아니라 정오로 돌아와 태양과 그림자가 보인다.
  await expect(page.getByText(/12시 0분 · 태양 고도 52\.5°/)).toBeVisible();
  await expect(sensor(page, '빛 세기')).toContainText('%');
});

test('계절을 여름으로 바꾸면 75.9, 2.5, 14시간 35분, 늘어났다와 계절 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await baselineRun(page, SEASON);

  await setValue(page, SEASON, '여름');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeHidden(); // 점검표는 한 번만
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('75.9');
  await expect(row2).toContainText('2.5');
  await expect(row2).toContainText('14시간 35분');
  await expect(row2).toContainText('145');
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('계절만 바꾸었어요. 우주에서 보기 화면에서 지구의 자전축과 태양 빛이 우리나라에 닿는 모습을 비교해 볼까요?');

  // 겨울은 반대쪽 끝이다.
  await setValue(page, SEASON, '겨울');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await finishRun(page);
  const row3 = resultRows(page).nth(2);
  await expect(row3).toContainText('29.1');
  await expect(row3).toContainText('18.0');
  await expect(row3).toContainText('9시간 25분');
  await expect(row3).toContainText('결과: 줄어들었다');
});

test('새 페이지에서 기울기를 0°로 바꾸면 계절을 바꿔도 52.5이고 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await setValue(page, TILT, '기울지 않음');
  await baselineRun(page, SEASON);
  const row1 = resultRows(page).first();
  await expect(row1).toContainText('52.5');

  await setValue(page, SEASON, '여름');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('52.5');
  await expect(row2).toContainText('7.7');
  await expect(row2).toContainText('12시간 0분');
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('계절만 바꾸었어요.');
});

test('기울기만 바꾸면 기울기 전용 질문이 나오고, 30°에서 여름은 82.5°다', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await setValue(page, SEASON, '여름');
  await baselineRun(page, TILT); // 여름, 23.5°
  await setValue(page, TILT, '30° (만약에)');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('82.5');
  await expect(row2).toContainText('1.3');
  await expect(row2).toContainText('15시간 31분');
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('자전축 기울기만 바꾸었어요. 이 기울기에서 계절을 바꾸면 결과가 어떻게 될지 확인해 볼까요?');
});

test('막대 길이만 바꾸면 남중 고도는 변하지 않았고 그림자는 두 배다', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await baselineRun(page, STICK);

  await setValue(page, STICK, '20 cm');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);

  const row1 = resultRows(page).first();
  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('52.5');
  await expect(row2).toContainText('결과: 변하지 않았다');
  // 7.7 cm의 두 배(15.35 → 소수 첫째 자리 15.3)
  await expect(row2).toContainText('15.3');
  await expect(row1).not.toContainText('15.3');
  await expect(row2).toContainText('12시간 0분');
  await expect(tutorBox(page)).toContainText('막대 길이만 바꾸었을 때 달라진 값과 달라지지 않은 값은 각각 무엇인가요?');
});

test('그래프에 x 라벨 "시각(시)", 눈금 0·6·12·18·24, "남중" 표식이 보이고, 눈으로 보기가 시각을 따라간다', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await baselineRun(page, SEASON);
  await expect(graph(page).getByText('시각(시)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toHaveCount(0);
  await expect(graph(page).getByText('태양 고도(°)')).toBeVisible();
  const ticks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(ticks).toEqual(['0', '6', '12', '18', '24']);
  const markers = graph(page).getByTestId('graph-marker');
  await expect(markers).toHaveCount(1);
  await expect(markers.first()).toContainText('남중');

  const s = slider(page);
  await s.focus();
  await s.press('Home');
  await expect(macro(page).getByText('0시 0분 · 태양이 지평선 아래에 있어요')).toBeVisible();
  await expect(macro(page).getByTestId('sun')).toHaveCount(0);
  for (let i = 0; i < 5; i++) await s.press('PageUp'); // 시각 12시
  await expect(macro(page).getByText('12시 0분 · 태양 고도 52.5° · 그림자 7.7 cm')).toBeVisible();
  await expect(macro(page).getByTestId('sun')).toBeVisible();
  await expect(s).toHaveAttribute('aria-valuetext', /^12시, 태양 고도 52\.\d °$/);
  await s.press('End');
  await expect(macro(page).getByText('24시 0분 · 태양이 지평선 아래에 있어요')).toBeVisible();
});

test('눈으로 보기: 막대 길이에 비례하고, 그림자가 판을 넘으면 "→ 더 길어요"', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await expect(macro(page).getByText('막대 10 cm')).toBeVisible();
  await expect(macro(page).getByText('12시 0분 · 태양 고도 52.5° · 그림자 7.7 cm')).toBeVisible();
  const stickHeight = async () =>
    macro(page).getByTestId('stick').evaluate((l) => Number(l.getAttribute('y1')) - Number(l.getAttribute('y2')));
  const h10 = await stickHeight();
  await setValue(page, STICK, '20 cm');
  await expect(macro(page).getByText('막대 20 cm')).toBeVisible();
  expect(await stickHeight()).toBe(2 * h10);

  await expect(macro(page).getByText('→ 더 길어요')).toHaveCount(0);
  await setValue(page, SEASON, '겨울');
  await setValue(page, TILT, '30° (만약에)');
  await expect(macro(page).getByText('12시 0분 · 태양 고도 22.5° · 그림자 48.3 cm')).toBeVisible();
  await expect(macro(page).getByText('→ 더 길어요')).toBeVisible();
  await expect(macro(page).getByTestId('shadow')).toHaveAttribute('data-clipped', 'true');
});

test('우주에서 보기: 네 계절의 지구와 자전축, 같은 양의 빛이 닿는 넓이', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  const view = space(page);
  await expect(view.getByText('같은 양의 빛이 닿는 넓이')).toBeVisible();
  await expect(view.getByText('좁을수록 땅이 더 따뜻해져요')).toBeVisible();
  await expect(view.getByText('넓이: 봄의 1.00배')).toBeVisible();
  await expect(view.getByTestId('earth')).toHaveCount(4);
  await expect(view.locator('[data-selected=true]')).toHaveAttribute('data-season', 'spring');
  await expect(view.getByText('자전축 기울기 23.5°')).toBeVisible();

  await setValue(page, SEASON, '여름');
  await expect(view.locator('[data-selected=true]')).toHaveAttribute('data-season', 'summer');
  await expect(view.getByText('넓이: 봄의 0.82배')).toBeVisible();
  await setValue(page, SEASON, '겨울');
  await expect(view.getByText('넓이: 봄의 1.63배')).toBeVisible();

  // 기울기 0°: 자전축이 세로로 서고 넓이는 계절과 상관없이 같다.
  await setValue(page, TILT, '기울지 않음');
  await expect(view.getByText('자전축 기울기 0°')).toBeVisible();
  const axes = await view.getByTestId('earth-axis').evaluateAll((ls) => ls.map((l) => l.getAttribute('x1') === l.getAttribute('x2')));
  expect(axes).toEqual([true, true, true, true]);
  for (const season of ['봄', '여름', '가을', '겨울']) {
    await setValue(page, SEASON, season);
    await expect(view.getByText('넓이: 봄의 1.00배')).toBeVisible();
  }
});

test('안전: 상시 문구는 이 단원에서만 이 문구이고, 빛의 성질 단원은 그대로다', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await expect(page.getByText(SUN_NOTICE)).toBeVisible();
  await expect(page.getByText(LENS_NOTICE)).toHaveCount(0);
  await gotoUnit(page, 'g5-light', { dev: true });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(LENS_NOTICE)).toBeVisible();
  await expect(page.getByText(SUN_NOTICE)).toHaveCount(0);
});

test('안전 점검표를 취소하면 실험이 시작되지 않는다', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await selectIV(page, SEASON);
  await predict(page, '늘어난다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByText('아직 실험한 결과가 없어요.')).toBeVisible();
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

  test('그림과 그래프 표식의 글자는 화면에서 13 px 이상이다 (실험 전, 여름·0°, 겨울·30°·20 cm 그림자가 긴 때, 실행 뒤)', async ({ page }) => {
    await gotoUnit(page, 'g6-seasons');
    const check = async () => {
      for (const name of ['눈으로 보기', '우주에서 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();

    await setValue(page, SEASON, '여름');
    await setValue(page, TILT, '기울지 않음');
    await check();

    await setValue(page, SEASON, '겨울');
    await setValue(page, TILT, '30° (만약에)');
    await setValue(page, STICK, '20 cm');
    await expect(macro(page).getByText('→ 더 길어요')).toBeVisible();
    await check();

    await selectIV(page, SEASON);
    await predict(page, '늘어난다');
    await runButton(page).click();
    await confirmSafetyDialog(page);
    await finishRun(page);
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
