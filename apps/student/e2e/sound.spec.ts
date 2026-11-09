import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, sensor, expectSensorNear } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const airView = (page: Page) => page.getByRole('figure', { name: '공기 알갱이 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const STRENGTH = '튕기는 세기';
const LENGTH = '떨리는 줄의 길이';
const COLOR = '고무줄 색';

async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 기준 시행(약하게, 20 cm, 빨간색)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 값: 세기, 길이, 색 다음의 떨린 횟수, 소리의 크기 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

/** 그래프 선의 위로 지나가는 횟수(0 가로선을 아래에서 위로 넘는 곳) */
async function waveCount(svgLines: Locator) {
  return svgLines.evaluate((el) => {
    const ys = (el.getAttribute('points') ?? '').split(' ').map((p) => Number(p.split(',')[1]));
    const zero = (14 + 202) / 2;
    return ys.slice(1).filter((y, i) => ys[i]! > zero + 1e-6 && y <= zero + 1e-6).length;
  });
}

test('기준(약하게, 20 cm, 빨간색)이면 330, 62.0이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g3-sound');
  await expect(page.getByRole('heading', { level: 1, name: '소리의 성질' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 줄을 튕기는 세기와 줄의 길이를 바꾸면 소리는 어떻게 달라질까?')).toBeVisible();
  await expect(page.getByText('예측: 1초 동안 줄이 떨린 횟수는?')).toBeVisible();
  // 실행 전에는 답을 보여 주지 않는다
  await expect(macro(page).getByTestId('sound-note')).not.toContainText('330');
  await baselineRun(page, LENGTH);

  expect(await resultCells(resultRows(page).first())).toEqual(['330', '62.0']);
  for (const name of ['1초 동안 떨린 횟수(번)', '소리의 크기(눈금)']) await expect(page.getByRole('columnheader', { name })).toBeVisible();
  await expect(macro(page).getByText('1초 동안 330번 떨려요 · 소리의 크기 62.0')).toBeVisible();
  await expect(macro(page).getByText('떨리는 길이 20 cm')).toBeVisible();
  await expect(macro(page).getByText('느린 화면', { exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('vibe-band')).toBeVisible();
  await expect(page.getByText('가상 소리 센서')).toBeVisible();
  await expect(sensor(page, '소리')).toContainText('눈금');
  // 쓰지 않는 말
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/진동수|진폭|Hz|dB|헤르츠|데시벨|파장|음파/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('길이를 15 cm로 바꾸면 440, 결과: 늘어났다, 길이 전용 질문이 나오고 앞 시행 흐린 선과 물결 개수가 다르다', async ({ page }) => {
  await gotoUnit(page, 'g3-sound');
  await baselineRun(page, LENGTH);

  await setValue(page, LENGTH, '15 cm');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['440', '62.0']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('줄의 길이만 바꾸었어요. 같은 시간 동안 물결이 몇 개 있었나요? 소리는 어떻게 들렸을까요?');
  await expect(macro(page).getByText('1초 동안 440번 떨려요 · 소리의 크기 62.0')).toBeVisible();
  await expect(macro(page).getByText('떨리는 길이 15 cm')).toBeVisible();

  // 그래프: 이번 시행(15 cm, 물결 8개)과 흐린 앞 시행(20 cm, 물결 6개)
  const svg = graph(page).locator('svg').first();
  expect(await waveCount(svg.locator('polyline[stroke="#1f6fb5"]'))).toBe(8);
  expect(await waveCount(svg.locator('polyline[stroke="#7a8794"]'))).toBe(6);
});

test('새 페이지에서 세기만 세게로 바꾸면 330, 70.0, 결과: 변하지 않았다, 세기 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-sound');
  await baselineRun(page, STRENGTH);

  await setValue(page, STRENGTH, '세게');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['330', '70.0']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('튕기는 세기만 바꾸었어요. 물결의 높이와 물결의 개수 가운데 무엇이 달라졌나요? 소리의 크기 눈금도 함께 볼까요?');
  await expect(macro(page).getByText('1초 동안 330번 떨려요 · 소리의 크기 70.0')).toBeVisible();
  await expectSensorNear(page, '소리', 70.0, 0.25); // 잡음 ±0.2

  // 그래프: 물결 개수는 같고 높이만 2.5배
  const svg = graph(page).locator('svg').first();
  const now = svg.locator('polyline[stroke="#1f6fb5"]');
  const prev = svg.locator('polyline[stroke="#7a8794"]');
  expect(await waveCount(now)).toBe(await waveCount(prev));
  const half = (l: Locator) =>
    l.evaluate((el) => {
      const ys = (el.getAttribute('points') ?? '').split(' ').map((p) => Number(p.split(',')[1]));
      return (Math.max(...ys) - Math.min(...ys)) / 2;
    });
  expect((await half(now)) / (await half(prev))).toBeGreaterThan(2.3);
  expect((await half(now)) / (await half(prev))).toBeLessThan(2.7);
});

test('새 페이지에서 색만 바꾸면 결과: 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g3-sound');
  await baselineRun(page, COLOR);

  await setValue(page, COLOR, '노란색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['330', '62.0']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(macro(page).getByTestId('string').first()).toBeVisible();
});

test('그래프 y축 눈금에 −1과 1이 있고 x축은 1000분의 1초 0~20이다', async ({ page }) => {
  await gotoUnit(page, 'g3-sound');
  await baselineRun(page, LENGTH);

  await expect(graph(page).getByText('줄의 떨림', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(1000분의 1초)', { exact: true })).toBeVisible();
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['−1', '−0.5', '0', '0.5', '1']);
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '5', '10', '15', '20']);
  await expect(graph(page).getByTestId('zero-line')).toHaveCount(1);
});

test('공기와 귀 라벨이 보이고 설명 문구가 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-sound');
  await expect(airView(page).getByText('공기', { exact: true })).toBeVisible();
  await expect(airView(page).getByText('귀', { exact: true })).toBeVisible();
  await expect(airView(page).getByText('줄의 떨림이 공기를 떨리게 하고, 그 떨림이 귀에 전해져 소리가 들려요.')).toBeVisible();
});

test('재생이 끝난 뒤 플레이헤드는 끝(20)에 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-sound');
  await baselineRun(page, LENGTH);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '20');
  await expect(slider).toHaveAttribute('aria-valuetext', /^20 1000분의 1초, 줄의 떨림 -0\.2$/);
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
});

