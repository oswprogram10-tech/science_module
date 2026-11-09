import type { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  gotoUnit,
  setValue,
  selectIV,
  predict,
  runButton,
  resultRows,
  confirmSafetyDialog,
  sensor,
  scrollWidth,
  activityTab,
  activityTabs,
  gotoMixtureSort,
  mixtureCard,
  mixtureFinishCriterion,
  mixtureObserveButton,
  mixtureSortAll,
  MIXTURE_CARDS,
  MIXTURE_SORT_TITLE,
  sortCheckButton,
  sortChoose,
  sortFeedback,
  sortPutButton,
  sortTutor,
} from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const particles = (page: Page) => page.getByRole('figure', { name: '알갱이 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const WATER = '넣는 물의 양';
const FILTER = '거르는 방법';
const STIRRER = '젓는 도구';
const NOTICE = '⚠ 증발 접시와 알코올램프는 아주 뜨거워요. 선생님과 함께 다뤄요.';

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

/** 기준 시행(50 mL, 거름종이, 유리 막대)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 얻은 소금·섞인 모래: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

const count = (page: Page, fig: 'macro' | 'particles', id: string) => (fig === 'macro' ? macro(page) : particles(page)).getByTestId(id).count();

test('점검표를 거쳐 기준(50 mL, 거름종이, 유리 막대)을 하면 9.0, 0.0이 보이고 상시 문구와 가상 전자저울이 있다', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  await expect(page.getByRole('heading', { level: 1, name: '혼합물의 분리' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 소금과 모래가 섞인 혼합물에서 소금을 어떻게 분리할 수 있을까?')).toBeVisible();
  await expect(page.getByText('예측: 얻은 소금의 양은?')).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
  // 실행 전에는 결과(접시 위 가루)를 보여 주지 않고, 거름종이 구멍 그림에도 알갱이가 없다
  await expect(macro(page).getByTestId('salt-sand-note')).not.toContainText('접시 위 가루');
  await expect(particles(page).getByTestId('salt-sand-particle-note')).not.toContainText('거름종이 구멍을 지나가요');
  expect(await count(page, 'particles', 'paper-particles')).toBe(0);
  for (const term of ['순도', '포화', '재결정', '용해도 곡선', '여과액']) await expect(page.getByText(term)).toHaveCount(0);

  await selectIV(page, WATER);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('가열하는 증발 접시는 맨손으로 만지지 않아요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await resultCells(resultRows(page).first())).toEqual(['9.0', '0.0']);
  await expect(page.getByRole('columnheader', { name: '얻은 소금(g)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '섞인 모래(g)' })).toBeVisible();
  await expect(macro(page).getByText('20.0분 · 증발시키기 · 접시 위 가루 9.0 g')).toBeVisible();
  await expect(page.getByText('가상 전자저울: 증발 접시')).toBeVisible();
  await expect(sensor(page, '무게')).toContainText('g');
  await expect(particles(page).getByText('녹은 소금 알갱이는 아주 작아서 거름종이 구멍을 지나가요.')).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/산성|밀도|분자/);
});

test('물을 20 mL로 바꾸면 6.5, 결과: 줄어들었다, 물 전용 질문이 나오고 녹지 않은 소금이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  await baselineRun(page, WATER);
  expect(await count(page, 'macro', 'salt-undissolved-1')).toBe(0);
  expect(await count(page, 'particles', 'lump')).toBe(0);

  await setValue(page, WATER, '20 mL');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['6.5', '0.0']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('물의 양만 바꾸었어요. 녹이는 동안 비커 바닥에 남은 것은 무엇이었나요? 알갱이 그림에서 녹지 않고 남은 소금이 보이나요?');
  await expect(macro(page).getByText('20.0분 · 증발시키기 · 접시 위 가루 6.5 g')).toBeVisible();
  // 20 mL에서는 녹지 않고 남은 소금이 3개, 알갱이 그림에는 덩어리 2개
  await expect(macro(page).getByTestId('salt-undissolved-1')).toHaveCount(3);
  await expect(particles(page).getByTestId('lump')).toHaveCount(2);
  await expect(particles(page).getByTestId('dissolved-dot')).toHaveCount(14);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('salt-undissolved-1')).toHaveCount(10);
  await expect(particles(page).getByTestId('dissolved-dot')).toHaveCount(0);
});

test('새 페이지에서 따르기로 바꾸면 9.0, 1.5, 결과: 변하지 않았다, 거르기 전용 질문이 나오고 모래가 넘어온다', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  await baselineRun(page, FILTER);

  await setValue(page, FILTER, '거름종이 없이 윗물만 따르기');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['9.0', '1.5']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('거르는 방법만 바꾸었어요. 얻은 소금의 양은 같았는데, 증발 접시 위 가루는 어떻게 달랐나요?');
  await expect(macro(page).getByText('20.0분 · 증발시키기 · 접시 위 가루 10.5 g')).toBeVisible();
  await expect(macro(page).getByTestId('dish-sand')).toHaveCount(3);
  await expect(macro(page).getByText('2 따르기 (3~8분)')).toBeVisible();
  // 따르면 모래가 받는 비커로 넘어오고, 거름종이 깔때기는 없다
  await expect(macro(page).getByTestId('sand-crossed')).toHaveCount(2);
  await expect(macro(page).getByTestId('funnel')).toHaveCount(0);
});

test('새 페이지에서 젓는 도구만 바꾸면 결과: 변하지 않았다', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  await baselineRun(page, STIRRER);

  await setValue(page, STIRRER, '나무 젓가락');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['9.0', '0.0']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(macro(page).getByTestId('stirrer')).toHaveAttribute('data-kind', 'wood');
});

test('눈으로 보기: 단계 세 칸이 보이고 지금 단계가 강조된다. 재생 뒤에는 증발 단계, 시각을 처음으로 옮기면 녹이기', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  const active = () => macro(page).locator('[data-testid=stage-panel][data-active=true]').getAttribute('data-stage');
  await expect(macro(page).getByTestId('stage-panel')).toHaveCount(3);
  expect(await active()).toBe('dissolve');
  await baselineRun(page, WATER);
  expect(await active()).toBe('evaporate');
  await expect(macro(page).getByText('증발 접시', { exact: true })).toBeVisible();
  await expect(macro(page).getByText('알코올램프', { exact: true })).toBeVisible();
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '20');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  expect(await active()).toBe('dissolve');
  // 강조되지 않은 칸도 내용이 그려진다
  await expect(macro(page).getByTestId('stage-art')).toHaveCount(3);
});

test('따르기 시행의 알갱이 그림은 거름종이 대신 윗물을 따르는 그림이다', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  await selectIV(page, FILTER);
  await setValue(page, FILTER, '거름종이 없이 윗물만 따르기');
  await run(page, '변하지 않는다', true);
  await expect(particles(page).getByTestId('pour-diagram')).toHaveCount(1);
  await expect(particles(page).getByTestId('poured-sand')).toHaveCount(2);
  await expect(particles(page).getByText('거름종이')).toHaveCount(0);
  await expect(particles(page).getByText('윗물만 따르기', { exact: true })).toBeVisible();
  await expect(particles(page).getByText('윗물을 따르면 가라앉지 않은 모래 알갱이도 함께 넘어갈 수 있어요.')).toBeVisible();
});

test('알갱이 그림 라벨 네 개가 보인다 (거름종이 기준, 실행 전후 모두)', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  const labels = ['녹은 소금', '녹지 않은 소금', '모래', '거름종이'];
  for (const l of labels) await expect(particles(page).getByText(l, { exact: true })).toBeVisible();
  await baselineRun(page, WATER);
  for (const l of labels) await expect(particles(page).getByText(l, { exact: true })).toBeVisible();
});

test('그래프: y축 0~12(0·3·6·9·12), x축 0~20분, 표식 두 개가 겹치지 않는다', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  await baselineRun(page, WATER);
  await expect(graph(page).getByText('접시 위 가루(g)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(분)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('거르기 시작')).toBeVisible();
  await expect(graph(page).getByText('가열 시작')).toBeVisible();
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '4', '8', '12', '16', '20']);
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['0', '3', '6', '9', '12']);
  const a = (await graph(page).getByText('거르기 시작').boundingBox())!;
  const b = (await graph(page).getByText('가열 시작').boundingBox())!;
  const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(overlap).toBe(false);
});

test('재생이 끝난 뒤 플레이헤드는 끝(20)에 있다', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  await baselineRun(page, WATER);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '20');
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByText('0.0분 · 녹이기 · 접시 위 가루 0.0 g')).toBeVisible();
});

test('녹은 소금 알갱이는 실험 중에만 움직이고, 단원을 떠나면 애니메이션 요청이 남지 않는다', async ({ page }) => {
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
  await gotoUnit(page, 'g5-mixture', { playback: 5 });
  await selectIV(page, WATER);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(particles(page).getByTestId('dissolved-dots')).toHaveAttribute('data-running', 'true');
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 15_000 });
  await expect(particles(page).getByTestId('dissolved-dots')).toHaveAttribute('data-running', 'false');
  const b = await particles(page).getByTestId('dissolved-dot').first().getAttribute('cx');
  await page.waitForTimeout(300);
  expect(await particles(page).getByTestId('dissolved-dot').first().getAttribute('cx')).toBe(b);

  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(particles(page).getByTestId('dissolved-dots')).toHaveAttribute('data-running', 'true');
  expect(await page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBeGreaterThan(0);
  await page.getByRole('link', { name: '← 단원 목록' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __raf: Set<number> }).__raf.size)).toBe(0);
});

test('움직임 줄이기이면 알갱이가 가만히 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoUnit(page, 'g5-mixture', { playback: 5 });
  await selectIV(page, WATER);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(particles(page).getByTestId('dissolved-dots')).toHaveAttribute('data-running', 'false');
  const first = () => particles(page).getByTestId('dissolved-dot').first().getAttribute('cx');
  const a = await first();
  await page.waitForTimeout(400);
  expect(await first()).toBe(a);
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
    await gotoUnit(page, 'g5-mixture');
    const check = async () => {
      for (const name of ['눈으로 보기', '알갱이 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, WATER);
    await check();
    await setValue(page, WATER, '20 mL');
    await setValue(page, FILTER, '거름종이 없이 윗물만 따르기');
    await run(page, '줄어든다');
    await check();
  });
});

// ---- 두 번째 활동: 분리 방법 고르기(카드 분류 groups) ----

test.describe('분리 방법 고르기 (두 번째 활동)', () => {
  const progress = (page: Page) => page.getByRole('region', { name: '진행 상황' });
  const magnifier = (page: Page) => page.getByRole('region', { name: '돋보기' });

  test('첫 활동 화면의 활동 탭으로 이동한다: 탭 이름, 주소, 질문', async ({ page }) => {
    await gotoUnit(page, 'g5-mixture');
    await expect(activityTabs(page)).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
    await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'false');
    await expect(activityTab(page, 2)).toHaveText(`활동 2 · ${MIXTURE_SORT_TITLE}`);
    await activityTab(page, 2).click();
    await expect(page).toHaveURL(/#\/unit\/g5-mixture\/separation-methods$/);
    await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 1, name: '혼합물의 분리' })).toBeVisible();
    await expect(page.getByText('탐구 질문: 혼합물을 이루는 물질의 성질이 다르면 어떻게 분리할 수 있을까?')).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(4);
    for (const card of MIXTURE_CARDS) await expect(mixtureCard(page, card)).toBeVisible();
    await expect(page.locator('.sort-card-sub')).toHaveCount(0);
    await expect(sortCheckButton(page)).toBeDisabled();
    await expect(sortTutor(page)).toContainText('혼합물들을 어떤 성질로 나누어 볼까요?');
    // 첫 활동으로 돌아가면 상태가 새로 시작한다.
    await activityTab(page, 1).click();
    await expect(page).toHaveURL(/#\/unit\/g5-mixture\/salt-sand$/);
    await expect(page.getByRole('group', { name: '넣는 물의 양' })).toBeVisible();
  });

  test('돋보기 버튼 문구는 "크기 비교하기", "자석 대 보기", "물에 넣어 보기"이다', async ({ page }) => {
    await gotoMixtureSort(page);
    await expect(magnifier(page).getByRole('button')).toHaveCount(0);
    await mixtureCard(page, '철 가루와 모래').click();
    for (const name of ['크기 비교하기', '자석 대 보기', '물에 넣어 보기']) {
      await expect(magnifier(page).getByRole('button', { name, exact: true })).toBeVisible();
    }
  });

  test('"한 가지가 자석에 붙나요?"로 관찰 없이 넣으면 미관찰 문장이, 관찰 뒤 철 구슬을 "붙지 않는다"에 넣으면 비교 문장이, 고치면 맞음 문장이 보인다', async ({ page }) => {
    await gotoMixtureSort(page);
    await sortChoose(page, '한 가지가 자석에 붙나요?');
    // 관찰 없이 넣는다.
    await mixtureSortAll(page, 'magnet', { observe: false });
    await sortCheckButton(page).click();
    await expect(page.getByText('아직 이 기준의 특징을 살펴보지 않았어요.')).toBeVisible();
    await expect(sortTutor(page)).toContainText('아직 시험해 보지 않았어요. 먼저 시험해 볼까요?');
    // 관찰하되 철 구슬과 유리 구슬을 "붙지 않는다"에 넣는다.
    for (const card of MIXTURE_CARDS) {
      await mixtureCard(page, card).click();
      await mixtureObserveButton(page, 'magnet').click();
    }
    await mixtureCard(page, '철 구슬과 유리 구슬').click();
    await sortPutButton(page, '붙지 않는다').click();
    await sortCheckButton(page).click();
    await expect(page.getByText('철 구슬과 유리 구슬은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?')).toBeVisible();
    await expect(sortTutor(page)).toContainText('철 구슬과 유리 구슬을 시험한 결과와 넣은 무리를 다시 비교해 볼까요?');
    // 어느 무리가 맞는지는 말하지 않는다.
    for (const box of [sortFeedback(page), sortTutor(page)]) {
      await expect(box).not.toContainText('붙는다');
      await expect(box).not.toContainText('철 가루는');
    }
    await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
    // 고친다.
    await mixtureCard(page, '철 구슬과 유리 구슬').click();
    await sortPutButton(page, '붙는다').click();
    await sortCheckButton(page).click();
    await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
    await expect(progress(page)).toContainText('끝낸 기준: 한 가지가 자석에 붙나요? (1/2)');
  });

  test('"보기에 깨끗한가요?"는 판정하지 않고 사람마다 다르다고만 한다', async ({ page }) => {
    await gotoMixtureSort(page);
    await sortChoose(page, '보기에 깨끗한가요?');
    for (const [i, card] of MIXTURE_CARDS.entries()) {
      await mixtureCard(page, card).click();
      await sortPutButton(page, i % 2 === 0 ? '깨끗해 보인다' : '지저분해 보인다').click();
    }
    await sortCheckButton(page).click();
    await expect(page.getByText('이 기준은 사람마다 다르게 나눌 수 있어요.')).toBeVisible();
    await expect(sortTutor(page)).toContainText("'보기에 깨끗한가요?'로 나누면 친구와 내 결과가 같을까요?");
    await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
  });

  test('두 기준을 끝내면 완료 문구와 "어떤 도구로 분리할 수 있을까요?" 마무리 질문이 나온다', async ({ page }) => {
    await gotoMixtureSort(page);
    await mixtureFinishCriterion(page, 'magnet');
    await expect(page.getByText('두 가지 기준으로 분류했어요!')).toHaveCount(0);
    await mixtureFinishCriterion(page, 'dissolve');
    await expect(progress(page)).toContainText('끝낸 기준: 한 가지가 자석에 붙나요?, 한 가지만 물에 녹나요? (2/2)');
    await expect(page.getByText('두 가지 기준으로 분류했어요!')).toBeVisible();
    await expect(sortTutor(page)).toContainText('어떤 도구로 분리할 수 있을까요?');
    await expect(sortTutor(page)).toContainText('두 가지 방법이 다 될 것 같은 혼합물도 있나요?');
  });

  test('관찰하기 전에는 기본 그림만 보이고, 시험한 특징의 결과 그림만 나타난다', async ({ page }) => {
    await gotoMixtureSort(page);
    await mixtureCard(page, '철 가루와 모래').click();
    await expect(page.locator('svg.mixture-icon')).toHaveCount(7); // 더미 6장 + 돋보기 1장
    await expect(page.locator('svg .mix-result')).toHaveCount(0);

    await mixtureObserveButton(page, 'magnet').click();
    await expect(page.locator('svg .mix-magnet')).toHaveCount(1);
    await expect(page.locator('svg .mix-stuck')).toHaveCount(1); // 철 가루는 자석에 달라붙는다
    await expect(page.locator('svg .mix-size, svg .mix-beaker')).toHaveCount(0);
    await expect(magnifier(page)).toContainText('자석을 가까이 대면 검은 가루만 자석에 달라붙어요.');

    await mixtureObserveButton(page, 'size').click();
    await expect(page.locator('svg .mix-size')).toHaveCount(1);
    await mixtureObserveButton(page, 'dissolve').click();
    await expect(page.locator('svg .mix-beaker')).toHaveCount(1);
    await expect(page.locator('svg .mix-settle')).toHaveCount(1); // 철 가루와 모래는 녹지 않고 가라앉는다
    await expect(page.locator('svg .mix-gone')).toHaveCount(0);

    // 다른 카드를 고르면 그 카드에서 시험한 것만 그려진다.
    await mixtureCard(page, '소금과 모래').click();
    await expect(page.locator('svg .mix-result')).toHaveCount(0);
    await mixtureObserveButton(page, 'dissolve').click();
    await expect(page.locator('svg .mix-gone')).toHaveCount(1);
    await expect(page.locator('svg .mix-stuck')).toHaveCount(0);
  });

  test('아직 관찰하지 않은 문장은 화면에 없다', async ({ page }) => {
    await gotoMixtureSort(page);
    const body = page.locator('body');
    await mixtureCard(page, '설탕과 콩').click();
    for (const s of ['콩은 크고 설탕 알갱이는 작아요.', '물에 넣고 저으면 설탕은 보이지 않게 되고']) await expect(body).not.toContainText(s);
    await mixtureObserveButton(page, 'size').click();
    await expect(body).toContainText('콩은 크고 설탕 알갱이는 작아요.');
    await expect(body).not.toContainText('물에 넣고 저으면 설탕은 보이지 않게 되고');
  });

  test('첫 활동(소금과 모래) 화면은 그대로이고 탭만 더해졌다', async ({ page }) => {
    await gotoUnit(page, 'g5-mixture');
    await expect(page.getByRole('heading', { level: 1, name: '혼합물의 분리' })).toBeVisible();
    await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('group', { name: '넣는 물의 양' })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(3);
  });

  for (const vp of [{ width: 390, height: 800 }, { width: 1280, height: 800 }]) {
    test.describe(`${vp.width}px`, () => {
      test.use({ viewport: vp });
      test('가로 스크롤이 없다 (처음, 카드를 시험한 뒤, 모두 넣은 뒤)', async ({ page }) => {
        await gotoMixtureSort(page);
        const noScroll = async () => {
          const { sw, iw } = await scrollWidth(page);
          expect(sw).toBeLessThanOrEqual(iw);
        };
        await noScroll();
        await sortChoose(page, '한 가지만 물에 녹나요?');
        await mixtureCard(page, '설탕과 콩').click();
        await mixtureObserveButton(page, 'dissolve').click();
        await noScroll();
        await mixtureSortAll(page, 'dissolve');
        await sortCheckButton(page).click();
        await noScroll();
      });
    });
  }
});
