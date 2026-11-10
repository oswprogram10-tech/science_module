import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, scrollWidth } from './helpers';

const ID = 'g4-night-sky';
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const feedbackBox = (page: Page) => page.getByRole('heading', { name: '피드백' }).locator('..');
const slider = (page: Page) => page.getByRole('slider', { name: '시각', exact: true });
const recordBtn = (page: Page, label: string) => region(page, '관찰 기록').getByRole('button', { name: label, exact: true });
const toggle = (page: Page, label: string) => region(page, '관찰하기').getByRole('button', { name: label, exact: true });

async function pickTask(page: Page, title: string) {
  await region(page, '과제 목록').getByRole('button', { name: new RegExp(`^${title}`) }).click();
  await expect(region(page, '과제 목록').getByRole('button', { name: new RegExp(`^${title}`) })).toHaveAttribute('aria-current', 'true');
}
const predict = (page: Page, label: string) => region(page, '예측').getByRole('button', { name: label, exact: true }).click();

const num = async (l: Locator, attr: string) => Number(await l.getAttribute(attr));
const starXY = async (page: Page, key: string) => {
  const c = page.getByTestId(`star-${key}`);
  return { x: await num(c, 'cx'), y: await num(c, 'cy') };
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test.beforeEach(async ({ page }) => {
  await gotoUnit(page, ID);
});

test('단원 화면: 과제 6개(달 모양 과제 둘은 맨 뒤), 태양계 모형 보기 하나, 예측 전에는 조작과 기록이 잠겨 있다', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: '밤하늘 관찰' })).toBeVisible();
  await expect(region(page, '과제 목록').getByRole('button')).toHaveCount(6);
  await expect(page.getByRole('figure', { name: '태양계 모형 보기' })).toBeVisible();
  await expect(page.getByRole('figure', { name: '땅에서 보기' })).toHaveCount(0);
  await expect(toggle(page, '거리 비교')).toBeDisabled();
  await expect(recordBtn(page, '약 11배')).toBeDisabled();
  await expect(tutorBox(page)).toContainText('지구와 목성 중 어느 쪽이 더 클지');
});

test('planet-size: 목성 배수는 "?"이고, 틀린 기록은 다시 보게 하며, 맞는 기록 뒤에 11이 보인다', async ({ page }) => {
  await predict(page, '약 2배');
  await expect(slider(page)).toHaveCount(0);
  // 조작 전에는 기록할 수 없다. 이미 고른 크기 비교를 눌러도 살펴본 것으로 친다.
  await expect(recordBtn(page, '약 2배')).toBeDisabled();
  await toggle(page, '크기 비교').click();
  await expect(page.getByTestId('size-label-jupiter')).toHaveText('지구의 약 ?배');
  await expect(page.getByTestId('size-label-saturn')).toHaveText('지구의 약 9.4배');
  await expect(page.getByTestId('sun-label')).toHaveText('태양(지구의 약 109배)');
  await expect(page.getByTestId('planet-circle-earth')).toHaveAttribute('data-diameter', '10.00');
  await expect(page.locator('body')).not.toContainText('약 11배 크');

  await recordBtn(page, '약 2배').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await expect(tutorBox(page)).toContainText('목성 원의 지름이 몇 칸인지 다시 세어 볼까요?');
  await expect(page.getByTestId('size-label-jupiter')).toHaveText('지구의 약 ?배');

  await recordBtn(page, '약 11배').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(page.getByTestId('size-label-jupiter')).toHaveText('지구의 약 11배');
  await expect(tutorBox(page)).toContainText('예측과 관찰이 달랐네요.');
  await expect(region(page, '과제 목록').getByRole('button', { name: /^행성의 크기 비교/ })).toContainText('✓ 완료');
  await expect(page.locator('body')).not.toContainText(/틀렸|정답/);
});

