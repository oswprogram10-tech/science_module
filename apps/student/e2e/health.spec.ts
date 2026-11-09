import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, selectIV, predict, runButton, resultRows } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기: 교실' });
const contact = (page: Page) => page.getByRole('figure', { name: '옮겨 가는 길 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

/** 변인 값을 고른다. '씀'이 '안 씀'에도 들어 있어 글자가 정확히 같은 버튼만 고른다. */
async function setValue(page: Page, group: string, option: string) {
  await page.getByRole('group', { name: group, exact: true }).getByRole('button', { name: option, exact: true }).click();
}

const WASH = '손 씻기';
const MASK = '마스크';
const CONTACTS = '하루에 가까이 만나는 친구 수';
const SEAT = '처음 아픈 친구의 자리';
const DISCLAIMER = '이 숫자는 공부를 위해 만든 가상 반의 계산이에요. 실제 병의 예측이 아니에요.';
// 매니페스트 tutor.forbiddenAnswers 중 화면 글에 나올 법한 구절(매니페스트와 같은 목록)
const FORBIDDEN = ["손을 자주 씻으면 덜 퍼", "마스크를 쓰면 덜 퍼", "만나는 사람이 많을수록 많이 퍼", "자리는 관계없", "함께 지키면 효과가 더 커", "손을 자주 씻으면 적게", "손을 자주 씻으면 덜", "손을 자주 씻으면 줄", "손을 자주 씻으면 감염이 줄", "손을 씻으면 덜", "손을 씻으면 적게", "손을 씻으면 줄", "손 씻기를 하면 덜", "손 씻기를 하면 적게", "손 씻기를 자주 하면 덜", "손 씻기를 자주 하면 적게", "손 씻기를 자주 하면 줄", "손 씻기는 퍼지는 것을 줄", "손 씻기가 퍼지는 것을 줄", "자주 씻으면 덜 퍼", "자주 씻으면 적게 퍼", "마스크를 쓰면 적게", "마스크를 쓰면 덜", "마스크를 쓰면 줄", "마스크를 쓰면 감염이 줄", "마스크를 쓰면 훨씬", "마스크를 쓰면 잘 안 퍼", "마스크를 쓰면 안 퍼", "마스크를 쓰는 것이 퍼지는 것을 줄", "마스크는 퍼지는 것을 줄", "마스크가 퍼지는 것을 줄", "만나는 사람이 많을수록 빨리", "만나는 사람이 많을수록 더 많이", "만나는 사람이 많을수록 더 빨리", "만나는 사람이 많으면 많이", "만나는 사람이 많으면 빨리", "만나는 친구가 많을수록 많이", "만나는 친구가 많을수록 빨리", "만나는 친구가 많으면 많이", "만나는 친구가 많으면 빨리", "만나는 친구 수가 많을수록 많이", "만나는 친구 수가 많을수록 빨리", "많이 만날수록 많이 퍼", "많이 만날수록 빨리 퍼", "많이 만나면 많이 퍼", "많이 만나면 빨리 퍼", "친구를 많이 만날수록", "친구를 많이 만나면 많이", "사람을 많이 만날수록", "사람을 많이 만나면 많이", "자리는 상관없", "자리는 영향이 없", "자리는 결과에 영향", "자리와 관계없이", "자리와 상관없이", "자리가 달라도 같", "자리는 결과를 바꾸지 않", "자리는 달라지지 않", "자리에 따라 달라지지 않", "자리는 중요하지 않", "함께 지키면 더 효과", "함께 지키면 효과가 더", "함께 지키면 더 크", "함께 지키면 더 많이 줄", "함께 지키면 더 적게", "함께 지키면 훨씬", "여러 습관을 함께 지키면", "여러 습관을 같이 지키면", "같이 지키면 효과가 더", "같이 지키면 더 효과", "둘 다 지키면 효과가 더", "둘 다 지키면 더 효과", "함께 하면 효과가 더", "함께 하면 더 효과", "습관을 더하면 효과가 더"];
const TERMS = ['기초 감염 재생산수', '잠복기', '치명률', '집단 면역', '백신 효능'];

async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 안전 점검표가 없는 단원이라 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await finishRun(page);
}

async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 감염된 사람·가장 많이 아픈 사람: 네 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 6);
}

const seats = (page: Page) => macro(page).getByTestId('seat');
const stateCount = (page: Page, state: string) => macro(page).locator(`[data-testid=seat][data-state=${state}]`).count();

