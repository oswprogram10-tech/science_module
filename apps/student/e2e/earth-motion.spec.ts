import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, scrollWidth } from './helpers';

const ID = 'g6-earth-motion';
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const slider = (page: Page, name: '시각' | '달' | '음력 날짜') => page.getByRole('slider', { name, exact: true });
const groundCaption = (page: Page) => page.getByTestId('ground-caption');
const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const feedbackBox = (page: Page) => page.getByRole('heading', { name: '피드백' }).locator('..');

async function pickTask(page: Page, title: string) {
  await region(page, '과제 목록').getByRole('button', { name: new RegExp(`^${title}`) }).click();
  await expect(region(page, '과제 목록').getByRole('button', { name: new RegExp(`^${title}`) })).toHaveAttribute('aria-current', 'true');
}
const predict = (page: Page, label: string) => region(page, '예측').getByRole('button', { name: label, exact: true }).click();
const recordBtn = (page: Page, label: string) => region(page, '관찰 기록').getByRole('button', { name: label, exact: true });
const toggle = (page: Page, label: RegExp) => region(page, '관찰하기').getByRole('button', { name: label });

/** range 입력의 값을 바꾼다(React가 change를 받도록 입력 이벤트를 일으킨다). */
async function setSlider(input: Locator, value: number) {
  await input.fill(String(value));
}

test.beforeEach(async ({ page }) => {
  await gotoUnit(page, ID);
});

test('단원 화면: 제목, 과제 7개(달 모양 과제 둘은 맨 뒤), 두 시점 화면', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: '지구의 운동' })).toBeVisible();
  const tasks = region(page, '과제 목록').getByRole('button');
  await expect(tasks).toHaveCount(7);
  await expect(tasks.nth(0)).toContainText('하루 동안 태양의 움직임');
  await expect(tasks.nth(4)).toContainText('겨울철 대표 별자리');
  await expect(tasks.nth(5)).toContainText('저녁 달의 모양과 위치');
  await expect(tasks.nth(6)).toContainText('보름달이 뜨는 날');
  await expect(page.getByRole('figure', { name: '땅에서 보기' })).toBeVisible();
  await expect(page.getByRole('figure', { name: '우주에서 보기' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^땅에서 보기: 오후 12시, 태양은 남쪽 하늘$/ })).toBeVisible();
});

test('태양 과제: 예측 전에는 조작과 기록이 꺼져 있다', async ({ page }) => {
  await expect(slider(page, '시각')).toBeDisabled();
  await expect(page.getByRole('button', { name: '▶ 재생' })).toBeDisabled();
  await expect(toggle(page, /만약에/)).toBeDisabled();
  await expect(page.getByText('예측을 먼저 골라 주세요.')).toBeVisible();
  await expect(recordBtn(page, '동쪽에서 서쪽으로')).toBeDisabled();
  await expect(tutorBox(page)).toContainText('아침에 해가 뜨는 쪽을 떠올려 볼까요?');
  await predict(page, '동쪽에서 서쪽으로');
  await expect(slider(page, '시각')).toBeEnabled();
  await expect(page.getByText('예측을 먼저 골라 주세요.')).toBeHidden();
  // 아직 조작하지 않았으니 기록은 꺼져 있다.
  await expect(recordBtn(page, '동쪽에서 서쪽으로')).toBeDisabled();
  await expect(tutorBox(page)).toContainText('시각을 바꾸면서 우주에서 보기 화면의');
});

test('태양 과제: 9시 → 15시에 문구가 동쪽 → 서쪽, 기록하면 맞게 기록했다고 알려 준다', async ({ page }) => {
  await predict(page, '동쪽에서 서쪽으로');
  await setSlider(slider(page, '시각'), 9);
  await expect(groundCaption(page)).toHaveText('오전 9시 · 태양이 동쪽 하늘에 있어요');
  await expect(page.getByRole('img', { name: '땅에서 보기: 오전 9시, 태양은 동쪽 하늘' })).toBeVisible();
  await setSlider(slider(page, '시각'), 15);
  await expect(groundCaption(page)).toHaveText('오후 3시 · 태양이 서쪽 하늘에 있어요');
  await expect(groundCaption(page)).toContainText('서쪽');

  await expect(recordBtn(page, '동쪽에서 서쪽으로')).toBeEnabled();
  await recordBtn(page, '동쪽에서 서쪽으로').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(page.getByTestId('compare')).toHaveText('예측: 동쪽에서 서쪽으로 / 관찰: 동쪽에서 서쪽으로');
  await expect(tutorBox(page)).toContainText("자전 방향을 '만약에'로 바꾸면");
  await expect(region(page, '과제 목록').getByRole('button', { name: /^하루 동안 태양의 움직임/ })).toContainText('✓ 완료');
  // 정답 판정 문구는 없다.
  await expect(page.locator('body')).not.toContainText(/틀렸|정답/);
});

