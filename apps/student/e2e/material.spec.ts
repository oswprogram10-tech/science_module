import {
  test,
  expect,
  gotoUnit,
  scrollWidth,
  MATERIAL_CARDS,
  materialCard,
  materialFinishCriterion,
  materialObserveButton,
  materialSortAll,
  sortCheckButton,
  sortChoose,
  sortFeedback,
  sortPutButton,
  sortTutor,
} from './helpers';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await gotoUnit(page, 'g3-material');
});

const progress = (page: Page) => page.getByRole('region', { name: '진행 상황' });
const magnifier = (page: Page) => page.getByRole('region', { name: '돋보기' });

test('처음 화면: 질문, 기준 4가지, 카드 8장과 물질 이름, 확인하기는 꺼져 있다', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: '물체와 물질' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 물체를 이루는 물질의 성질에 따라 물체를 어떻게 분류할 수 있을까?')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(4);
  for (const name of ['손으로 눌러도 모양이 그대로인가요?', '손으로 구부리면 휘어지나요?', '물을 떨어뜨리면 빨아들이나요?', '값비싸 보이나요?']) {
    await expect(page.getByRole('radio', { name, exact: true })).not.toBeChecked();
  }
  await expect(sortCheckButton(page)).toBeDisabled();
  await expect(sortTutor(page)).toContainText('물체들을 어떤 성질로 나누어 볼까요?');
  await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
  for (const card of MATERIAL_CARDS) await expect(materialCard(page, card)).toBeVisible();
  // 카드 이름 아래에 물질 이름이 나란히 있다.
  await expect(materialCard(page, '쇠못')).toContainText('금속');
  await expect(materialCard(page, '알루미늄 포일')).toContainText('금속');
  await expect(materialCard(page, '면 손수건')).toContainText('섬유');
  await expect(page.locator('.sort-card-sub')).toHaveCount(8);
});