test('planet-distance: 거리 비교 막대에 0~30 눈금이 있고 해왕성 칸 수는 "?"이며, 기록 "30"이 맞다', async ({ page }) => {
  await pickTask(page, '행성까지의 거리 비교');
  await predict(page, '약 3칸');
  await expect(page.getByTestId('solar-svg')).toHaveAttribute('data-mode', 'distance');
  await expect(page.getByTestId('tick-0')).toHaveText('0');
  await expect(page.getByTestId('tick-30')).toHaveText('30');
  await expect(page.getByTestId('dist-label-neptune')).toHaveText('해왕성 ?칸');
  await expect(page.getByTestId('dist-label-jupiter')).toHaveText('목성 5.2칸');
  await toggle(page, '거리 비교').click();
  await recordBtn(page, '약 10칸').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await expect(tutorBox(page)).toContainText('눈금을 다시 세어 볼까요?');
  await expect(page.getByTestId('dist-label-neptune')).toHaveText('해왕성 ?칸');
  await recordBtn(page, '약 30칸').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(page.getByTestId('dist-label-neptune')).toHaveText('해왕성 30칸');
  // 크기 비교로 바꿔도 이 과제에서는 목성 배수를 그대로 보여 준다.
  await toggle(page, '크기 비교').click();
  await expect(page.getByTestId('size-label-jupiter')).toHaveText('지구의 약 11배');
});

test('find-polaris: 길잡이 선(점선)은 켤 때 보이고, 선택지의 별 이름은 기록 전에도 모두 보인다', async ({ page }) => {
  await pickTask(page, '북극성 찾기');
  await predict(page, '직녀성');
  await expect(page.getByRole('figure', { name: '북쪽 하늘 보기' })).toBeVisible();
  await expect(page.getByTestId('guide-line')).toHaveCount(0);
  for (const [k, t] of [['polaris', '북극성'], ['kochab', '코카브'], ['capella', '카펠라']]) await expect(page.getByTestId(`name-${k}`)).toHaveText(t);
  await toggle(page, '길잡이 선 보기').click();
  await expect(page.getByTestId('guide-line')).toHaveAttribute('stroke-dasharray', /\d/);
  await expect(toggle(page, '길잡이 선 보기')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('name-dubhe')).toHaveText('두베');
  await expect(page.getByTestId('name-dipper')).toHaveText('북두칠성');
  await expect(page.getByTestId('name-cassiopeia')).toHaveText('카시오페이아');
  await expect(page.getByTestId('name-polaris')).toHaveText('북극성');

  await recordBtn(page, '작은곰자리의 밝은 별(코카브)').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await recordBtn(page, '북극성').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(page.getByTestId('name-polaris')).toHaveText('북극성');
  await expect(tutorBox(page)).toContainText('예측과 관찰이 달랐네요.');
});

test('find-polaris: 점선 끝은 북극성 가까이에 있다(코카브보다)', async ({ page }) => {
  await pickTask(page, '북극성 찾기');
  await predict(page, '북극성');
  await toggle(page, '길잡이 선 보기').click();
  const pts = (await page.getByTestId('guide-line').getAttribute('points'))!.trim().split(' ').map((p) => p.split(',').map(Number));
  const last = { x: pts[pts.length - 1]![0]!, y: pts[pts.length - 1]![1]! };
  const polaris = await starXY(page, 'polaris');
  const kochab = await starXY(page, 'kochab');
  expect(dist(last, polaris)).toBeLessThan(dist(last, kochab) / 3);
});

test('시각 슬라이더: 오후 7시~새벽 3시, 키보드로 30분씩 움직인다', async ({ page }) => {
  await pickTask(page, '밤 동안 북극성의 움직임');
  await expect(slider(page)).toBeDisabled();
  await predict(page, '거의 움직이지 않아요');
  await expect(slider(page)).toHaveAttribute('min', '19');
  await expect(slider(page)).toHaveAttribute('max', '27');
  await expect(slider(page)).toHaveAttribute('step', '0.5');
  await expect(slider(page)).toHaveValue('21');
  await slider(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider(page)).toHaveValue('21.5');
  await expect(page.getByTestId('night-caption')).toHaveText('오후 9시 30분 · 북쪽 하늘');
  await page.keyboard.press('End');
  await expect(slider(page)).toHaveValue('27');
  await expect(page.getByTestId('night-caption')).toHaveText('오전 3시 · 북쪽 하늘');
  await page.keyboard.press('Home');
  await expect(slider(page)).toHaveValue('19');
});