test('공기 알갱이는 실험 중에만 움직이고, 단원을 떠나면 애니메이션 요청이 남지 않는다', async ({ page }) => {
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
  await gotoUnit(page, 'g3-sound', { playback: 5 });
  await selectIV(page, LENGTH);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(airView(page).getByTestId('air')).toHaveAttribute('data-running', 'true');
  // 공기 알갱이의 x가 시간에 따라 달라진다
  const xs = () => airView(page).locator('circle').first().getAttribute('cx');
  const a = await xs();
  await expect.poll(xs).not.toBe(a);
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 15_000 });
  await expect(airView(page).getByTestId('air')).toHaveAttribute('data-running', 'false');
  // 멈춘 뒤에는 알갱이가 움직이지 않는다
  const b = await xs();
  await page.waitForTimeout(300);
  expect(await xs()).toBe(b);

  // 다시 실행하고 한창일 때 단원 목록으로 나간다
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(airView(page).getByTestId('air')).toHaveAttribute('data-running', 'true');
  expect(await page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBeGreaterThan(0);
  await page.getByRole('link', { name: '← 단원 목록' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBe(0);
});

test('움직임 줄이기이면 공기 알갱이와 줄이 가만히 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoUnit(page, 'g3-sound', { playback: 5 });
  await selectIV(page, LENGTH);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(airView(page).getByTestId('air')).toHaveAttribute('data-running', 'false');
  await expect(macro(page).getByTestId('string')).toHaveAttribute('data-bow', '0.00');
  // 멈춘 화면에도 촘촘한 곳 띠가 있다(330번: 4~5개)
  expect(await airView(page).getByTestId('dense-band').count()).toBeGreaterThanOrEqual(4);
  // 정지한 띠는 그려진다
  await expect(macro(page).getByTestId('vibe-band')).toBeVisible();
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

  test('눈으로 보기와 공기 알갱이 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g3-sound');
    const check = async () => {
      for (const name of ['눈으로 보기', '공기 알갱이 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, LENGTH);
    await check();
    await setValue(page, LENGTH, '30 cm');
    await setValue(page, STRENGTH, '세게');
    await run(page, '줄어든다');
    await check();
  });
});
