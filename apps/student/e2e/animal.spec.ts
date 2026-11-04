import {
  test,
  expect,
  gotoUnit,
  scrollWidth,
  ANIMAL_CARDS,
  sortAll,
  sortCard,
  sortCheckButton,
  sortChoose,
  sortFeedback,
  sortFinishCriterion,
  sortObserveButton,
  sortPutButton,
  sortTutor,
} from './helpers';
import type { Locator, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await gotoUnit(page, 'g3-animal');
});

const OBS_LEGS_ANT = '다리가 6개 있어요.';
const progress = (page: Page) => page.getByRole('region', { name: '진행 상황' });

test('처음 화면: 기준을 먼저 고르라고 하고 확인하기는 꺼져 있다', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: '동물의 생활' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 동물을 어떤 기준으로 분류할 수 있을까?')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: '분류 기준' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(4);
  for (const name of ['어디에서 사나요?', '다리가 있나요?', '날개가 있나요?', '귀여운가요?']) {
    await expect(page.getByRole('radio', { name, exact: true })).not.toBeChecked();
  }
  await expect(sortCheckButton(page)).toBeDisabled();
  await expect(sortTutor(page)).toContainText('동물들을 어떤 기준으로 나누어 볼까요?');
  await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
  for (const card of ANIMAL_CARDS) await expect(sortCard(page, card)).toBeVisible();
});

test('관찰 없이 8장을 넣고 확인하면 아직 살펴보지 않았다고만 하고 무리는 알려 주지 않는다', async ({ page }) => {
  await sortChoose(page, '다리가 있나요?');
  await sortAll(page, 'legs', { observe: false });
  await expect(sortCheckButton(page)).toBeEnabled();
  await sortCheckButton(page).click();
  await expect(page.getByText('아직 이 기준의 특징을 살펴보지 않았어요')).toBeVisible();
  const feedback = sortFeedback(page);
  const tutor = sortTutor(page);
  await expect(feedback).toContainText('개미, 달팽이, 지렁이, 고양이, 붕어, 게, 참새, 나비는 아직 이 기준의 특징을');
  for (const box of [feedback, tutor]) {
    await expect(box).not.toContainText('다리가 있다');
    await expect(box).not.toContainText('다리가 없다');
  }
  await expect(tutor).not.toContainText('(는)');
  await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
});

test('다리를 관찰하고 게를 "다리가 없다"에 넣으면 다시 비교하라고 하고, 옮기면 잘 맞는다', async ({ page }) => {
  await sortChoose(page, '다리가 있나요?');
  await sortAll(page, 'legs', { override: { 게: '다리가 없다' } });
  await sortCheckButton(page).click();
  await expect(page.getByText('게는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?')).toBeVisible();
  await expect(sortTutor(page)).toContainText('게에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
  // 어느 무리가 맞는지는 말하지 않는다.
  await expect(sortFeedback(page)).not.toContainText('다리가 있다');
  await expect(sortFeedback(page)).not.toContainText('다리가 없다');
  await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');

  // 게를 옮기면 확인 결과가 지워지고, 다시 확인하면 잘 맞는다.
  await sortCard(page, '게').click();
  await sortPutButton(page, '다리가 있다').click();
  await expect(page.getByText('분류를 마치고 확인하기를 누르면')).toBeVisible();
  await sortCheckButton(page).click();
  await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
  await expect(progress(page)).toContainText('끝낸 기준: 다리가 있나요? (1/2)');
  await expect(sortTutor(page)).toContainText('이번에는 다른 기준으로도 나누어 볼까요?');
});

test('"귀여운가요?"는 판정하지 않고 사람마다 다르다고만 하며 끝낸 기준 수는 늘지 않는다', async ({ page }) => {
  await sortChoose(page, '귀여운가요?');
  for (const card of ANIMAL_CARDS) {
    await sortCard(page, card).click();
    await sortPutButton(page, card === '고양이' || card === '나비' ? '귀엽다' : '귀엽지 않다').click();
  }
  await sortCheckButton(page).click();
  await expect(page.getByText('이 기준은 사람마다 다르게 나눌 수 있어요.')).toBeVisible();
  await expect(sortTutor(page)).toContainText("'귀여운가요?'로 나누면 친구와 내 결과가 같을까요?");
  await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
  await expect(page.getByText('두 가지 기준으로 분류했어요!')).toHaveCount(0);
});

test('두 가지 객관적 기준을 끝내면 마무리 문장이 나온다', async ({ page }) => {
  await sortFinishCriterion(page, 'legs');
  await expect(progress(page)).toContainText('끝낸 기준: 다리가 있나요? (1/2)');
  await expect(page.getByText('두 가지 기준으로 분류했어요!')).toHaveCount(0);
  await sortFinishCriterion(page, 'habitat');
  await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
  await expect(progress(page)).toContainText('끝낸 기준: 다리가 있나요?, 어디에서 사나요? (2/2)');
  await expect(page.getByText('두 가지 기준으로 분류했어요!')).toBeVisible();
  await expect(sortTutor(page)).toContainText('같은 동물이 기준에 따라 다른 무리에 들어간 것을 찾아볼까요?');
});

test('기준을 바꾸면 무리 칸이 비고 카드가 더미로 돌아오며 관찰 기록은 남는다', async ({ page }) => {
  await sortChoose(page, '다리가 있나요?');
  await sortCard(page, '개미').click();
  await sortObserveButton(page, '다리').click();
  await sortPutButton(page, '다리가 있다').click();
  const bin = page.getByRole('group', { name: '다리가 있다' });
  await expect(bin.getByRole('button', { name: /^개미 관찰 1\/3$/ })).toBeVisible();

  await sortChoose(page, '어디에서 사나요?');
  await expect(page.getByText('기준을 바꾸어서 카드를 다시 나눠요.')).toBeVisible();
  for (const name of ['땅에서 사는 동물', '물에서 사는 동물', '날아다니는 동물']) {
    const g = page.getByRole('group', { name });
    await expect(g).toBeVisible();
    await expect(g.getByRole('listitem')).toHaveCount(0);
  }
  await expect(page.getByRole('group', { name: '다리가 있다' })).toHaveCount(0);
  // 개미는 더미로 돌아왔고 관찰 1/3과 기록이 남아 있다.
  await sortCard(page, '개미').click();
  await expect(sortCard(page, '개미')).toHaveText(/관찰 1\/3/);
  await expect(page.getByRole('list', { name: '개미 관찰 기록' })).toContainText(OBS_LEGS_ANT);
  await expect(sortCheckButton(page)).toBeDisabled();
});

test('아직 살펴보지 않은 특징의 문장은 화면에 없고, 정답 특징값을 담은 속성도 없다', async ({ page }) => {
  const body = page.locator('body');
  await sortChoose(page, '다리가 있나요?');
  await sortCard(page, '개미').click();
  for (const s of ['땅 위와 땅속 굴을', OBS_LEGS_ANT, '일개미에게는 날개가 없어요.']) await expect(body).not.toContainText(s);
  await sortObserveButton(page, '다리').click();
  await expect(body).toContainText(OBS_LEGS_ANT);
  await expect(body).not.toContainText('땅 위와 땅속 굴을');
  await expect(body).not.toContainText('일개미에게는 날개가 없어요.');
  // 다른 카드의 문장도 없다.
  await expect(body).not.toContainText('다리가 10개');
  // data-* 속성, 특징값을 담은 속성이 없다.
  const leaked = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      for (const a of el.attributes) {
        if (a.name.startsWith('data-')) bad.push(`${el.tagName}[${a.name}]`);
        if (/^(land|water|air|yes|no)$/.test(a.value) && a.name !== 'value') bad.push(`${el.tagName}[${a.name}=${a.value}]`);
      }
    }
    return bad;
  });
  expect(leaked).toEqual([]);
});

