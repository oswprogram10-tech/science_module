import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, sensor, scrollWidth } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const particles = (page: Page) => page.getByRole('figure', { name: '알갱이 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const WATER = '물의 종류';
const VOLUME = '증발 접시에 붓는 물의 양';
const DISH = '증발 접시 모양';
const NOTICE_HEAT = '⚠ 증발 접시와 알코올램프는 아주 뜨거워요. 선생님과 함께 다뤄요.';
const NOTICE_TASTE = '⚠ 실험에 쓰는 바닷물은 맛보지 않아요.';
const LIMITS = ['염분', '염화 나트륨', '용질', '용매', '농도', '밀도', '퍼밀'];

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

/** 기준 시행(지금 고른 조건 그대로)을 한다. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 남은 하얀 가루·물이 다 마른 시간: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

test('점검표를 거쳐 기준(강물, 50 mL, 둥근 접시)을 하면 0.0, 10분이 보이고 상시 문구와 가상 전자저울이 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await expect(page.getByRole('heading', { level: 1, name: '지구와 바다' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 바닷물과 강물을 증발시키면 남는 것이 어떻게 다를까?')).toBeVisible();
  await expect(page.getByText('예측: 물을 모두 증발시킨 뒤 접시에 남는 하얀 가루의 양은?')).toBeVisible();
  // 상시 안전 문구
  await expect(page.getByText(NOTICE_TASTE)).toBeVisible();
  await expect(page.getByText(NOTICE_HEAT)).toBeVisible();
  // 실행 전에는 결과(접시 위 가루, 결정, 마른 접시)를 보여 주지 않는다
  await expect(macro(page).getByTestId('sea-water-note')).not.toContainText('접시 위 가루');
  await expect(macro(page).getByTestId('dish-crystal')).toHaveCount(0);
  await expect(macro(page).getByTestId('dish-film')).toHaveCount(0);
  await expect(macro(page).getByTestId('flame')).toHaveCount(0);
  await expect(macro(page).getByTestId('dish-art')).toHaveAttribute('data-dry', 'false');
  await expect(particles(page).getByTestId('salt-dot')).toHaveCount(0);
  for (const term of LIMITS) await expect(page.getByText(term)).toHaveCount(0);

  await selectIV(page, WATER);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('보안경을 썼어요.')).toBeVisible();
  await expect(dialog.getByText('가열하는 증발 접시는 맨손으로 만지지 않아요.')).toBeVisible();
  await expect(dialog.getByText('알코올램프 주변에 종이를 두지 않았어요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  expect(await resultCells(resultRows(page).first())).toEqual(['0.0', '10']);
  await expect(page.getByRole('columnheader', { name: '남은 하얀 가루(g)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '물이 다 마른 시간(분)' })).toBeVisible();
  await expect(macro(page).getByText('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 0.0 g')).toBeVisible();
  // 강물은 다 말라도 결정이 보이지 않는다
  await expect(macro(page).getByTestId('dish-crystal')).toHaveCount(0);
  await expect(macro(page).getByTestId('dish-art')).toHaveAttribute('data-dry', 'true');
  await expect(page.getByText('가상 전자저울: 접시 위 가루')).toBeVisible();
  await expect(sensor(page, '무게')).toContainText('g');
  await expect(page.getByText(NOTICE_TASTE)).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(new RegExp(LIMITS.join('|')));
});

test('물의 종류만 바닷물로 바꾸면 1.8, 10분, 결과: 늘어났다, 물의 종류 전용 질문이 나오고 하얀 결정이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, WATER);
  await expect(macro(page).getByTestId('dish-crystal')).toHaveCount(0);

  await setValue(page, WATER, '바닷물');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['1.8', '10']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('물의 종류만 바꾸었어요. 물이 다 마른 뒤 접시에는 무엇이 보이나요? 알갱이 그림에서 물 알갱이와 소금 알갱이는 각각 어떻게 되었나요?');
  await expect(macro(page).getByText('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 1.8 g')).toBeVisible();
  await expect(macro(page).getByTestId('dish-crystal')).toHaveCount(14);
  await expect(macro(page).getByTestId('dish-film')).toHaveCount(0);
  // 시각을 처음으로 옮기면 물이 가득하고 결정이 없다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('dish-crystal')).toHaveCount(0);
  await expect(macro(page).getByTestId('dish-art')).toHaveAttribute('data-dish-water', '50.00');
  await expect(macro(page).getByText('0.0분 · 접시에 남은 물 50 mL · 접시 위 가루 0.0 g')).toBeVisible();
});

test('새 페이지에서 바닷물을 100 mL로 바꾸면 3.6, 20분, 결과: 늘어났다, 물의 양 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await setValue(page, WATER, '바닷물');
  await baselineRun(page, VOLUME);
  expect(await resultCells(resultRows(page).first())).toEqual(['1.8', '10']);

  await setValue(page, VOLUME, '100 mL');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['3.6', '20']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('물의 양만 바꾸었어요. 물이 다 마른 시간은 어떻게 달라졌나요? 접시에 남은 하얀 가루의 양도 함께 살펴볼까요?');
  await expect(macro(page).getByText('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 3.6 g')).toBeVisible();
  await expect(macro(page).getByTestId('dish-crystal')).toHaveCount(29);
});

test('새 페이지에서 접시 모양만 바꾸면 결과: 변하지 않았다 (1.8, 10분 그대로)', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await setValue(page, WATER, '바닷물');
  await baselineRun(page, DISH);
  await expect(macro(page).getByTestId('dish-art')).toHaveAttribute('data-dish', 'round');

  await setValue(page, DISH, '네모난 접시');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['1.8', '10']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('접시 모양만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('dish-art')).toHaveAttribute('data-dish', 'square');
  await expect(macro(page).getByText('네모난 증발 접시', { exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('dish-crystal')).toHaveCount(14);
});

test('눈으로 보기: 증발 접시와 알코올램프 라벨이 보이고, 가열하는 동안에만 불꽃이 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea', { playback: 8 });
  await expect(macro(page).getByText('알코올램프', { exact: true })).toBeVisible();
  await expect(macro(page).getByText('둥근 증발 접시', { exact: true })).toBeVisible();
  await expect(macro(page).getByText('강물 50 mL', { exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('flame')).toHaveCount(0);
  await selectIV(page, WATER);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(macro(page).getByTestId('flame')).toHaveCount(1);
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 20_000 });
  await expect(macro(page).getByTestId('flame')).toHaveCount(0);
});

test('알갱이 보기: 물 알갱이·소금 알갱이 범례, 바닷물이면 물이 다 마른 뒤 소금 알갱이가 남는다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  for (const l of ['물 알갱이', '소금 알갱이']) await expect(particles(page).getByText(l, { exact: true })).toBeVisible();
  await expect(particles(page).getByTestId('water-dot')).toHaveCount(30);
  await expect(particles(page).getByTestId('salt-dot')).toHaveCount(0);
  await expect(particles(page).getByText('실험하면 접시 속 알갱이가 어떻게 달라지는지 볼 수 있어요.')).toBeVisible();

  await setValue(page, WATER, '바닷물');
  await baselineRun(page, WATER);
  for (const l of ['물 알갱이', '소금 알갱이']) await expect(particles(page).getByText(l, { exact: true })).toBeVisible();
  await expect(particles(page).getByTestId('water-dot')).toHaveCount(0);
  await expect(particles(page).getByTestId('salt-dot')).toHaveCount(12);
  await expect(particles(page).getByText('물이 증발하면 물 알갱이는 날아가고, 소금 알갱이는 접시에 남아요.')).toBeVisible();
  // 시각을 처음으로 옮기면 물 알갱이가 모두 있고, 소금 알갱이는 그대로 있다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(particles(page).getByTestId('water-dot')).toHaveCount(30);
  await expect(particles(page).getByTestId('salt-dot')).toHaveCount(12);
});

test('알갱이 보기: 강물이면 소금 알갱이가 아주 적게(1개) 보인다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, WATER);
  await expect(particles(page).getByTestId('salt-dot')).toHaveCount(1);
  await expect(particles(page).getByTestId('water-dot')).toHaveCount(0);
  await expect(particles(page).getByText('물이 증발하면 물 알갱이는 날아가요. 소금 알갱이는 아주 적게만 보여요.')).toBeVisible();
});

test('그래프: 선 하나, y축 0~100(0·25·50·75·100), x축 0~20분(0·5·10·15·20)', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, WATER);
  await expect(graph(page).getByText('접시에 남은 물(mL)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('시간(분)', { exact: true })).toBeVisible();
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '5', '10', '15', '20']);
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['0', '25', '50', '75', '100']);
  // 선 하나(여러 선 그래프의 범례·series 선은 없다)
  await expect(graph(page).locator('polyline[stroke="#1f6fb5"]')).toHaveCount(1);
  await expect(graph(page).getByTestId('graph-series')).toHaveCount(0);
  await expect(graph(page).getByTestId('graph-legend-item')).toHaveCount(0);
  await expect(graph(page).getByTestId('graph-marker')).toHaveCount(0);
});

test('재생이 끝난 뒤 플레이헤드는 끝(20)에 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await baselineRun(page, WATER);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '20');
});

test('390 px 화면에도 가로 스크롤이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoUnit(page, 'g3-earth-sea');
  await setValue(page, WATER, '바닷물');
  await setValue(page, VOLUME, '100 mL');
  await baselineRun(page, WATER);
  const { sw, iw } = await scrollWidth(page);
  expect(sw).toBeLessThanOrEqual(iw);
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
    await gotoUnit(page, 'g3-earth-sea');
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
    await setValue(page, WATER, '바닷물');
    await setValue(page, VOLUME, '100 mL');
    await setValue(page, DISH, '네모난 접시');
    await run(page, '늘어난다');
    await check();
  });
});

// ---- 활동 2: 밀물과 썰물 관찰하기 (관찰 활동) ----
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const feedbackBox = (page: Page) => page.getByRole('heading', { name: '피드백' }).locator('..');
const timeSlider = (page: Page) => page.getByRole('slider', { name: '시각', exact: true });
const tideWater = (page: Page) => page.getByTestId('tide-water');
const pickTask = async (page: Page, title: string) => {
  await region(page, '과제 목록').getByRole('button', { name: new RegExp(`^${title}`) }).click();
  await expect(region(page, '과제 목록').getByRole('button', { name: new RegExp(`^${title}`) })).toHaveAttribute('aria-current', 'true');
};
const tidePredict = (page: Page, label: string) => region(page, '예측').getByRole('button', { name: label, exact: true }).click();
const tideRecord = (page: Page, label: string) => region(page, '관찰 기록').getByRole('button', { name: label, exact: true }).click();
const setHour = (page: Page, h: number) => timeSlider(page).fill(String(h));
const num = async (l: Locator, attr: string) => Number(await l.getAttribute(attr));

test('탭으로 활동 2(밀물과 썰물 관찰하기)로 가면 관찰 화면과 탐구 질문이 보이고, 바닷가 보기는 예측 전에도 보인다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea');
  await expect(page.getByRole('tab', { name: /^활동 2 · 밀물과 썰물 관찰하기$/ })).toBeVisible();
  await page.getByRole('tab', { name: /^활동 2 · / }).click();
  await expect(page).toHaveURL(/#\/unit\/g3-earth-sea\/tide$/);
  await expect(page.getByText('탐구 질문: 바닷가의 바닷물 높이는 하루 동안 어떻게 달라질까?')).toBeVisible();
  await expect(region(page, '과제 목록').getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('figure', { name: '바닷가 보기' })).toBeVisible();
  await expect(page.getByRole('figure', { name: '하루 그래프' })).toBeVisible();
  await expect(tideWater(page)).toHaveAttribute('data-exposed', 'false');
  await expect(timeSlider(page)).toBeDisabled();
  await expect(timeSlider(page)).toHaveValue('2');
  // 라벨
  const svg = page.getByTestId('tide-svg');
  for (const t of ['육지', '갯벌', '바다', '바닷물 높이', '오전 2시']) await expect(svg.getByText(t, { exact: true })).toBeVisible();
  // 활동 1로 돌아가면 증발 실험이 그대로 있다
  await page.getByRole('tab', { name: /^활동 1 · / }).click();
  await expect(page.getByRole('group', { name: '물의 종류' })).toBeVisible();
});

test('밀물과 썰물: 시각을 2시 → 8시로 옮기면 바닷물 선이 내려가고 갯벌이 드러나며, 기록 전에는 "밀물"·"썰물" 글자가 없다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea', { experiment: 'tide' });
  await tidePredict(page, '한 번');
  await expect(timeSlider(page)).toBeEnabled();
  // 화면이 스크롤되어도 같도록 그림 위쪽에서 잰 높이로 비교한다.
  const waterTop = async () => (await tideWater(page).boundingBox())!.y - (await page.getByTestId('tide-svg').boundingBox())!.y;
  const a = { y: await waterTop(), h: await num(tideWater(page), 'data-height') };
  expect(a.h).toBeCloseTo(3.5, 1);
  await expect(tideWater(page)).toHaveAttribute('data-exposed', 'false');
  await expect(page.getByTestId('tide-life')).toHaveCount(0);
  await setHour(page, 8);
  await expect(timeSlider(page)).toHaveAttribute('aria-valuetext', '오전 8시');
  const b = { y: await waterTop(), h: await num(tideWater(page), 'data-height') };
  expect(b.h).toBeCloseTo(-3.5, 1);
  expect(b.y).toBeGreaterThan(a.y + 40);
  await expect(tideWater(page)).toHaveAttribute('data-exposed', 'true');
  await expect(page.getByTestId('tide-life')).toHaveCount(4);
  await expect(page.getByTestId('tide-caption')).toContainText('바닷물 높이 −3.5 m');
  await expect(page.getByTestId('tide-caption')).toContainText('갯벌이 물 밖에 나와 있어요');
  // 하루 그래프: 2시부터 8시까지 30분마다 점이 남는다(13개)
  await expect(page.getByTestId('tide-graph-dot')).toHaveCount(13);
  // 기록 전에는 그림과 본문 어디에도 "밀물"·"썰물"이 없다(글자, 그림 안 글자, aria-label). 활동 탭 이름(활동 제목)은 본문 밖이다.
  await expect(page.getByTestId('tide-state-name')).toHaveCount(0);
  const body = await page.locator('main').innerText();
  const aria = await page.locator('svg[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join(' '));
  for (const n of ['밀물', '썰물']) {
    expect(body, n).not.toContain(n);
    expect(aria, n).not.toContain(n);
  }
  // 틀리게 기록해도 이름은 나오지 않는다
  await tideRecord(page, '한 번');
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await expect(page.getByTestId('tide-state-name')).toHaveCount(0);
  // 과제를 바꾸면 하루 그래프의 점을 지운다
  await pickTask(page, '바닷물이 가장 빠졌을 때');
  await expect(page.getByTestId('tide-graph-dot')).toHaveCount(1);
});

test('tide-count: "두 번"을 기록하면 맞음 문장과 "지금은: …" 이름이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea', { experiment: 'tide' });
  await tidePredict(page, '네 번');
  await setHour(page, 8);
  await tideRecord(page, '두 번');
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(page.getByTestId('tide-state-name')).toHaveText('지금은: 썰물(바닷물이 빠져나가는 중)');
  await setHour(page, 11);
  await expect(page.getByTestId('tide-state-name')).toHaveText('지금은: 밀물(바닷물이 들어오는 중)');
  await expect(region(page, '과제 목록').getByRole('button', { name: /^바닷물이 높이 들어오는 때/ })).toContainText('✓ 완료');
});

test('tide-flat: "넓은 갯벌"을 기록하면 맞음 문장이 나오고, 갯벌의 가치를 묻는 생각 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea', { experiment: 'tide' });
  await pickTask(page, '바닷물이 가장 빠졌을 때');
  await tidePredict(page, '넓은 갯벌');
  await setHour(page, 20.5);
  await expect(tideWater(page)).toHaveAttribute('data-exposed', 'true');
  await tideRecord(page, '넓은 갯벌');
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(tutorBox(page)).toContainText('물이 빠진 갯벌에서는 어떤 생물을 볼 수 있을까요? 갯벌이 사라지면 그 생물들은 어떻게 될까요?');
  await expect(page.getByTestId('tide-state-name')).toBeVisible();
});

test('밀물과 썰물: 한계 용어(조석·만조·간조·조차·기조력·인력·반일주조)와 정답 문장이 화면에 없다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea', { experiment: 'tide' });
  await tidePredict(page, '한 번');
  await setHour(page, 8);
  const text = await page.locator('main').innerText();
  for (const t of ['조석', '만조', '간조', '조차', '기조력', '인력', '반일주조', '하루에 두 번', '하루 두 번', '갯벌이 드러나']) expect(text, t).not.toContain(t);
});

test('밀물과 썰물: 390 px 화면에도 가로 스크롤이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoUnit(page, 'g3-earth-sea', { experiment: 'tide' });
  await tidePredict(page, '한 번');
  await setHour(page, 8);
  await tideRecord(page, '두 번');
  const { sw, iw } = await scrollWidth(page);
  expect(sw).toBeLessThanOrEqual(iw);
  const box = (await page.getByTestId('tide-svg').boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
});

test('활동 1(바닷물과 강물 비교하기): 알코올램프는 접시 바로 아래 가운데에 있고 삼발이가 받치며, 불꽃은 가열하는 동안에만 있다', async ({ page }) => {
  await gotoUnit(page, 'g3-earth-sea', { playback: 8 });
  const box = async (id: string) => (await macro(page).getByTestId(id).boundingBox())!;
  const dish = await box('dish-art');
  const lamp = await box('lamp-body');
  expect(Math.abs(lamp.x + lamp.width / 2 - (dish.x + dish.width / 2))).toBeLessThanOrEqual(4);
  expect(lamp.y).toBeGreaterThan(dish.y + dish.height * 0.5);
  await expect(macro(page).getByTestId('lamp-stand')).toHaveCount(1);
  await expect(macro(page).getByTestId('flame')).toHaveCount(0);
  await selectIV(page, WATER);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(macro(page).getByTestId('flame')).toHaveCount(1);
  const flame = await box('flame');
  expect(flame.y + flame.height).toBeLessThanOrEqual(lamp.y + 4);
  await expect(runButton(page)).toHaveText('▶ 실험 실행', { timeout: 20_000 });
  await expect(macro(page).getByTestId('flame')).toHaveCount(0);
  await expect(macro(page).getByTestId('lamp-stand')).toHaveCount(1);
});

test.describe('밀물과 썰물 SVG 글자(겹침 없음)', () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    test(`${vp.width} px: 바닷가 보기와 하루 그래프의 모든 시각에서 글자는 13 px 이상이고 서로 겹치지 않는다`, async ({ page }) => {
      await page.setViewportSize(vp);
      await gotoUnit(page, 'g3-earth-sea', { experiment: 'tide' });
      await tidePredict(page, '한 번');
      for (let h = 0; h <= 24; h += 0.5) {
        await setHour(page, h);
        const found = await page.evaluate(() => {
          const out: string[] = [];
          for (const id of ['tide-svg', 'tide-graph-svg']) {
            const svg = document.querySelector(`[data-testid="${id}"]`)!;
            const frame = svg.getBoundingClientRect();
            const items = [...svg.querySelectorAll('text')].map((t) => {
              const m = (t as SVGGraphicsElement).getScreenCTM()!;
              return { text: (t.textContent ?? '').trim(), px: parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b), box: t.getBoundingClientRect() };
            });
            for (const a of items) {
              if (a.px < 12.95) out.push(`${id} "${a.text}" ${a.px.toFixed(1)}px`);
              if (a.box.left < frame.left - 1 || a.box.right > frame.right + 1 || a.box.top < frame.top - 1 || a.box.bottom > frame.bottom + 1) out.push(`${id} "${a.text}" 잘림`);
            }
            for (let i = 0; i < items.length; i++) {
              for (let j = i + 1; j < items.length; j++) {
                const p = items[i]!.box;
                const q = items[j]!.box;
                // 글자 상자의 위아래 여백(글자 높이의 20%)은 봐준다.
                const pad = 0.2 * Math.min(p.height, q.height);
                if (p.left < q.right && q.left < p.right && p.top + pad < q.bottom - pad && q.top + pad < p.bottom - pad) out.push(`${id} "${items[i]!.text}" 와 "${items[j]!.text}" 겹침`);
              }
            }
          }
          return out;
        });
        expect([...new Set(found)], `${h}시`).toEqual([]);
      }
    });
  }
});