test('태양 과제: 자전 방향을 "만약에"로 바꾸고 같은 기록을 다시 하면 다시 살펴보라는 질문이 나온다', async ({ page }) => {
  await predict(page, '동쪽에서 서쪽으로');
  await setSlider(slider(page, '시각'), 9);
  await recordBtn(page, '동쪽에서 서쪽으로').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');

  await toggle(page, /동쪽에서 서쪽으로 \(만약에\)/).click();
  await expect(toggle(page, /\(만약에\)/)).toHaveAttribute('aria-pressed', 'true');
  await expect(groundCaption(page)).toHaveText('오전 9시 · 태양이 서쪽 하늘에 있어요');
  // 다시 기록하기 전에는 앞의 기록이 그대로다.
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await recordBtn(page, '동쪽에서 서쪽으로').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await expect(tutorBox(page)).toContainText('아침과 저녁의 태양 위치를 다시 비교해 볼까요?');
  await recordBtn(page, '서쪽에서 동쪽으로').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(tutorBox(page)).toContainText('예측과 관찰이 달랐네요.');
});

test('시각 슬라이더는 키보드로 조작하고 aria-valuetext가 바뀐다', async ({ page }) => {
  await predict(page, '움직이지 않아요');
  const s = slider(page, '시각');
  await expect(s).toHaveAttribute('aria-valuetext', '오후 12시');
  await s.focus();
  await s.press('ArrowRight');
  await expect(s).toHaveAttribute('aria-valuetext', '오후 12시 30분');
  await s.press('ArrowLeft');
  await s.press('ArrowLeft');
  await expect(s).toHaveAttribute('aria-valuetext', '오전 11시 30분');
  await s.press('Home');
  await expect(s).toHaveAttribute('aria-valuetext', '오전 12시');
  await s.press('End');
  await expect(s).toHaveAttribute('aria-valuetext', '오전 12시');
  await expect(s).toHaveValue('24');
  await expect(recordBtn(page, '움직이지 않아요')).toBeEnabled();
});

test('우주에서 보기: 우리나라 표시가 시각에 따라 낮 쪽과 밤 쪽으로 돈다', async ({ page }) => {
  await predict(page, '동쪽에서 서쪽으로');
  const seoul = page.getByTestId('seoul-marker');
  await expect(seoul).toHaveAttribute('data-day', 'true');
  await setSlider(slider(page, '시각'), 0);
  await expect(seoul).toHaveAttribute('data-day', 'false');
  await expect(page.getByTestId('space-caption')).toContainText('북극 위에서 본 모습');
  // 자전 방향 화살표는 조건에 따라 바뀐다.
  await expect(page.getByTestId('rotation-arrow')).toHaveAttribute('data-direction', 'forward');
  await toggle(page, /\(만약에\)/).click();
  await expect(page.getByTestId('rotation-arrow')).toHaveAttribute('data-direction', 'reverse');
});

test('태양 자리 점선은 지나온 시각을 남기고 과제를 바꾸면 지운다', async ({ page }) => {
  await predict(page, '동쪽에서 서쪽으로');
  const dots = page.getByTestId('sun-trail').locator('circle');
  await expect(dots).toHaveCount(1);
  await setSlider(slider(page, '시각'), 9);
  await setSlider(slider(page, '시각'), 15);
  await expect(dots).toHaveCount(3);
  await pickTask(page, '낮과 밤');
  await expect(page.getByTestId('sun-trail').locator('circle')).toHaveCount(1);
});

test('재생: 하루를 돌려 24시에서 멈추고, 눌러 멈출 수도 있다', async ({ page }) => {
  await predict(page, '동쪽에서 서쪽으로');
  await page.getByRole('button', { name: '▶ 재생' }).click();
  await expect(slider(page, '시각')).toHaveValue('24');
  await expect(page.getByRole('button', { name: '▶ 재생' })).toBeVisible();
  await expect(recordBtn(page, '동쪽에서 서쪽으로')).toBeEnabled();
  // 24시에서 다시 누르면 0시부터 시작한다.
  await gotoUnit(page, ID, { playback: 8 });
  await predict(page, '동쪽에서 서쪽으로');
  await page.getByRole('button', { name: '▶ 재생' }).click();
  await page.getByRole('button', { name: '⏸ 멈추기' }).click();
  const stopped = await slider(page, '시각').inputValue();
  await page.waitForTimeout(300);
  await expect(slider(page, '시각')).toHaveValue(stopped);
});