test('polaris-still: 9시 → 자정에 북두칠성은 크게 움직이고 북극성은 1/20 미만이다. 자취는 흐린 점으로 남는다', async ({ page }) => {
  await pickTask(page, '밤 동안 북극성의 움직임');
  await predict(page, '동쪽에서 서쪽으로');
  await expect(page.getByTestId('name-polaris')).toHaveText('북극성');
  await expect(page.getByTestId('star-trails')).toHaveCount(0);
  const d0 = await starXY(page, 'dubhe');
  const p0 = await starXY(page, 'polaris');
  await toggle(page, '별 자취 남기기').click();
  await slider(page).fill('24');
  await expect(page.getByTestId('night-caption')).toHaveText('자정(오전 12시) · 북쪽 하늘');
  const d1 = await starXY(page, 'dubhe');
  const p1 = await starXY(page, 'polaris');
  expect(dist(d0, d1)).toBeGreaterThan(40);
  expect(dist(p0, p1) * 20).toBeLessThan(dist(d0, d1));
  expect(await page.getByTestId('star-trails').locator('circle').count()).toBeGreaterThan(20);

  await recordBtn(page, '동쪽에서 서쪽으로').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await recordBtn(page, '거의 움직이지 않아요').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');

  // 자전 방향을 "만약에"로 바꿔도 북극성은 거의 그대로다.
  await toggle(page, '동쪽에서 서쪽으로 (만약에)').click();
  await slider(page).fill('21');
  const q0 = await starXY(page, 'polaris');
  const e0 = await starXY(page, 'dubhe');
  await slider(page).fill('24');
  const q1 = await starXY(page, 'polaris');
  const e1 = await starXY(page, 'dubhe');
  expect(dist(q0, q1) * 20).toBeLessThan(dist(e0, e1));
  await recordBtn(page, '거의 움직이지 않아요').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
});

test('움직임 줄이기이면 재생 버튼이 없다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await pickTask(page, '북극성 찾기');
  await predict(page, '북극성');
  await expect(page.getByRole('button', { name: /재생/ })).toHaveCount(0);
});

test('재생 버튼은 오후 7시부터 새벽 3시까지 돌고 멈춘다', async ({ page }) => {
  await pickTask(page, '북극성 찾기');
  await predict(page, '북극성');
  await page.getByRole('button', { name: '▶ 재생' }).click();
  await expect(slider(page)).toHaveValue('27');
  await expect(page.getByRole('button', { name: '▶ 재생' })).toBeVisible();
});

test.describe('1280x800 화면', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function sizes(svg: Locator) {
    return svg.evaluate((el) => {
      const s = el as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll('text')].map((t) => ({ text: (t.textContent ?? '').trim(), px: parseFloat(getComputedStyle(t).fontSize) * scale }));
    });
  }

  test('모든 보기의 SVG 글자는 화면 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, ID);
    const check = async (label: string) => {
      const list = await sizes(page.getByRole('figure').locator('svg').first());
      expect(list.length, label).toBeGreaterThan(0);
      for (const { text, px } of list) expect(px, `${label}: "${text}"`).toBeGreaterThanOrEqual(13);
    };
    await predict(page, '약 2배');
    await check('크기');
    await toggle(page, '거리 비교').click();
    await check('거리');
    await pickTask(page, '북극성 찾기');
    await predict(page, '북극성');
    await toggle(page, '길잡이 선 보기').click();
    await check('북쪽 하늘');
    await recordBtn(page, '북극성').click();
    await check('북쪽 하늘 기록 뒤');
  });
});

