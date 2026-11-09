import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const micro = (page: Page) => page.getByRole('figure', { name: '가상 현미경으로 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });

const MOISTURE = '빵의 물기';
const TEMP = '온도';
const LIGHT = '빛';
const NOTICE = '⚠ 곰팡이가 핀 음식은 먹거나 냄새를 맡지 않아요.';

/** 실행 버튼이 다시 '▶ 실험 실행'이 될 때까지(재생이 끝날 때까지) 기다린다. */
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

/** 기준 시행(물을 뿌린 빵, 20 °C, 밝은 곳)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '늘어난다', true);
}

/** 결과표 한 줄의 값: 물기, 온도, 빛 다음의 7일째 넓이, 10일째 넓이, 처음 보인 날 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 6);
}

test('처음 실행할 때 점검표를 거쳐 기준 시행(물을 뿌린 빵, 20 °C, 밝은 곳)을 하면 48, 93, 2.0이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await expect(page.getByRole('heading', { level: 1, name: '다양한 생물과 우리 생활' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 곰팡이는 어떤 조건에서 잘 자랄까?')).toBeVisible();
  for (const term of ['효소', '학명', '페니실리움', '아스페르길루스', '미생물학']) await expect(page.getByText(term)).toHaveCount(0);
  await selectIV(page, TEMP);
  await predict(page, '늘어난다');

  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('곰팡이가 핀 봉지는 열지 않고 밖에서만 관찰해요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await resultCells(resultRows(page).first())).toEqual(['48', '93', '2.0']);
  for (const name of ['7일째 곰팡이 넓이(%)', '10일째 넓이(%)', '처음 보인 날(일)']) {
    await expect(page.getByRole('columnheader', { name })).toBeVisible();
  }
  // 재생이 끝나면 10일째가 아니라 7일째에 멈춘다.
  await expect(macro(page).getByText('7일째 · 곰팡이가 덮은 넓이 48%')).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
  await expect(page.getByText('가상 온도계')).toBeVisible();
  await expect(page.getByText('가상 습도 센서: 봉지 안')).toBeVisible();
  await expect(sensor(page, '온도')).toContainText('°C');
  await expect(sensor(page, '습도')).toContainText('%');
});

test('냉장고 5 °C로 바꾸면 0, 2, 8.0, 줄어들었다이고 온도 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await baselineRun(page, TEMP);

  await setValue(page, TEMP, '냉장고');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['0', '2', '8.0']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('온도만 바꾸었어요. 7일째와 10일째 그래프를 함께 보면 냉장고 속 빵에서는 무슨 일이 일어났나요?');
  await expect(macro(page).getByText('7일째 · 곰팡이가 덮은 넓이 0%')).toBeVisible();
  await expect(macro(page).getByText('냉장고 5 °C')).toBeVisible();
  await expect(macro(page).getByTestId('mold-spot')).toHaveCount(0);
  await expect(micro(page).getByText('아직 곰팡이가 보이지 않아요')).toBeVisible();
});

test('새 페이지에서 빛만 어둡게 바꾸면 48, 93, 2.0 그대로이고 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await baselineRun(page, LIGHT);

  await setValue(page, LIGHT, '어두운 곳');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['48', '93', '2.0']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('빛만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('dark-overlay')).toBeVisible();
});

test('마른 빵 20 °C는 1, 2, 6.7이고 곰팡이가 조금만 보인다', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await baselineRun(page, MOISTURE);
  await setValue(page, MOISTURE, '마른 빵');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['1', '2', '6.7']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(macro(page).getByText('7일째 · 곰팡이가 덮은 넓이 1%')).toBeVisible();
  await expect(macro(page).getByTestId('mold-spot')).toHaveCount(1);
  await expect(macro(page).getByTestId('drop')).toHaveCount(0);
});

test('가상 현미경: 배율 버튼으로 배율 글자와 축척이 바뀌고, 균사·포자 라벨이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await baselineRun(page, TEMP);
  const m = micro(page);
  const btn = (name: string) => m.getByRole('button', { name, exact: true });
  await expect(m.getByText('균사', { exact: true })).toBeVisible();
  await expect(m.getByText('포자', { exact: true })).toBeVisible();
  await expect(m.getByText('곰팡이는 가는 실 같은 균사로 퍼지고, 포자로 퍼져 나가요.')).toBeVisible();
  await expect(m.getByTestId('hypha').first()).toBeVisible();
  await expect(m.getByTestId('spore').first()).toBeVisible();

  await expect(m.getByTestId('scope-mag')).toHaveText('×100');
  await expect(m.getByTestId('scope-scale')).toHaveText('0.2 mm');
  await expect(btn('×100')).toHaveAttribute('aria-pressed', 'true');
  await expect(btn('×40')).toHaveAttribute('aria-pressed', 'false');

  const line = m.getByTestId('hypha').first();
  const len = async () => line.evaluate((el) => Math.hypot(Number(el.getAttribute('x2')) - Number(el.getAttribute('x1')), Number(el.getAttribute('y2')) - Number(el.getAttribute('y1'))));
  const l100 = await len();

  await btn('×400').click();
  await expect(m.getByTestId('scope-mag')).toHaveText('×400');
  await expect(m.getByTestId('scope-scale')).toHaveText('0.05 mm');
  await expect(btn('×400')).toHaveAttribute('aria-pressed', 'true');
  await expect(btn('×100')).toHaveAttribute('aria-pressed', 'false');
  expect(await len()).toBeGreaterThan(l100);

  // 키보드로도 조작할 수 있다.
  await btn('×40').focus();
  await page.keyboard.press('Enter');
  await expect(m.getByTestId('scope-mag')).toHaveText('×40');
  await expect(m.getByTestId('scope-scale')).toHaveText('0.5 mm');
  await expect(btn('×40')).toHaveAttribute('aria-pressed', 'true');
  expect(await len()).toBeLessThan(l100);
  await expect(m.getByText('균사', { exact: true })).toBeVisible();
  await expect(m.getByText('포자', { exact: true })).toBeVisible();
});

test('그래프: x 라벨 "날짜(일)", 눈금 0·2·…·10, "7일째" 표식, 슬라이더를 따라 눈으로 보기와 현미경이 바뀐다', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await baselineRun(page, TEMP);
  await expect(graph(page).getByText('날짜(일)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('곰팡이가 덮은 넓이(%)')).toBeVisible();
  const ticks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(ticks).toEqual(['0', '2', '4', '6', '8', '10']);
  const markers = graph(page).getByTestId('graph-marker');
  await expect(markers).toHaveCount(1);
  await expect(markers.first()).toContainText('7일째');

  const s = slider(page);
  await s.focus();
  await s.press('Home');
  await expect(macro(page).getByText('0일째 · 곰팡이가 덮은 넓이 0%')).toBeVisible();
  await expect(micro(page).getByText('아직 곰팡이가 보이지 않아요')).toBeVisible();
  await s.press('End');
  await expect(macro(page).getByText('10일째 · 곰팡이가 덮은 넓이 93%')).toBeVisible();
  await expect(micro(page).getByTestId('hypha').first()).toBeVisible();
  await expect(s).toHaveAttribute('aria-valuetext', /^10일, 곰팡이가 덮은 넓이 /);
});

test('눈으로 보기: 조건을 바꾸면 봉지 그림이 바뀐다', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await expect(macro(page).getByText('물을 뿌린 빵 · 물방울')).toBeVisible();
  await expect(macro(page).getByText('실온 20 °C')).toBeVisible();
  await expect(macro(page).getByText('지퍼 봉지 · 밝은 곳')).toBeVisible();
  await expect(macro(page).getByTestId('drop').first()).toBeVisible();
  await expect(macro(page).getByTestId('dark-overlay')).toHaveCount(0);

  await setValue(page, MOISTURE, '마른 빵');
  await expect(macro(page).getByText('마른 빵', { exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('drop')).toHaveCount(0);
  await setValue(page, TEMP, '냉장고');
  await expect(macro(page).getByTestId('env-frame')).toHaveAttribute('data-place', 'cold');
  await setValue(page, TEMP, '따뜻한 곳');
  await expect(macro(page).getByTestId('env-frame')).toHaveAttribute('data-place', 'warm');
  await setValue(page, LIGHT, '어두운 곳');
  await expect(macro(page).getByText('지퍼 봉지 · 어두운 곳')).toBeVisible();
  await expect(macro(page).getByTestId('dark-overlay')).toBeVisible();
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

  test('그림과 그래프 표식의 글자는 화면에서 13 px 이상이다 (실험 전, 냉장고·어두운 곳, 실행 뒤, 확대)', async ({ page }) => {
    await gotoUnit(page, 'g4-microbe');
    const check = async () => {
      for (const name of ['눈으로 보기', '가상 현미경으로 보기']) {
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

    await selectIV(page, TEMP);
    await run(page, '늘어난다', true);
    await check();
    for (const mag of ['×400', '×40']) {
      await micro(page).getByRole('button', { name: mag, exact: true }).click();
      await check();
    }
    const s = slider(page);
    await s.focus();
    await s.press('Home');
    await check();
    const markers = await renderedFontSizes(graph(page).locator('svg'), '[data-testid=graph-marker] text');
    expect(markers).toHaveLength(1);
    for (const { text, px } of markers) expect(px, `그래프 표식: "${text}"`).toBeGreaterThanOrEqual(13);
  });
});