test('카드 더미에 판정 색이 없다: 확인 뒤에도 카드 버튼 색이 같다', async ({ page }) => {
  await sortChoose(page, '다리가 있나요?');
  await sortAll(page, 'legs', { override: { 게: '다리가 없다' } });
  await sortCheckButton(page).click();
  await expect(page.getByText('게는 관찰한 내용과')).toBeVisible();
  const colors = await Promise.all(
    ANIMAL_CARDS.map((c) => sortCard(page, c).evaluate((el) => { const s = getComputedStyle(el); return `${s.backgroundColor}|${s.borderColor}`; })),
  );
  expect(new Set(colors).size).toBe(1);
});

test('키보드만으로 카드 고르기, 관찰, 무리에 넣기를 할 수 있다', async ({ page }) => {
  const radio = page.getByRole('radio', { name: '다리가 있나요?', exact: true });
  await radio.focus();
  await page.keyboard.press('Space');
  await expect(radio).toBeChecked();

  const tabTo = async (target: Locator, max = 30) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      if (await target.evaluate((el) => el === document.activeElement)) return;
    }
    throw new Error('Tab으로 닿지 못했어요');
  };

  await tabTo(sortCard(page, '개미'));
  await page.keyboard.press('Enter');
  await expect(sortCard(page, '개미')).toHaveAttribute('aria-pressed', 'true');
  await tabTo(sortObserveButton(page, '다리'));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('list', { name: '개미 관찰 기록' })).toContainText(OBS_LEGS_ANT);
  await tabTo(sortPutButton(page, '다리가 있다'));
  await page.keyboard.press('Enter');
  const bin = page.getByRole('group', { name: '다리가 있다' });
  await expect(bin.getByRole('button', { name: /^개미 관찰/ })).toBeVisible();
  // 빼기 버튼도 키보드로 쓸 수 있다.
  const remove = bin.getByRole('button', { name: '개미 빼기' });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(bin.getByRole('listitem')).toHaveCount(0);
});

test('카드 그림은 화면에 그려지고 SVG 글자는 13 px 이상이다', async ({ page }) => {
  await sortChoose(page, '다리가 있나요?');
  await sortCard(page, '게').click();
  await expect(page.locator('svg.animal-icon')).toHaveCount(9); // 더미 8장 + 돋보기 1장
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('svg.animal-icon')].flatMap((svg) => {
      const s = svg as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll('text')].map((t) => ({ text: t.textContent ?? '', px: parseFloat(getComputedStyle(t).fontSize) * scale }));
    }),
  );
  for (const { text, px } of sizes) expect(px, text).toBeGreaterThanOrEqual(13);
  // 그림은 장식이다: 스크린 리더에는 읽히지 않는다.
  await expect(page.locator('svg.animal-icon').first()).toHaveAttribute('aria-hidden', 'true');
});

test.describe('휴대폰 폭', () => {
  test.use({ viewport: { width: 390, height: 800 } });
  test('가로 스크롤이 없다 (처음, 카드를 고른 뒤, 모두 넣은 뒤)', async ({ page }) => {
    const noScroll = async () => {
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
    };
    await noScroll();
    await sortChoose(page, '어디에서 사나요?');
    await sortCard(page, '게').click();
    await sortObserveButton(page, '사는 곳').click();
    await noScroll();
    await sortAll(page, 'habitat');
    await sortCheckButton(page).click();
    await noScroll();
  });
});