test.describe('390x844 화면', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function sizes(svg: Locator) {
    return svg.evaluate((el) => {
      const s = el as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll('text')].map((t) => ({ text: (t.textContent ?? '').trim(), px: parseFloat(getComputedStyle(t).fontSize) * scale }));
    });
  }

  test('가로 스크롤이 없고 거리 막대는 세로이며 글자는 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, ID);
    const noScroll = async (label: string) => {
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(sw, label).toBeLessThanOrEqual(iw);
      const list = await sizes(page.getByRole('figure').locator('svg').first());
      for (const { text, px } of list) expect(px, `${label}: "${text}"`).toBeGreaterThanOrEqual(13);
    };
    await predict(page, '약 2배');
    await expect(page.getByTestId('solar-svg')).toHaveAttribute('data-layout', 'narrow');
    await noScroll('크기');
    await toggle(page, '거리 비교').click();
    await expect(page.getByTestId('solar-svg')).toHaveAttribute('data-mode', 'distance');
    await expect(page.getByTestId('solar-svg')).toHaveAttribute('data-layout', 'narrow');
    // 세로 막대: 0 눈금이 30 눈금보다 위에 있다.
    const y0 = (await page.getByTestId('tick-0').boundingBox())!.y;
    const y30 = (await page.getByTestId('tick-30').boundingBox())!.y;
    expect(y30).toBeGreaterThan(y0 + 200);
    await noScroll('거리');
    await pickTask(page, '북극성 찾기');
    await predict(page, '북극성');
    await toggle(page, '길잡이 선 보기').click();
    await expect(page.getByTestId('north-svg')).toHaveAttribute('data-layout', 'narrow');
    await noScroll('북쪽 하늘');
  });
});

// ---- 달 모양 과제(음력 날짜 슬라이더로 땅·우주 두 그림 비교) ----
const moonSlider = (page: Page) => page.getByRole('slider', { name: '음력 날짜', exact: true });
/** range 입력의 값을 바꾼다(React가 change를 받도록 입력 이벤트를 일으킨다). */
const setSlider = (input: Locator, value: number) => input.fill(String(value));
const SHAPE_NAMES = ['초승달', '상현달', '보름달이에요', '하현달', '그믐달', '보름과 하현 사이', '상현과 보름 사이', '삭 무렵'];
const moonDisc = (page: Page) => page.getByTestId('moon-disc');
const moonGround = (page: Page) => page.getByTestId('moon-ground');
const shapeName = (page: Page) => page.getByTestId('moon-shape-name');

/** 달 그림의 화면 위치와 밝은 부분의 크기(data-lit-width는 달 지름 방향 길이). */
async function moonMeasure(page: Page) {
  const box = (await moonDisc(page).boundingBox())!;
  const g = moonGround(page);
  return { x: box.x + box.width / 2, frac: Number(await g.getAttribute('data-frac')), lit: Number(await g.getAttribute('data-lit-width')), waxing: await g.getAttribute('data-waxing') };
}

