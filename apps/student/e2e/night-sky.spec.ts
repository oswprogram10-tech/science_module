import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit } from './helpers';

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

test('단원 화면: 과제 4개, 태양계 모형 보기 하나, 예측 전에는 조작과 기록이 잠겨 있다', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: '밤하늘 관찰' })).toBeVisible();
  await expect(region(page, '과제 목록').getByRole('button')).toHaveCount(4);
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
