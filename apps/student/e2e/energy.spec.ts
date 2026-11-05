import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, sensor } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const beams = (page: Page) => page.getByRole('figure', { name: '빛이 닿는 모습 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const TILT = '패널 기울기';
const WEATHER = '날씨';
const SHADE = '그늘';
const FRAME = '패널 테두리 색';
const NOTICE = '⚠ 태양을 직접 보지 않아요.';
const TERMS = ['효율', '입사각', '일사량', '광전 효과', '바이패스 다이오드'];
const LIMITS_TEXT = '실제 패널은 일부만 가려져도 더 많이 줄 수 있어요. 태양 높이는 계절과 시각에 따라 달라져요.';

async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function run(page: Page, prediction: string, firstTime = false) {
  await predict(page, prediction);
  await runButton(page).click();
  if (firstTime) await confirmSafetyDialog(page);
  else await expect(page.getByRole('dialog')).toHaveCount(0);
  await finishRun(page);
}

/** 기준 시행(0°, 맑은 날, 그늘 없음, 검은색)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 만든 전기·돈 횟수: 네 조건 다음 두 칸(시행 번호는 머리 칸) */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 6);
}

test('점검표를 거쳐 기준(0°, 맑음, 없음, 검은색)을 하면 433, 104가 보이고 상시 문구와 전력계가 있다', async ({ page }) => {
  await gotoUnit(page, 'g5-energy');
  await expect(page.getByRole('heading', { level: 1, name: '자원과 에너지' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 태양광 패널이 전기를 더 많이 만들게 하려면 어떻게 해야 할까?')).toBeVisible();
  await expect(page.getByText('예측: 패널이 만든 전기의 양은?')).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
  // 실행 전에는 결과를 보여 주지 않는다
  await expect(macro(page).getByTestId('panel-note')).toHaveText('실험하면 패널이 만든 전기의 양을 볼 수 있어요.');
  await expect(macro(page).getByTestId('propeller')).toHaveAttribute('data-running', 'false');
  await expect(beams(page).getByTestId('beams')).toHaveCount(0);
  await expect(beams(page).getByTestId('beam-idle')).toHaveCount(6);
  await expect(beams(page).getByText('같은 넓이에 닿는 빛줄기가 많을수록 전기를 많이 만들어요.')).toHaveCount(0);
  for (const term of TERMS) await expect(page.getByText(term)).toHaveCount(0);
  await expect(page.getByText('가상 전력계')).toBeVisible();
  await expect(sensor(page, '전력')).toHaveText('0 mW');

  await selectIV(page, TILT);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('태양을 맨눈으로 직접 보지 않아요.')).toBeVisible();
  await expect(dialog.getByText('돌아가는 프로펠러에 손가락을 대지 않아요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await resultCells(resultRows(page).first())).toEqual(['433', '104']);
  for (const h of ['만든 전기(mW)', '1분 동안 돈 횟수(번)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByText('60.0초 · 만든 전기 433 mW · 돈 횟수 104번')).toBeVisible();
  await expect(sensor(page, '전력')).toHaveText('433 mW');
  expect(await page.locator('main').innerText()).not.toMatch(/효율|입사각|일사량|광전 효과|바이패스 다이오드/);
});

test('기울기 30°이면 500, 결과: 늘어났다와 기울기 전용 질문이 나오고, 이어서 60°이면 433, 결과: 줄어들었다', async ({ page }) => {
  await gotoUnit(page, 'g5-energy');
  await baselineRun(page, TILT);
  await expect(beams(page).getByTestId('beams')).toHaveAttribute('data-hit', '5');
  await setValue(page, TILT, '30°');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['500', '120']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('기울기만 바꾸었어요. 세 가지 각도를 모두 해 보았나요? 빛 그림에서 햇빛과 패널이 만나는 모습을 비교해 볼까요?');
  await expect(macro(page).getByTestId('panel')).toHaveAttribute('data-tilt', '30');
  await expect(beams(page).getByTestId('beams')).toHaveAttribute('data-hit', '6');
  await expect(beams(page).getByTestId('beams')).toHaveAttribute('data-spacing', '18.0');

  await setValue(page, TILT, '60°');
  await run(page, '줄어든다');
  const row3 = resultRows(page).nth(2);
  expect(await resultCells(row3)).toEqual(['433', '104']);
  await expect(row3).toContainText('결과: 줄어들었다');
  await expect(beams(page).getByTestId('beams')).toHaveAttribute('data-spacing', '20.8');
});

test('새 페이지에서 흐린 날이면 130, 그늘이면 절반으로 217', async ({ page }) => {
  await gotoUnit(page, 'g5-energy');
  await baselineRun(page, WEATHER);
  await expect(macro(page).getByTestId('clouds')).toHaveCount(0);
  await setValue(page, WEATHER, '흐린 날');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['130', '31']);
  await expect(resultRows(page).nth(1)).toContainText('결과: 줄어들었다');
  await expect(macro(page).getByTestId('clouds')).toBeVisible();

  await page.reload();
  await baselineRun(page, SHADE);
  await setValue(page, SHADE, '패널 절반을 가림');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['217', '52']);
  await expect(macro(page).getByTestId('tree')).toBeVisible();
  await expect(beams(page).getByTestId('beams')).toHaveAttribute('data-blocked', '3');
});

test('새 페이지에서 테두리만 바꾸면 결과: 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g5-energy');
  await baselineRun(page, FRAME);
  await page.getByRole('group', { name: FRAME, exact: true }).getByRole('button', { name: '은색', exact: true }).click();
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['433', '104']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('테두리 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('panel')).toHaveAttribute('data-frame', 'silver');
});

test('"모형의 한계" 글이 실행 전에도 있고 접어 두었다가 펼칠 수 있다', async ({ page }) => {
  await gotoUnit(page, 'g5-energy');
  const limits = beams(page).getByTestId('model-limits');
  await expect(limits.getByText('모형의 한계', { exact: true })).toBeVisible();
  await expect(limits.getByText(LIMITS_TEXT)).toBeHidden();
  await limits.getByText('모형의 한계', { exact: true }).click();
  await expect(limits.getByText(LIMITS_TEXT)).toBeVisible();
  await baselineRun(page, TILT);
  await expect(limits.getByText(LIMITS_TEXT)).toBeVisible();
  await expect(beams(page).getByText('같은 넓이에 닿는 빛줄기가 많을수록 전기를 많이 만들어요.')).toBeVisible();
  for (const l of ['햇빛', '패널']) await expect(beams(page).getByText(l, { exact: true })).toBeVisible();
});

test('그래프: y축 0~125(25 간격), x축 0~60초', async ({ page }) => {
  await gotoUnit(page, 'g5-energy');
  await baselineRun(page, TILT);
  await expect(graph(page).getByText('프로펠러가 돈 횟수(번)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(초)', { exact: true })).toBeVisible();
  expect(await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents()).toEqual(['0', '10', '20', '30', '40', '50', '60']);
  expect(await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents()).toEqual(['0', '25', '50', '75', '100', '125']);
  await setValue(page, TILT, '30°');
  await run(page, '늘어난다');
  expect(await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents()).toEqual(['0', '25', '50', '75', '100', '125']);
});

test('재생이 끝난 뒤 플레이헤드는 끝(60)에 있고, 처음으로 옮기면 돈 횟수 0번', async ({ page }) => {
  await gotoUnit(page, 'g5-energy');
  await baselineRun(page, TILT);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '60');
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByText('0.0초 · 만든 전기 433 mW · 돈 횟수 0번')).toBeVisible();
});

test('프로펠러는 전기를 만드는 동안만 돌고 단원을 떠나면 애니메이션 요청이 남지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    const live = new Set<number>();
    (window as unknown as { __raf: Set<number> }).__raf = live;
    const raf = window.requestAnimationFrame.bind(window);
    const caf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      const id = raf((t) => {
        live.delete(id);
        cb(t);
      });
      live.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      live.delete(id);
      caf(id);
    };
  });
  await gotoUnit(page, 'g5-energy', { playback: 4 });
  await selectIV(page, TILT);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(macro(page).getByTestId('propeller')).toHaveAttribute('data-running', 'true');
  await page.getByRole('link', { name: '← 단원 목록' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBe(0);
});

test('움직임 줄이기이면 프로펠러가 멈춰 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoUnit(page, 'g5-energy', { playback: 4 });
  await selectIV(page, TILT);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(macro(page).getByTestId('propeller')).toHaveAttribute('data-running', 'false');
  await expect(macro(page).getByTestId('propeller')).toHaveAttribute('data-angle', '0.0');
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

  test('눈으로 보기와 빛이 닿는 모습 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g5-energy');
    const check = async () => {
      for (const name of ['눈으로 보기', '빛이 닿는 모습 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, TILT);
    await check();
    await setValue(page, TILT, '30°');
    await setValue(page, WEATHER, '흐린 날');
    await setValue(page, SHADE, '패널 절반을 가림');
    await run(page, '줄어든다');
    await check();
  });
});