test('기준(잘 안 씻음, 안 씀, 4명, 앞줄)이면 12가 보이고 안내 문구·범례·센서 없음·쓰지 않는 말 없음', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  await expect(page.getByRole('heading', { level: 1, name: '감염병과 건강한 생활' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 손 씻기와 마스크, 만나는 사람 수는 감염병이 퍼지는 데 어떤 영향을 줄까?')).toBeVisible();
  await expect(page.getByText('예측: 20일 동안 감염된 사람 수는?')).toBeVisible();
  // 안내 문구는 실행 전에도 보인다
  await expect(macro(page).getByText(DISCLAIMER)).toBeVisible();
  await expect(page.getByText('실제 병의 예측이 아니에요')).toBeVisible();
  // 센서 막대와 안전 점검표가 없다
  await expect(page.getByRole('group', { name: '센서' })).toHaveCount(0);
  await expect(page.getByText('모의 센서')).toHaveCount(0);
  // 실행 전에는 처음 상태(아픈 친구 1명)만 보인다
  await expect(seats(page)).toHaveCount(30);
  expect(await stateCount(page, 'sick')).toBe(1);
  expect(await stateCount(page, 'recovered')).toBe(0);
  await expect(macro(page).getByTestId('spread-note')).toHaveText('0일째 · 지금 아픈 사람 1명 · 지금까지 감염 1명');
  await expect(page.locator('#results-table')).toContainText('아직 실험한 결과가 없어요.');

  await selectIV(page, WASH);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await finishRun(page);
  expect(await resultCells(resultRows(page).first())).toEqual(['12', '3']);
  for (const h of ['20일 동안 감염된 사람(명)', '가장 많이 아팠던 날의 아픈 사람(명)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByTestId('spread-note')).toHaveText('20일째 · 지금 아픈 사람 3명 · 지금까지 감염 12명');
  await expect(macro(page).getByTestId('disclaimer')).toHaveText(DISCLAIMER);
  expect(await stateCount(page, 'healthy')).toBe(18);
  expect(await stateCount(page, 'sick')).toBe(3);
  expect(await stateCount(page, 'recovered')).toBe(9);
  const main = await page.locator('main').innerText();
  for (const term of TERMS) expect(main).not.toContain(term);
  // 이름이나 얼굴이 없다
  await expect(macro(page).locator('image, img')).toHaveCount(0);
});

test('마스크를 쓰면 3이 되고 결과: 줄어들었다, 손 씻기 전용 질문 대신 공통 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  await baselineRun(page, MASK);
  await setValue(page, MASK, '씀');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['3', '1']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('마스크만 바꾸었을 때 그래프의 두 선은 어떻게 달라졌나요? 가장 높은 곳이 언제였는지도 볼까요?');
  await expect(macro(page).getByTestId('spread-note')).toHaveText('20일째 · 지금 아픈 사람 0명 · 지금까지 감염 3명');
});

test('새 페이지에서 만나는 친구를 8명으로 바꾸면 28, 결과: 늘어났다, 만남 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  await baselineRun(page, CONTACTS);
  await setValue(page, CONTACTS, '8명');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['28', '10']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('만나는 친구 수만 바꾸었어요. 교실 그림에서 아픈 친구가 늘어나는 빠르기는 어땠나요?');
  expect(await stateCount(page, 'healthy')).toBe(2);
  // 선 개수가 8개로 바뀐다
  await expect(contact(page).getByTestId('contact-line')).toHaveCount(8);
});

test('새 페이지에서 자리만 바꾸면 결과: 변하지 않았다, 자리 전용 질문이 나오고 처음 아픈 자리만 달라진다', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  await selectIV(page, SEAT);
  const sickIndex = async () => seats(page).evaluateAll((els) => els.findIndex((e) => e.getAttribute('data-state') === 'sick'));
  const before = await sickIndex();
  await setValue(page, SEAT, '뒷줄');
  const after = await sickIndex();
  expect(Math.floor(before / 6)).toBe(0);
  expect(Math.floor(after / 6)).toBe(4);
  await setValue(page, SEAT, '앞줄');
  await run(page, '변하지 않는다');
  await setValue(page, SEAT, '뒷줄');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(resultRows(page).first())).toEqual(['12', '3']);
  expect(await resultCells(row2)).toEqual(['12', '3']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('처음 아픈 친구의 자리만 바꾸었을 때 결과가 달라졌나요? 이 계산이 자리를 어떻게 다루는지 생각해 볼까요?');
});

test('교실 그림 범례는 색 외의 무늬를 가진다: 건강 빈 원, 아픔 채운 원 + 점, 나음 원 + 체크', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  for (const [state, label] of [['healthy', '건강'], ['sick', '아픔'], ['recovered', '나음']] as const) {
    const item = macro(page).getByTestId(`legend-${state}`);
    await expect(item).toBeVisible();
    await expect(item).toContainText(label);
    await expect(item.getByTestId('pattern-dot')).toHaveCount(state === 'sick' ? 1 : 0);
    await expect(item.getByTestId('pattern-check')).toHaveCount(state === 'recovered' ? 1 : 0);
  }
  // 건강한 사람의 아이콘은 속이 비어 있다
  await expect(macro(page).getByTestId('legend-healthy').locator('circle')).toHaveCSS('fill', 'none');
  // 시행 뒤에는 나은 사람 자리에 체크가 그려진다
  await baselineRun(page, WASH);
  await expect(macro(page).locator('[data-testid=seat][data-state=recovered] [data-testid=pattern-check]')).toHaveCount(9);
});

