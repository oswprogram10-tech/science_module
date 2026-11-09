import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const particles = (page: Page) => page.getByRole('figure', { name: '알갱이 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const PROCESS = '과정';
const AMOUNT = '처음 물의 양';
const TUBE = '시험관 종류';
const NOTICE = '⚠ 소금 얼음물은 아주 차가워요. 맨손으로 오래 만지지 않아요.';

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

/** 기준 시행(얼리기, 10 mL, 유리)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 부피 변화·나중 부피·무게: 세 조건 다음 세 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 6);
}

const particleCount = async (page: Page) => Number(await particles(page).getByTestId('particles').getAttribute('data-count'));
const iceCount = async (page: Page) => Number(await particles(page).getByTestId('particles').getAttribute('data-ice'));

test('점검표를 거쳐 기준(얼리기, 10 mL, 유리)을 하면 +0.9, 10.9, 10.0 g → 10.0 g이 보이고 상시 문구와 두 센서가 있다', async ({ page }) => {
  await gotoUnit(page, 'g4-water-state');
  await expect(page.getByRole('heading', { level: 1, name: '물의 상태 변화' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 물이 얼거나 얼음이 녹을 때 부피와 무게는 어떻게 달라질까?')).toBeVisible();
  await expect(page.getByText('예측: 부피 변화는?')).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
  // 실행 전에는 결과(시간에 따라 변한 부피)를 보여 주지 않는다
  await expect(macro(page).getByTestId('freeze-note')).not.toContainText('분 · 부피');
  await expect(particles(page).getByTestId('particle-note')).not.toContainText('알갱이 수는 같고');
  for (const term of ['밀도', '분자', '수소 결합', '잠열', '응고점', '녹는점']) await expect(page.getByText(term)).toHaveCount(0);

  await selectIV(page, PROCESS);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('소금 얼음물은 맨손으로 오래 만지지 않아요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await resultCells(resultRows(page).first())).toEqual(['+0.9', '10.9', '10.0 g → 10.0 g']);
  await expect(page.getByRole('columnheader', { name: '부피 변화(mL)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '무게(처음 → 나중)' })).toBeVisible();
  await expect(macro(page).getByText('30.0분 · 부피 10.9 mL · 무게 10.0 g')).toBeVisible();
  await expect(page.getByText('가상 온도계')).toBeVisible();
  await expect(page.getByText('가상 전자저울')).toBeVisible();
  await expect(sensor(page, '온도')).toContainText('°C');
  await expect(sensor(page, '무게')).toContainText('g');
  await expect(particles(page).getByText('얼음이 될 때 알갱이 수는 같고, 알갱이 사이가 조금 넓어져요.')).toBeVisible();
  // 안전 경고 문구는 산·염기 전용이 아니다
  expect(await page.locator('main').innerText()).not.toMatch(/산성|용액|밀도|분자/);
});

test('과정을 얼음 녹이기로 바꾸면 −0.9, 결과: 줄어들었다, 과정 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-water-state');
  await baselineRun(page, PROCESS);

  await setValue(page, PROCESS, '얼음 녹이기');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['−0.9', '10.0', '10.0 g → 10.0 g']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('과정만 바꾸었어요. 얼리기와 녹이기에서 시험관 속 높이 표시는 어떻게 달랐나요? 알갱이 사이의 간격은 어땠나요?');
  await expect(macro(page).getByTestId('bath')).toHaveAttribute('data-kind', 'warm');
  await expect(macro(page).getByText('따뜻한 물', { exact: true })).toBeVisible();
  await expect(macro(page).getByText('30.0분 · 부피 10.0 mL · 무게 10.0 g')).toBeVisible();
});

test('새 페이지에서 처음 물의 양을 20 mL로 바꾸면 +1.8, 20.0 g → 20.0 g, 결과: 늘어났다', async ({ page }) => {
  await gotoUnit(page, 'g4-water-state');
  await baselineRun(page, AMOUNT);

  await setValue(page, AMOUNT, '20 mL');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['+1.8', '21.8', '20.0 g → 20.0 g']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(macro(page).getByText('30.0분 · 부피 21.8 mL · 무게 20.0 g')).toBeVisible();
  await expect(macro(page).getByTestId('scale-value')).toHaveText('20.0 g');
});

test('새 페이지에서 시험관만 플라스틱으로 바꾸면 결과: 변하지 않았다, 시험관 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g4-water-state');
  await baselineRun(page, TUBE);

  await setValue(page, TUBE, '플라스틱 시험관');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['+0.9', '10.9', '10.0 g → 10.0 g']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('시험관 종류만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByText('플라스틱 시험관', { exact: true }).first()).toBeVisible();
});

test('얼음 녹이기 20 mL는 −1.8, 20.0 g → 20.0 g이다', async ({ page }) => {
  await gotoUnit(page, 'g4-water-state');
  await selectIV(page, PROCESS);
  await setValue(page, PROCESS, '얼음 녹이기');
  await setValue(page, AMOUNT, '20 mL');
  await run(page, '줄어든다', true);
  expect(await resultCells(resultRows(page).first())).toEqual(['−1.8', '20.0', '20.0 g → 20.0 g']);
});

test('알갱이 그림에 알갱이 수가 보이고 재생 전후 같다. 얼음 배치 개수는 변한다', async ({ page }) => {
  await gotoUnit(page, 'g4-water-state');
  await expect(particles(page).getByTestId('particle-count')).toHaveText('알갱이 수 18개');
  expect(await particleCount(page)).toBe(18);
  expect(await iceCount(page)).toBe(0);
  await baselineRun(page, PROCESS);
  await expect(particles(page).getByTestId('particle-count')).toHaveText('알갱이 수 18개');
  expect(await particleCount(page)).toBe(18);
  await expect(particles(page).getByTestId('particle')).toHaveCount(18);
  expect(await iceCount(page)).toBe(18);
  // 녹이기: 처음에는 모두 얼음 배치이고 끝에는 모두 액체 배치
  await setValue(page, PROCESS, '얼음 녹이기');
  await expect(particles(page).getByTestId('particle-count')).toHaveText('알갱이 수 18개');
  await run(page, '줄어든다');
  expect(await iceCount(page)).toBe(0);
  expect(await particleCount(page)).toBe(18);
  // 그래프를 처음으로 옮기면 얼음 배치로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  expect(await iceCount(page)).toBe(18);
  expect(await particleCount(page)).toBe(18);
  // 처음 양 20 mL면 24개
  await selectIV(page, AMOUNT);
  await setValue(page, AMOUNT, '20 mL');
  await run(page, '늘어난다');
  await expect(particles(page).getByTestId('particle-count')).toHaveText('알갱이 수 24개');
  expect(await particleCount(page)).toBe(24);
});

test('그래프: y축 −2~2(음수 눈금과 0선), x축 0~30분, 표식 두 개(과정과 처음 양에 따라 달라진다)', async ({ page }) => {
  await gotoUnit(page, 'g4-water-state');
  await baselineRun(page, PROCESS);
  await expect(graph(page).getByText('부피 변화(mL)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(분)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('얼기 시작')).toBeVisible();
  await expect(graph(page).getByText('다 얼었어요')).toBeVisible();
  await expect(graph(page).getByTestId('zero-line')).toHaveCount(1);
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '5', '10', '15', '20', '25', '30']);
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['−2', '−1', '0', '1', '2']);

  await setValue(page, PROCESS, '얼음 녹이기');
  await run(page, '줄어든다');
  await expect(graph(page).getByText('녹기 시작')).toBeVisible();
  await expect(graph(page).getByText('다 녹았어요')).toBeVisible();
  await expect(graph(page).getByText('얼기 시작')).toHaveCount(0);
});

test('재생이 끝난 뒤 플레이헤드는 끝(30)에 있다', async ({ page }) => {
  await gotoUnit(page, 'g4-water-state');
  await baselineRun(page, PROCESS);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '30');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(macro(page).getByText('0.0분 · 부피 10.0 mL · 무게 10.0 g · 20.0 °C')).toBeVisible();
});

test('액체 알갱이는 실험 중에만 움직이고, 단원을 떠나면 애니메이션 요청이 남지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: Set<number> };
    w.__raf = new Set();
    const raf = window.requestAnimationFrame.bind(window);
    const caf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      const id = raf((t) => {
        w.__raf.delete(id);
        cb(t);
      });
      w.__raf.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      w.__raf.delete(id);
      caf(id);
    };
  });
  await gotoUnit(page, 'g4-water-state', { playback: 5 });
  await selectIV(page, PROCESS);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(particles(page).getByTestId('particles')).toHaveAttribute('data-running', 'true');
  const xs = () => particles(page).locator('circle[data-state=liquid]').first().getAttribute('cx');
  const a = await xs();
  await expect.poll(xs).not.toBe(a);
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 15_000 });
  await expect(particles(page).getByTestId('particles')).toHaveAttribute('data-running', 'false');
  // 멈춘 뒤에는 알갱이가 움직이지 않는다
  const b = await particles(page).locator('circle').first().getAttribute('cx');
  await page.waitForTimeout(300);
  expect(await particles(page).locator('circle').first().getAttribute('cx')).toBe(b);

  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(particles(page).getByTestId('particles')).toHaveAttribute('data-running', 'true');
  expect(await page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBeGreaterThan(0);
  await page.getByRole('link', { name: '← 단원 목록' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBe(0);
});

test('움직임 줄이기이면 알갱이가 가만히 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoUnit(page, 'g4-water-state', { playback: 5 });
  await selectIV(page, PROCESS);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(particles(page).getByTestId('particles')).toHaveAttribute('data-running', 'false');
  const first = () => particles(page).locator('circle[data-state=liquid]').first().getAttribute('cx');
  const a = await first();
  await page.waitForTimeout(400);
  expect(await first()).toBe(a);
  expect(await particleCount(page)).toBe(18);
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 15_000 });
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

  test('눈으로 보기와 알갱이 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g4-water-state');
    const check = async () => {
      for (const name of ['눈으로 보기', '알갱이 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, PROCESS);
    await check();
    await setValue(page, PROCESS, '얼음 녹이기');
    await setValue(page, AMOUNT, '20 mL');
    await run(page, '줄어든다');
    await check();
  });
});