test('달 모양 과제: 3일 → 10일에 달이 왼쪽(동쪽)으로 옮겨 가고 밝은 부분이 넓어진다. 모양 이름은 기록 전에 없다', async ({ page }) => {
  await pickTask(page, '저녁 달의 모양과 위치');
  await expect(moonSlider(page)).toBeDisabled();
  await predict(page, '점점 차오르고 동쪽으로 옮겨 가요');
  const input = moonSlider(page);
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('3');
  await expect(recordBtn(page, '점점 차오르고 동쪽으로 옮겨 가요')).toBeDisabled();
  const a = await moonMeasure(page);
  expect(a.waxing).toBe('true');
  await expect(page.getByTestId('moon-ground-caption')).toContainText('음력 3일');
  await expect(page.getByTestId('moon-ground-caption')).toContainText('오른쪽이 밝아요');
  await setSlider(input, 10);
  await expect(input).toHaveAttribute('aria-valuetext', '음력 10일');
  const b = await moonMeasure(page);
  expect(b.x).toBeLessThan(a.x - 20);
  expect(b.frac).toBeGreaterThan(a.frac);
  expect(b.lit).toBeGreaterThan(a.lit);
  // 기록 전에는 어디에도 모양 이름이 없다.
  await expect(shapeName(page)).toHaveCount(0);
  const body = await page.locator('body').innerText();
  const aria = await page.locator('svg[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join(' '));
  for (const n of SHAPE_NAMES) {
    expect(body, n).not.toContain(n);
    expect(aria, n).not.toContain(n);
  }
  // 틀리게 기록하면 이름이 없고, 맞게 기록하면 "이 날의 달"이 보인다.
  await recordBtn(page, '모양과 위치가 그대로예요').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await expect(shapeName(page)).toHaveCount(0);
  await recordBtn(page, '점점 차오르고 동쪽으로 옮겨 가요').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(shapeName(page)).toHaveText('이 날의 달: 상현과 보름 사이');
  await setSlider(input, 3);
  await expect(shapeName(page)).toHaveText('이 날의 달: 초승달');
  await expect(region(page, '과제 목록').getByRole('button', { name: /^저녁 달의 모양과 위치/ })).toContainText('✓ 완료');
});

test('달 모양 과제: 18일에는 달이 보이지 않는다는 문구가 보인다', async ({ page }) => {
  await pickTask(page, '저녁 달의 모양과 위치');
  await predict(page, '점점 줄어들고 서쪽으로 옮겨 가요');
  await setSlider(moonSlider(page), 18);
  await expect(page.getByTestId('moon-hidden-note')).toHaveText('이 시각에는 달이 보이지 않아요');
  await expect(moonGround(page)).toHaveCount(0);
  await expect(page.getByTestId('moon-ground-caption')).toContainText('보이지 않아요');
  await setSlider(moonSlider(page), 8);
  await expect(page.getByTestId('moon-hidden-note')).toHaveCount(0);
  await expect(moonGround(page)).toHaveCount(1);
});

test('달 모양 과제: 슬라이더는 키보드로 조작하고, 우주에서 보기 달은 날짜 따라 돌며 태양 쪽이 밝다', async ({ page }) => {
  await pickTask(page, '저녁 달의 모양과 위치');
  await predict(page, '모양과 위치가 그대로예요');
  const input = moonSlider(page);
  await input.focus();
  await page.keyboard.press('ArrowRight');
  await expect(input).toHaveAttribute('aria-valuetext', '음력 4일');
  await page.keyboard.press('End');
  await expect(input).toHaveAttribute('aria-valuetext', '음력 29일');
  await page.keyboard.press('Home');
  await expect(input).toHaveAttribute('aria-valuetext', '음력 1일');
  const spaceMoon = page.getByTestId('moon-space');
  await expect(spaceMoon).toHaveAttribute('data-lit-side', 'sun');
  await setSlider(input, 8);
  const x8 = (await spaceMoon.boundingBox())!.x;
  await setSlider(input, 15);
  const x15 = (await spaceMoon.boundingBox())!.x;
  expect(x15).toBeGreaterThan(x8);
  await expect(page.getByTestId('moon-space-caption')).toContainText('음력 15일');
});

test('보름달 과제: 15일 무렵을 기록하면 맞게 기록했다고 알려 주고 보름달을 보여 준다', async ({ page }) => {
  await pickTask(page, '보름달이 뜨는 날');
  await predict(page, '15일 무렵');
  await setSlider(moonSlider(page), 15);
  await expect(tutorBox(page)).toContainText('밝은 부분이 가장 넓은 날을 찾아볼까요?');
  await recordBtn(page, '22일 무렵').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await expect(shapeName(page)).toHaveCount(0);
  await expect(tutorBox(page)).toContainText('앞뒤 날짜의 달보다');
  await recordBtn(page, '15일 무렵').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(shapeName(page)).toHaveText('이 날의 달: 보름달');
  await expect(tutorBox(page)).toContainText('태양, 지구, 달은 어떻게 늘어서 있을까요?');
  await expect(page.getByTestId('compare')).toHaveText('예측: 15일 무렵 / 관찰: 15일 무렵');
  await expect(page.locator('body')).not.toContainText(/틀렸|정답/);
});

test.describe('달 모양 과제: 390x844 화면', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('가로 스크롤이 없고 두 그림이 화면 안에 있다', async ({ page }) => {
    await gotoUnit(page, ID);
    await pickTask(page, '저녁 달의 모양과 위치');
    await predict(page, '점점 차오르고 동쪽으로 옮겨 가요');
    for (const d of [1, 3, 10, 15, 18, 29]) {
      await setSlider(moonSlider(page), d);
      const { sw, iw } = await scrollWidth(page);
      expect(sw, `${d}일`).toBeLessThanOrEqual(iw);
    }
    for (const id of ['moon-ground-svg', 'moon-space-svg']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  });
});
