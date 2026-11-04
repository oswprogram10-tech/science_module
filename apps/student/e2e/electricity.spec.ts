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
  sensor,
} from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const HOUSE_WARNING = '⚠ 가정용 콘센트 전기로는 절대 실험하지 않아요.';
const HOT_WARNING = '⚠ 에나멜선이 40 °C 넘게 뜨거워졌어요. 실제 실험에서는 오래 연결하지 않아요.';
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const flow = (page: Page) => page.getByRole('figure', { name: '전기가 흐르는 모습' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });

/** 실행 버튼이 다시 '▶ 실험 실행'이 될 때까지(재생이 끝날 때까지) 기다린다. */
async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 그래프 시각을 옮긴다: 처음으로 간 뒤 2초(전체의 1/10)씩 steps번. */
async function scrubTo(page: Page, steps: number) {
  const s = slider(page);
  await s.focus();
  await s.press('Home');
  for (let i = 0; i < steps; i++) await s.press('PageUp');
}

/** 기준 시행(100회, 전지 1개, 철못, 처음 방향)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);
}

test('처음 실행할 때 점검표를 거쳐 기준 시행을 하면 12개와 N극이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await selectIV(page, '전지 연결');
  await predict(page, '늘어난다');

  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('전지의 두 끝을 전선으로 바로 잇지 않아요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  const row1 = resultRows(page).first();
  await expect(row1).toContainText('12'); // 붙은 클립의 수
  await expect(row1).toContainText('N극');
  await expect(row1).toContainText('24.7'); // 에나멜선 최고 온도
  await expect(page.getByText(HOT_WARNING)).toBeHidden();
  await expect(page.getByText('가상 온도 센서: 에나멜선')).toBeVisible();
  await expect(sensor(page, '온도')).toContainText('°C');
});

test('전지 연결을 직렬로 바꾸면 25개(늘어났다)와 전지 연결 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await baselineRun(page, '전지 연결');
  await expect(resultRows(page).first()).toContainText('12');

  await setValue(page, '전지 연결', '전지 2개 직렬 연결');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeHidden(); // 점검표는 한 번만
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('25');
  await expect(row2).toContainText('38.6');
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('전지 연결만 바꾸었어요. 전기가 흐르는 모습 화면에서 점이 움직이는 빠르기는 어떻게 달랐나요?');

  // 병렬은 1개일 때와 같다.
  await setValue(page, '전지 연결', '전지 2개 병렬 연결');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await finishRun(page);
  const row3 = resultRows(page).nth(2);
  await expect(row3).toContainText('12');
  await expect(row3).toContainText('24.7');
  await expect(row3).toContainText('결과: 줄어들었다');
});

test('새 페이지에서 전지 방향만 바꾸면 12개, S극, 변하지 않았다와 방향 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await baselineRun(page, '전지 방향');
  await expect(resultRows(page).first()).toContainText('N극');

  await setValue(page, '전지 방향', '반대 방향');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('12');
  await expect(row2).toContainText('S극');
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('전지 방향만 바꾸었을 때 클립의 수와 나침반 바늘은 각각 어떻게 되었나요?');
});

test('철못 대신 빨대만 넣으면 클립이 거의 붙지 않지만 극은 생긴다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await baselineRun(page, '속에 넣은 것');
  await setValue(page, '속에 넣은 것', '빨대만 (철못 없음)');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('0');
  await expect(row2).toContainText('N극');
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('속에 넣은 것만 바꾸었을 때 클립의 수가 어떻게 달라졌나요?');
});

test('50회 직렬이면 에나멜선이 뜨거워졌다는 경고가 나오고, 뜨겁지 않은 시행이 이어지면 사라진다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await selectIV(page, '전지 연결');
  await setValue(page, '에나멜선을 감은 횟수', '50회');
  await setValue(page, '전지 연결', '전지 2개 직렬 연결');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);

  const row1 = resultRows(page).first();
  await expect(row1).toContainText('18');
  await expect(row1).toContainText('48.0');
  await expect(page.getByText(HOT_WARNING)).toBeVisible();

  // 켜져 있는 동안(12초) 거시 문구에도 뜨겁다는 말이 붙는다.
  await scrubTo(page, 6);
  await expect(macro(page).getByText('스위치 켜짐 · 클립 18개 · ⚠ 에나멜선이 뜨거워요')).toBeVisible();

  await setValue(page, '전지 연결', '전지 1개');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await finishRun(page);
  await expect(resultRows(page).nth(1)).toContainText('27.0');
  await expect(page.getByText(HOT_WARNING)).toBeHidden();
});

test('그래프 슬라이더를 처음부터 끝으로 옮기면 거시 문구가 스위치 꺼짐, 켜짐, 꺼짐으로 바뀌고 그래프에 켜짐·꺼짐 표식이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await baselineRun(page, '전지 연결');

  const note = macro(page).locator('.view-note');
  await slider(page).focus();
  await slider(page).press('Home');
  await expect(note).toHaveText('스위치 꺼짐 · 클립 0개');
  await scrubTo(page, 4); // 8초: 켜져 있다
  await expect(note).toHaveText('스위치 켜짐 · 클립 12개');
  await slider(page).press('End');
  await expect(note).toHaveText('스위치 꺼짐 · 클립 0개');

  const markers = graph(page).getByTestId('graph-marker');
  await expect(markers).toHaveCount(2);
  await expect(markers.nth(0)).toContainText('켜짐');
  await expect(markers.nth(1)).toContainText('꺼짐');
  // 꺼짐 표식(14초)이 켜짐 표식(2초)보다 오른쪽이다.
  const x = async (i: number) => Number(await markers.nth(i).locator('line').getAttribute('x1'));
  expect(await x(1)).toBeGreaterThan(await x(0));
});

test('거시 그림: 감은 횟수에 따라 코일 줄 수가 6·10·16이고, 전지 그림과 나침반 바늘이 조건을 따른다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  const coil = macro(page).getByTestId('coil');
  await expect(coil).toHaveAttribute('data-lines', '10');
  await expect(coil.locator('line')).toHaveCount(10);
  await setValue(page, '에나멜선을 감은 횟수', '50회');
  await expect(coil.locator('line')).toHaveCount(6);
  await setValue(page, '에나멜선을 감은 횟수', '200회');
  await expect(coil.locator('line')).toHaveCount(16);

  const cells = macro(page).getByTestId('cell');
  await expect(cells).toHaveCount(1);
  await setValue(page, '전지 연결', '전지 2개 직렬 연결');
  await expect(cells).toHaveCount(2);
  await setValue(page, '전지 연결', '전지 2개 병렬 연결');
  await expect(cells).toHaveCount(2);
  await expect(macro(page).getByTestId('core-nail')).toBeVisible();
  await setValue(page, '속에 넣은 것', '빨대만 (철못 없음)');
  await expect(macro(page).getByTestId('core-straw')).toBeVisible();
  await expect(macro(page).getByTestId('core-nail')).toBeHidden();
  await page.getByRole('group', { name: '속에 넣은 것', exact: true }).getByRole('button', { name: '철못', exact: true }).click();

  // 꺼져 있으면 바늘은 북쪽(위)이고 스위치는 열려 있다.
  const needle = macro(page).getByTestId('needle');
  await expect(needle).toHaveAttribute('data-angle', '0');
  await expect(macro(page).getByTestId('switch')).toHaveAttribute('data-closed', 'false');

  await selectIV(page, '전지 방향');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);
  await scrubTo(page, 4);
  await expect(macro(page).getByTestId('switch')).toHaveAttribute('data-closed', 'true');
  await expect(needle).toHaveAttribute('data-angle', '-90'); // 못 머리가 N극이면 나침반 N(빨강)은 밀려난다
  await expect(macro(page).getByTestId('clips')).toHaveAttribute('data-count', '15');
  await expect(macro(page).getByTestId('clips').locator('rect')).toHaveCount(12);
  await expect(macro(page).getByText('+3', { exact: true })).toBeVisible();

  // 방향을 바꿔 다시 실험하면 바늘이 반대쪽으로 간다.
  await setValue(page, '전지 방향', '반대 방향');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);
  await scrubTo(page, 4);
  await expect(needle).toHaveAttribute('data-angle', '90');
  await slider(page).press('End');
  await expect(needle).toHaveAttribute('data-angle', '0');
});

test('전기가 흐르는 모습: 점이 움직이다 꺼지면 멈추고, 문구와 곡선이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await expect(flow(page).getByText('점이 빠를수록 전기가 많이 흘러요.')).toBeVisible();
  await expect(flow(page).getByTestId('field-curves')).toHaveAttribute('data-count', '0');
  await expect(flow(page).locator('svg')).toHaveAttribute('data-animating', 'false');
  const dot = flow(page).getByTestId('flow-dot').first();
  const pos = async () => `${await dot.getAttribute('cx')},${await dot.getAttribute('cy')}`;

  // 실험 전에는 멈춰 있다.
  const before = await pos();
  await page.waitForTimeout(200);
  expect(await pos()).toBe(before);

  await baselineRun(page, '전지 연결');
  await scrubTo(page, 4); // 8초: 켜져 있다
  await expect(flow(page).locator('svg')).toHaveAttribute('data-animating', 'true');
  const a = await pos();
  await expect.poll(pos).not.toBe(a);
  await expect(flow(page).getByTestId('field-curves')).toHaveAttribute('data-count', '3'); // 12개 → ceil(12/5)
  await expect(flow(page).getByTestId('field-poles')).toBeVisible();

  // 꺼지면 점도 곡선도 멈추거나 사라진다.
  await slider(page).press('End');
  await expect(flow(page).locator('svg')).toHaveAttribute('data-animating', 'false');
  await expect(flow(page).getByTestId('field-curves')).toHaveAttribute('data-count', '0');
  await expect(flow(page).getByTestId('field-poles')).toBeHidden();
  const stopped = await pos();
  await page.waitForTimeout(300);
  expect(await pos()).toBe(stopped);
});

test('병렬이면 점이 지나는 갈래가 둘 있다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await setValue(page, '전지 연결', '전지 2개 병렬 연결');
  await expect(flow(page).getByTestId('circuit').locator('path')).toHaveCount(3);
  await setValue(page, '전지 연결', '전지 1개');
  await expect(flow(page).getByTestId('circuit').locator('path')).toHaveCount(1);
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });

  test('점은 멈춰 있고 화살표가 보인다', async ({ page }) => {
    await gotoUnit(page, 'g6-electricity');
    await baselineRun(page, '전지 연결');
    await scrubTo(page, 4);
    const svg = flow(page).locator('svg');
    await expect(svg).toHaveAttribute('data-animating', 'false');
    await expect(flow(page).getByTestId('flow-arrows').locator('polygon').first()).toBeVisible();
    const dot = flow(page).getByTestId('flow-dot').first();
    const pos = async () => `${await dot.getAttribute('cx')},${await dot.getAttribute('cy')}`;
    const a = await pos();
    await page.waitForTimeout(300);
    expect(await pos()).toBe(a);
    await slider(page).press('End');
    await expect(flow(page).getByTestId('flow-arrows')).toBeHidden();
  });
});

test('실행 버튼 아래에 가정용 콘센트 전기 경고가 항상 보인다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await expect(page.getByText(HOUSE_WARNING)).toBeVisible();
  await baselineRun(page, '전지 연결');
  await expect(page.getByText(HOUSE_WARNING)).toBeVisible();
});

test('이 단원의 보안경 경고 문구가 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity', { dev: true });
  await selectIV(page, '전지 연결');
  await predict(page, '늘어난다');
  await page.getByRole('button', { name: /NO_GOGGLES/ }).click();
  await expect(page.getByRole('alert')).toContainText('실험을 계속하기 전에 보안경을 먼저 착용해 주세요!');
  await expect(runButton(page)).toBeDisabled();
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

  test('그림과 그래프 표식의 글자는 화면에서 13 px 이상이다 (실험 전, 켜진 상태, 클립이 12개를 넘는 상태)', async ({ page }) => {
    await gotoUnit(page, 'g6-electricity');
    const check = async () => {
      for (const name of ['눈으로 보기', '전기가 흐르는 모습']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg'));
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();

    // 200회 직렬: 클립 30개 → "+18"과 곡선 6개, 병렬 전지 그림도 확인한다.
    await selectIV(page, '전지 연결');
    await setValue(page, '에나멜선을 감은 횟수', '200회');
    await setValue(page, '전지 연결', '전지 2개 직렬 연결');
    await predict(page, '늘어난다');
    await runButton(page).click();
    await confirmSafetyDialog(page);
    await finishRun(page);
    await scrubTo(page, 4);
    await expect(macro(page).getByText('+18', { exact: true })).toBeVisible();
    await check();
    const markers = await renderedFontSizes(graph(page).locator('svg'), '[data-testid=graph-marker] text');
    expect(markers).toHaveLength(2);
    for (const { text, px } of markers) expect(px, `그래프 표식: "${text}"`).toBeGreaterThanOrEqual(13);

    await setValue(page, '전지 연결', '전지 2개 병렬 연결');
    await setValue(page, '전지 방향', '반대 방향');
    await check();
  });
});