test('돋보기 버튼 문구는 "눌러 보기", "구부려 보기", "물 떨어뜨려 보기"이다', async ({ page }) => {
  await expect(magnifier(page).getByRole('button')).toHaveCount(0);
  await materialCard(page, '쇠못').click();
  await expect(magnifier(page).getByText('쇠못 · 금속')).toBeVisible();
  for (const name of ['눌러 보기', '구부려 보기', '물 떨어뜨려 보기']) {
    await expect(magnifier(page).getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(magnifier(page).getByRole('button', { name: /살펴보기/ })).toHaveCount(0);
});

test('8장을 모두 "눌러도 모양이 그대로인가요?"로 시험한다: 포일을 "그대로이다"에 넣으면 다시 비교, 고치면 잘 맞는다', async ({ page }) => {
  await sortChoose(page, '손으로 눌러도 모양이 그대로인가요?');
  await materialSortAll(page, 'hard', { override: { '알루미늄 포일': '그대로이다' } });
  await sortCheckButton(page).click();
  await expect(page.getByText('알루미늄 포일은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?')).toBeVisible();
  await expect(sortTutor(page)).toContainText('알루미늄 포일을 시험한 결과와 넣은 무리를 다시 비교해 볼까요?');
  // 어느 무리가 맞는지는 말하지 않는다.
  for (const box of [sortFeedback(page), sortTutor(page)]) {
    await expect(box).not.toContainText('모양이 변한다');
    await expect(box).not.toContainText('금속은');
  }
  await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');

  await materialCard(page, '알루미늄 포일').click();
  await sortPutButton(page, '모양이 변한다').click();
  await expect(page.getByText('분류를 마치고 확인하기를 누르면')).toBeVisible();
  await sortCheckButton(page).click();
  await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
  await expect(progress(page)).toContainText('끝낸 기준: 손으로 눌러도 모양이 그대로인가요? (1/2)');
  await expect(sortTutor(page)).toContainText('이번에는 다른 성질로도 나누어 볼까요?');
});

test('"값비싸 보이나요?"는 판정하지 않고 사람마다 다르다고만 한다', async ({ page }) => {
  await sortChoose(page, '값비싸 보이나요?');
  for (const card of MATERIAL_CARDS) {
    await materialCard(page, card).click();
    await sortPutButton(page, card === '쇠못' || card === '유리구슬' ? '비싸 보인다' : '싸 보인다').click();
  }
  await sortCheckButton(page).click();
  await expect(page.getByText('이 기준은 사람마다 다르게 나눌 수 있어요.')).toBeVisible();
  await expect(sortTutor(page)).toContainText("'값비싸 보이나요?'로 나누면 친구와 내 결과가 같을까요?");
  await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
});

test('두 가지 성질을 끝내면 완료 문구와 마무리 질문이 나온다', async ({ page }) => {
  await materialFinishCriterion(page, 'hard');
  await expect(page.getByText('두 가지 기준으로 분류했어요!')).toHaveCount(0);
  await materialFinishCriterion(page, 'bends');
  await expect(progress(page)).toContainText('끝낸 기준: 손으로 눌러도 모양이 그대로인가요?, 손으로 구부리면 휘어지나요? (2/2)');
  await expect(page.getByText('두 가지 기준으로 분류했어요!')).toBeVisible();
  await expect(sortTutor(page)).toContainText('같은 물질로 만든 물체인데 다른 무리에 들어간 것이 있나요?');
});

test('시험하기 전에는 기본 그림만 보이고, 시험한 특징의 결과 그림만 나타난다', async ({ page }) => {
  const results = page.locator('svg .mat-result');
  await materialCard(page, '알루미늄 포일').click();
  await expect(page.locator('svg.material-icon')).toHaveCount(9); // 더미 8장 + 돋보기 1장
  await expect(results).toHaveCount(0);
  await expect(page.locator('svg.material-icon [transform]')).toHaveCount(0);

  await materialObserveButton(page, 'bends').click();
  await expect(page.locator('svg .mat-bend')).toHaveCount(1);
  await expect(page.locator('svg .mat-press, svg .mat-bead, svg .mat-stain')).toHaveCount(0);
  await expect(page.getByRole('list', { name: '알루미늄 포일 관찰 기록' })).toContainText('쉽게 휘어지고 구부린 모양 그대로 있어요.');

  await materialObserveButton(page, 'absorbs').click();
  await expect(page.locator('svg .mat-bead')).toHaveCount(1); // 포일은 물을 빨아들이지 않는다
  await expect(page.locator('svg .mat-stain')).toHaveCount(0);
  await expect(page.locator('svg .mat-press')).toHaveCount(0);

  // 다른 카드를 고르면 그 카드에서 시험한 것만 그려진다.
  await materialCard(page, '종이').click();
  await expect(results).toHaveCount(0);
  await materialObserveButton(page, 'absorbs').click();
  await expect(page.locator('svg .mat-stain')).toHaveCount(1);
});

test('움직임 줄이기: 결과 그림에 애니메이션이 없다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await materialCard(page, '고무줄').click();
  await materialObserveButton(page, 'hard').click();
  const name = await page.locator('svg .mat-press').evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe('none');
});

test('아직 시험하지 않은 문장은 화면에 없고, 정답 특징값을 담은 속성도 없다', async ({ page }) => {
  const body = page.locator('body');
  await sortChoose(page, '손으로 구부리면 휘어지나요?');
  await materialCard(page, '플라스틱 자').click();
  for (const s of ['눌러도 모양이 그대로예요.', '양 끝을 잡고 구부리면', '물방울이 맺혀 있고']) await expect(body).not.toContainText(s);
  await materialObserveButton(page, 'bends').click();
  await expect(body).toContainText('양 끝을 잡고 구부리면 휘었다가 놓으면 돌아와요.');
  await expect(body).not.toContainText('눌러도 모양이 그대로예요.');
  await expect(body).not.toContainText('물방울이 맺혀 있고');
  const leaked = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      for (const a of el.attributes) {
        if (a.name.startsWith('data-')) bad.push(`${el.tagName}[${a.name}]`);
        if (/^(yes|no)$/.test(a.value) && a.name !== 'value') bad.push(`${el.tagName}[${a.name}=${a.value}]`);
      }
    }
    return bad;
  });
  expect(leaked).toEqual([]);
});

test('카드 그림은 장식이고 SVG 글자는 13 px 이상이다', async ({ page }) => {
  await materialCard(page, '쇠못').click();
  await materialObserveButton(page, 'absorbs').click();
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('svg.material-icon')].flatMap((svg) => {
      const s = svg as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll('text')].map((t) => ({ text: t.textContent ?? '', px: parseFloat(getComputedStyle(t).fontSize) * scale }));
    }),
  );
  for (const { text, px } of sizes) expect(px, text).toBeGreaterThanOrEqual(13);
  await expect(page.locator('svg.material-icon').first()).toHaveAttribute('aria-hidden', 'true');
});

test.describe('휴대폰 폭', () => {
  test.use({ viewport: { width: 390, height: 800 } });
  test('가로 스크롤이 없다 (처음, 카드를 시험한 뒤, 모두 넣은 뒤)', async ({ page }) => {
    const noScroll = async () => {
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
    };
    await noScroll();
    await sortChoose(page, '물을 떨어뜨리면 빨아들이나요?');
    await materialCard(page, '면 손수건').click();
    await materialObserveButton(page, 'absorbs').click();
    await noScroll();
    await materialSortAll(page, 'absorbs');
    await sortCheckButton(page).click();
    await noScroll();
  });
});