test('재생 중에 단원 목록으로 나가도 오류가 없다(재생이 취소된다)', async ({ page }) => {
  await gotoUnit(page, ID, { playback: 8 });
  await predict(page, '동쪽에서 서쪽으로');
  await page.getByRole('button', { name: '▶ 재생' }).click();
  await expect(page.getByRole('button', { name: '⏸ 멈추기' })).toBeVisible();
  await page.getByRole('link', { name: '← 단원 목록' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  await page.waitForTimeout(400);
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('재생 버튼이 없고 슬라이더로만 조작한다', async ({ page }) => {
    await gotoUnit(page, ID);
    await predict(page, '동쪽에서 서쪽으로');
    await expect(page.getByRole('button', { name: /재생/ })).toHaveCount(0);
    await setSlider(slider(page, '시각'), 9);
    await expect(groundCaption(page)).toContainText('동쪽');
  });
});

test('낮과 밤 과제: 반대편 표시가 있고 "밤이에요"를 기록하면 맞게 기록했다고 알려 준다', async ({ page }) => {
  await pickTask(page, '낮과 밤');
  await expect(page.getByTestId('antipode-marker')).toBeVisible();
  await expect(page.getByTestId('antipode-marker')).toContainText('지구 반대편');
  await expect(page.getByTestId('seoul-marker')).toContainText('우리나라');
  await expect(page.getByRole('figure', { name: '우주에서 보기' }).getByText('낮', { exact: true })).toBeVisible();
  await expect(page.getByRole('figure', { name: '우주에서 보기' }).getByText('밤', { exact: true })).toBeVisible();
  await predict(page, '낮이에요');
  await setSlider(slider(page, '시각'), 13);
  await recordBtn(page, '밤이에요').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(page.getByTestId('compare')).toHaveText('예측: 낮이에요 / 관찰: 밤이에요');
  await expect(tutorBox(page)).toContainText('예측과 관찰이 달랐네요.');
  await recordBtn(page, '낮이에요').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
});

test('별 과제: 밤 9시 오리온자리에서 시작하고 자전 방향에 따라 모델 결과가 달라진다', async ({ page }) => {
  await pickTask(page, '밤하늘 별의 움직임');
  await expect(slider(page, '시각')).toHaveValue('21');
  await expect(groundCaption(page)).toHaveText('오후 9시 · 남쪽 하늘: 오리온자리');
  await expect(page.getByTestId('constellation-orion')).toContainText('오리온자리');
  await predict(page, '동쪽에서 서쪽으로');
  await setSlider(slider(page, '시각'), 24);
  await expect(groundCaption(page)).toHaveText('오전 12시 · 남쪽 하늘: 오리온자리');
  await recordBtn(page, '동쪽에서 서쪽으로').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(tutorBox(page)).toContainText('태양과 별이 움직여 보이는 방향을 비교하면');
  await toggle(page, /\(만약에\)/).click();
  await recordBtn(page, '동쪽에서 서쪽으로').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await expect(tutorBox(page)).toContainText('밤 9시와 자정의 별자리 위치를');
});

test('계절 별자리 과제: 달 슬라이더 1월 → 오리온자리, 4월 → 사자자리', async ({ page }) => {
  await pickTask(page, '계절에 따라 보이는 별자리');
  await expect(slider(page, '달')).toBeDisabled();
  await predict(page, '계절이 바뀌어도 같아요');
  await expect(page.getByText('시각은 밤 9시로 맞춰져 있어요.')).toBeVisible();
  const caption = groundCaption(page);
  await setSlider(slider(page, '달'), 1);
  await expect(slider(page, '달')).toHaveAttribute('aria-valuetext', '1월');
  await expect(caption).toHaveText('밤 9시 · 남쪽 하늘: 오리온자리');
  await expect(page.getByTestId('earth-marker')).toHaveAttribute('data-month', '1');
  await setSlider(slider(page, '달'), 4);
  await expect(caption).toHaveText('밤 9시 · 남쪽 하늘: 사자자리');
  await setSlider(slider(page, '달'), 8);
  await expect(caption).toContainText('백조자리');
  await setSlider(slider(page, '달'), 10);
  await expect(caption).toContainText('페가수스자리');
  // 달 슬라이더도 키보드로 움직인다.
  await slider(page, '달').focus();
  await slider(page, '달').press('ArrowLeft');
  await expect(slider(page, '달')).toHaveAttribute('aria-valuetext', '9월');
  await recordBtn(page, '계절마다 달라져요').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(tutorBox(page)).toContainText('예측과 관찰이 달랐네요.');
  await recordBtn(page, '계절이 바뀌어도 같아요').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
});

test('겨울 별자리 과제: 1월로 맞춰 오리온자리를 기록한다', async ({ page }) => {
  await pickTask(page, '겨울철 대표 별자리');
  await predict(page, '오리온자리');
  await setSlider(slider(page, '달'), 1);
  await expect(groundCaption(page)).toContainText('오리온자리');
  await recordBtn(page, '오리온자리').click();
  await expect(feedbackBox(page)).toContainText('관찰한 내용을 잘 기록했어요.');
  await expect(tutorBox(page)).toContainText('다른 계절에는 어떤 별자리가');
  await recordBtn(page, '사자자리').click();
  await expect(feedbackBox(page)).toContainText('관찰 화면을 다시 살펴볼까요?');
  await expect(tutorBox(page)).toContainText('달이 1월로 맞춰져 있는지');
});

test('밤 하늘에는 별자리 이름이 있고 낮 하늘에는 없다', async ({ page }) => {
  await pickTask(page, '계절에 따라 보이는 별자리');
  await predict(page, '계절이 바뀌어도 같아요');
  await setSlider(slider(page, '달'), 1);
  const ground = page.getByRole('figure', { name: '땅에서 보기' });
  await expect(ground.getByText('오리온자리', { exact: true })).toBeVisible();
  await pickTask(page, '하루 동안 태양의 움직임');
  await expect(page.getByTestId('constellation-orion')).toHaveCount(0);
});

test.describe('1280x800 화면', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  /** SVG 안 모든 글자의 화면 글자 크기(px) = font-size × (화면 폭 / viewBox 폭). */
  async function renderedFontSizes(svg: Locator) {
    return svg.evaluate((el) => {
      const s = el as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll('text')].map((t) => ({
        text: (t.textContent ?? '').trim(),
        px: parseFloat(getComputedStyle(t).fontSize) * scale,
      }));
    });
  }

  async function expectBigText(page: Page, label: string) {
    for (const name of ['땅에서 보기', '우주에서 보기']) {
      const sizes = await renderedFontSizes(page.getByRole('figure', { name }).locator('svg'));
      expect(sizes.length, `${label} ${name}`).toBeGreaterThan(0);
      for (const { text, px } of sizes) expect(px, `${label} ${name}: "${text}"`).toBeGreaterThanOrEqual(13);
    }
  }

  test('두 그림의 글자는 모든 과제의 낮·밤 상태에서 화면 13 px 이상이다', async ({ page }) => {
    await gotoUnit(page, ID);
    await predict(page, '동쪽에서 서쪽으로');
    await expectBigText(page, '태양 정오');
    await setSlider(slider(page, '시각'), 22);
    await expectBigText(page, '태양 밤');
    await pickTask(page, '낮과 밤');
    await expectBigText(page, '낮과 밤');
    await pickTask(page, '밤하늘 별의 움직임');
    await expectBigText(page, '별');
    await pickTask(page, '계절에 따라 보이는 별자리');
    await expectBigText(page, '계절');
    await predict(page, '계절이 바뀌어도 같아요');
    for (const m of [1, 4, 8, 10]) {
      await setSlider(slider(page, '달'), m);
      await expectBigText(page, `${m}월`);
    }
  });
});

// ---- 달 모양 과제 ----
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
  await expect(slider(page, '음력 날짜')).toBeDisabled();
  await predict(page, '점점 차오르고 동쪽으로 옮겨 가요');
  const input = slider(page, '음력 날짜');
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
  await setSlider(slider(page, '음력 날짜'), 18);
  await expect(page.getByTestId('moon-hidden-note')).toHaveText('이 시각에는 달이 보이지 않아요');
  await expect(moonGround(page)).toHaveCount(0);
  await expect(page.getByTestId('moon-ground-caption')).toContainText('보이지 않아요');
  await setSlider(slider(page, '음력 날짜'), 8);
  await expect(page.getByTestId('moon-hidden-note')).toHaveCount(0);
  await expect(moonGround(page)).toHaveCount(1);
});

test('달 모양 과제: 슬라이더는 키보드로 조작하고, 우주에서 보기 달은 날짜 따라 돌며 태양 쪽이 밝다', async ({ page }) => {
  await pickTask(page, '저녁 달의 모양과 위치');
  await predict(page, '모양과 위치가 그대로예요');
  const input = slider(page, '음력 날짜');
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
  await setSlider(slider(page, '음력 날짜'), 15);
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
      await setSlider(slider(page, '음력 날짜'), d);
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