test('옮겨 가는 길 보기: 선 개수, 방패, 라벨, 문구; 첫 시행 전에는 굵기 차이가 없다', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  await expect(contact(page).getByTestId('contact-line')).toHaveCount(4);
  for (const label of ['만남', '손 씻기', '마스크']) await expect(contact(page).getByText(label, { exact: true })).toBeVisible();
  await expect(contact(page).getByText('만날 때마다 병이 옮을 수 있는 기회가 생겨요.')).toBeVisible();
  await expect(contact(page).getByTestId('shield-wash')).toHaveCount(0);
  await expect(contact(page).getByTestId('shield-mask')).toHaveCount(0);
  await setValue(page, WASH, '자주 씻음');
  await setValue(page, MASK, '씀');
  await setValue(page, CONTACTS, '8명');
  await expect(contact(page).getByTestId('contact-line')).toHaveCount(8);
  await expect(contact(page).getByTestId('shield-wash')).toHaveCount(8);
  await expect(contact(page).getByTestId('shield-mask')).toHaveCount(8);
  const widths = () => contact(page).getByTestId('contact-line').evaluateAll((els) => els.map((e) => e.getAttribute('data-width')));
  // 첫 시행 전: 습관을 골라도 모두 같은 굵기
  expect(new Set(await widths()).size).toBe(1);
  const pre = (await widths())[0];
  await selectIV(page, WASH);
  await run(page, '줄어든다');
  const post = Number((await widths())[0]);
  expect(post).toBeCloseTo(50 * 0.08 * 0.6 * 0.5, 2);
  expect(String(post.toFixed(2))).not.toBe(pre);
});

test('그래프: 두 선(실선·점선), y축 0~30(5 간격), x 눈금 0~20, 라벨', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  await baselineRun(page, WASH);
  await expect(graph(page).getByText('사람 수(명)', { exact: true })).toBeVisible();
  await expect(graph(page).getByText('날짜(일)', { exact: true })).toBeVisible();
  await expect(graph(page).getByTestId('graph-series')).toHaveCount(2);
  await expect(graph(page).locator('[data-series=sick]')).not.toHaveAttribute('stroke-dasharray', /.+/);
  await expect(graph(page).locator('[data-series=total]')).toHaveAttribute('stroke-dasharray', '7 4');
  await expect(graph(page).getByTestId('graph-legend-item')).toHaveCount(2);
  await expect(graph(page).getByText('지금 아픈 사람(명)')).toBeVisible();
  await expect(graph(page).getByText('지금까지 감염된 사람(명)')).toBeVisible();
  await expect(graph(page).getByTestId('graph-marker')).toHaveCount(0);
  const xTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=middle]').allTextContents();
  expect(xTicks).toEqual(['0', '5', '10', '15', '20']);
  const yTicks = await graph(page).locator('svg > g:first-of-type text[text-anchor=end]').allTextContents();
  expect(yTicks).toEqual(['0', '5', '10', '15', '20', '25', '30']);
});

test('재생이 끝난 뒤 플레이헤드는 끝(20)에 있고, 처음으로 옮기면 0일째 그림이 된다', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  await baselineRun(page, WASH);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '20');
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('spread-note')).toHaveText('0일째 · 지금 아픈 사람 1명 · 지금까지 감염 1명');
  expect(await stateCount(page, 'healthy')).toBe(29);
  for (const day of [5, 10]) {
    await slider.press('ArrowRight');
    void day;
  }
  const n = await seats(page).count();
  expect(n).toBe(30);
});

test('쓰지 않는 말(금지 구절·한계 용어)이 화면에 없다', async ({ page }) => {
  await gotoUnit(page, 'g3-health');
  const norm = (s: string) => s.normalize('NFC').replace(/[\s\p{P}\p{S}]/gu, '');
  const check = async () => {
    const text = norm(await page.locator('main').innerText());
    for (const f of [...FORBIDDEN, ...TERMS]) expect(text, f).not.toContain(norm(f));
    expect(text).not.toMatch(/탓|잘못/);
  };
  await check();
  await baselineRun(page, WASH);
  await check();
  await setValue(page, WASH, '자주 씻음');
  await setValue(page, MASK, '씀');
  await run(page, '줄어든다');
  await check();
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

  test('교실과 옮겨 가는 길 보기의 SVG 글자는 화면에서 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, 'g3-health');
    const check = async () => {
      for (const name of ['눈으로 보기: 교실', '옮겨 가는 길 보기']) {
        const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg').first());
        expect(sizes.length).toBeGreaterThan(0);
        for (const { text, px } of sizes) expect(px, `${name}: "${text}"`).toBeGreaterThanOrEqual(13);
      }
    };
    await check();
    await baselineRun(page, WASH);
    await check();
    await setValue(page, WASH, '자주 씻음');
    await setValue(page, MASK, '씀');
    await setValue(page, CONTACTS, '8명');
    await run(page, '줄어든다');
    await check();
  });
});
