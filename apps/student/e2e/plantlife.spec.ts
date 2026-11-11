import {
  test,
  expect,
  gotoUnit,
  defineSortSuite,
  PLANT_HABITAT_CFG,
  scrollWidth,
  LEAF_CARDS,
  LEAF_SIDE,
  sortCard,
  sortCheckButton,
  sortChoose,
  sortFeedback,
  sortObserveButton,
  sortTutor,
  treeFinish,
  treeNode,
  treeNodes,
  treePutButton,
  treeSplit,
} from './helpers';
import type { Locator, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await gotoUnit(page, 'g3-plantlife');
});

const progress = (page: Page) => page.getByRole('region', { name: '진행 상황' });
const MAPLE_LOBED = '손바닥처럼 5~7갈래로 깊게 갈라져 있어요.';
const Q_PARALLEL = '잎맥이 나란한가요?';
const Q_SERRATED = '잎 가장자리가 톱니 모양인가요?';
const Q_LOBED = '잎이 여러 갈래로 갈라져 있나요?';

test('처음 화면: 질문을 먼저 고르라고 하고 뿌리 노드가 지금 나누는 무리다', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: '식물의 생활' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 잎의 생김새에 따라 식물을 어떻게 분류할 수 있을까?')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: '분류 기준' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(4);
  for (const name of [Q_SERRATED, Q_LOBED, Q_PARALLEL, '잎이 예쁜가요?']) {
    const r = page.getByRole('radio', { name, exact: true });
    await expect(r).not.toBeChecked();
    await expect(r).toBeEnabled();
  }
  await expect(treeNodes(page)).toHaveCount(1);
  await expect(treeNode(page, 'r')).toHaveAttribute('aria-current', 'true');
  await expect(treeNode(page, 'r')).toContainText('질문을 골라 주세요');
  await expect(sortCheckButton(page)).toBeDisabled();
  await expect(sortTutor(page)).toContainText('이 무리를 두 갈래로 나누려면 어떤 질문이 좋을까요?');
  await expect(progress(page)).toContainText('나눈 횟수 0번');
  for (const card of LEAF_CARDS) await expect(sortCard(page, card)).toBeVisible();
});

test('관찰 없이 넣고 확인하면 아직 살펴보지 않았다고만 하고 쪽은 알려 주지 않는다', async ({ page }) => {
  await sortChoose(page, Q_PARALLEL);
  for (const card of LEAF_CARDS) {
    await sortCard(page, card).click();
    await treePutButton(page, LEAF_SIDE.parallel[card]).click();
  }
  await expect(sortCheckButton(page)).toBeEnabled();
  await sortCheckButton(page).click();
  await expect(page.getByText('아직 이 기준의 특징을 살펴보지 않았어요')).toBeVisible();
  await expect(sortTutor(page)).toContainText('단풍나무 잎은 아직 살펴보지 않았어요. 돋보기로 먼저 관찰해 볼까요?');
  for (const box of [sortFeedback(page), sortTutor(page)]) {
    await expect(box).not.toContainText('잎맥이 나란하다');
    await expect(box).not.toContainText('(는)');
  }
  await expect(treeNodes(page)).toHaveCount(1);
  await expect(progress(page)).toContainText('나눈 횟수 0번');
});

test('관찰하고 바르게 넣으면 자식 무리 두 개가 생기고 처음 나눈 것이 한 번으로 센다', async ({ page }) => {
  await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
  await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
  await expect(treeNodes(page)).toHaveCount(3);
  await expect(treeNode(page, 'r')).toContainText(Q_PARALLEL);
  await expect(treeNode(page, 'r/yes')).toContainText('붓꽃, 백합');
  await expect(treeNode(page, 'r/yes')).toContainText('질문을 골라 주세요');
  await expect(treeNode(page, 'r/no')).toContainText('단풍나무, 국화, 벚나무, 동백나무, 감나무, 라일락');
  // 자식 칸의 제목은 무리 라벨이다.
  const tree = page.getByRole('navigation', { name: '나누기 트리 그림' });
  await expect(tree.getByText('잎맥이 나란하다', { exact: true })).toBeVisible();
  await expect(tree.getByText('잎맥이 나란하지 않다', { exact: true })).toBeVisible();
  await expect(progress(page)).toContainText('나눈 횟수 1번');
  await expect(progress(page)).toContainText('아직 더 나눌 수 있는 무리가 있어요.');
  await expect(sortTutor(page)).toContainText('아직 더 나눌 수 있는 무리가 있을까요?');
  // 어느 무리가 남았는지는 말하지 않는다.
  await expect(progress(page)).not.toContainText('붓꽃');
  await expect(progress(page)).not.toContainText('감나무');
});

test('붓꽃을 "아니요"에 넣으면 다시 비교하라고만 하고, 바로잡으면 잘 맞는다', async ({ page }) => {
  await treeSplit(page, 'r', 'parallel', LEAF_CARDS, { override: { 붓꽃: '아니요' } });
  await expect(page.getByText('붓꽃은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?')).toBeVisible();
  await expect(sortTutor(page)).toContainText('붓꽃 잎에서 관찰한 내용과 넣은 쪽을 다시 비교해 볼까요?');
  await expect(sortFeedback(page)).not.toContainText('나란');
  await expect(treeNodes(page)).toHaveCount(1);
  await sortCard(page, '붓꽃').click();
  await treePutButton(page, '예').click();
  await expect(page.getByText('분류를 마치고 확인하기를 누르면')).toBeVisible();
  await sortCheckButton(page).click();
  await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
  await expect(treeNodes(page)).toHaveCount(3);
});

test('"잎이 예쁜가요?"는 판정하지 않고 자식 무리도 만들지 않는다', async ({ page }) => {
  await sortChoose(page, '잎이 예쁜가요?');
  for (const card of LEAF_CARDS) {
    await sortCard(page, card).click();
    await treePutButton(page, card === '단풍나무' || card === '벚나무' ? '예' : '아니요').click();
  }
  await sortCheckButton(page).click();
  await expect(sortTutor(page)).toContainText("'잎이 예쁜가요?'에 친구와 내가 같은 답을 할까요?");
  await expect(page.getByText('이 기준은 사람마다 다르게 나눌 수 있어요.')).toBeVisible();
  await expect(treeNodes(page)).toHaveCount(1);
  await expect(progress(page)).toContainText('나눈 횟수 0번');
});

test('부모가 쓴 질문은 자식 무리에서 비활성이고 이유가 글자로 보인다', async ({ page }) => {
  await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
  await treeNode(page, 'r/no').click();
  await expect(treeNode(page, 'r/no')).toHaveAttribute('aria-current', 'true');
  await expect(treeNode(page, 'r')).not.toHaveAttribute('aria-current', 'true');
  const used = page.getByRole('radio', { name: Q_PARALLEL, exact: true });
  await expect(used).toBeDisabled();
  await expect(page.getByText('위에서 이미 쓴 질문이에요')).toHaveCount(1);
  await expect(page.getByText('위에서 이미 쓴 질문이에요')).toBeVisible();
  await expect(page.getByRole('radio', { name: Q_SERRATED, exact: true })).toBeEnabled();
  await expect(page.getByRole('radio', { name: Q_LOBED, exact: true })).toBeEnabled();
  // 처음 노드에서는 다시 고를 수 있다.
  await treeNode(page, 'r').click();
  await expect(page.getByRole('radio', { name: Q_PARALLEL, exact: true })).toBeEnabled();
  await expect(page.getByRole('radio', { name: Q_PARALLEL, exact: true })).toBeChecked();
  await expect(page.getByText('위에서 이미 쓴 질문이에요')).toHaveCount(0);
});

test('붓꽃·백합 무리에 톱니 질문을 쓰면 한쪽으로 모였다고 하고 자식은 없다', async ({ page }) => {
  await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
  await treeSplit(page, 'r/yes', 'serrated', ['붓꽃', '백합']);
  await expect(sortFeedback(page)).toContainText('모든 잎이 한쪽으로 모였어요.');
  await expect(sortTutor(page)).toContainText('이 질문으로는 나누어지지 않았어요. 다른 질문을 골라 볼까요?');
  await expect(treeNodes(page)).toHaveCount(3);
  await expect(progress(page)).toContainText('나눈 횟수 1번');
  // 질문을 바꿀 수 있다.
  await sortChoose(page, Q_LOBED);
  await expect(page.getByRole('radio', { name: Q_LOBED, exact: true })).toBeChecked();
  await expect(treeNode(page, 'r/yes')).toContainText(Q_LOBED);
  await expect(page.getByText('모든 잎이 한쪽으로 모였어요.')).toHaveCount(0);
});

test('§1 완성 트리까지 나누면 마무리 문장이 나오고 잎 무리는 4개다', async ({ page }) => {
  await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
  await treeSplit(page, 'r/no', 'serrated', ['단풍나무', '국화', '벚나무', '동백나무', '감나무', '라일락']);
  await expect(page.getByText('더 나눌 수 없을 때까지 나누었어요!')).toHaveCount(0);
  await expect(progress(page)).toContainText('아직 더 나눌 수 있는 무리가 있어요.');
  await treeSplit(page, 'r/no/yes', 'lobed', ['단풍나무', '국화', '벚나무', '동백나무']);
  await expect(page.getByText('더 나눌 수 없을 때까지 나누었어요!')).toBeVisible();
  await expect(progress(page)).toContainText('나눈 횟수 3번');
  await expect(progress(page)).not.toContainText('아직 더 나눌 수 있는 무리가 있어요.');
  await expect(sortTutor(page)).toContainText('처음 질문을 바꾸면 트리 모양이 어떻게 달라질까요?');
  await expect(treeNodes(page)).toHaveCount(7);
  await expect(treeNode(page, 'r/no/yes/yes')).toContainText('단풍나무, 국화');
  await expect(treeNode(page, 'r/no/yes/no')).toContainText('벚나무, 동백나무');
  await expect(treeNode(page, 'r/no/no')).toContainText('감나무, 라일락');
  await expect(treeNode(page, 'r/yes')).toContainText('붓꽃, 백합');
});

test('처음 질문을 바꾸면 아래 노드가 사라지고 마무리 문장도 사라진다', async ({ page }) => {
  await treeFinish(page);
  await expect(page.getByText('더 나눌 수 없을 때까지 나누었어요!')).toBeVisible();
  await treeNode(page, 'r').click();
  await sortChoose(page, Q_LOBED);
  await expect(page.getByText('질문을 바꾸어서 아래 무리를 다시 나눠요.')).toBeVisible();
  await expect(treeNodes(page)).toHaveCount(1);
  await expect(treeNode(page, 'r')).toContainText(Q_LOBED);
  await expect(treeNode(page, 'r')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('더 나눌 수 없을 때까지 나누었어요!')).toHaveCount(0);
  await expect(progress(page)).toContainText('나눈 횟수 0번');
  // 관찰 기록은 남아 있다.
  await sortCard(page, '단풍나무').click();
  await expect(sortCard(page, '단풍나무')).toHaveText(/관찰 [2-9]\/3/);
});

test('고른 노드가 지워져도 지금 나누는 무리는 바꾼 노드로 옮겨진다', async ({ page }) => {
  await treeFinish(page);
  await treeNode(page, 'r/no/yes/yes').click();
  await expect(treeNode(page, 'r/no/yes/yes')).toHaveAttribute('aria-current', 'true');
  await treeNode(page, 'r/no').click();
  await sortChoose(page, Q_LOBED);
  await expect(treeNode(page, 'r/no')).toHaveAttribute('aria-current', 'true');
  await expect(treeNodes(page)).toHaveCount(3);
});

test('아직 살펴보지 않은 특징의 문장은 화면에 없고 data 속성이나 정답 값을 담은 속성도 없다', async ({ page }) => {
  const body = page.locator('body');
  await sortChoose(page, Q_PARALLEL);
  await sortCard(page, '단풍나무').click();
  for (const s of [MAPLE_LOBED, '가장자리에 뾰족뾰족한 톱니가 있어요.', '잎맥이 손바닥 모양으로 퍼져 있어요.']) await expect(body).not.toContainText(s);
  await sortObserveButton(page, '갈라짐').click();
  await expect(body).toContainText(MAPLE_LOBED);
  await expect(body).not.toContainText('잎맥이 손바닥 모양으로 퍼져 있어요.');
  await expect(body).not.toContainText('잎 끝까지 나란히');
  await expect(body).not.toContainText('그물처럼');
  await sortCard(page, '단풍나무').click(); // 고른 카드를 푼다
  await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
  const leaked = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      for (const a of el.attributes) {
        if (a.name.startsWith('data-')) bad.push(`${el.tagName}[${a.name}]`);
        if (/^(yes|no)$/.test(a.value) && a.name !== 'value') bad.push(`${el.tagName}[${a.name}=${a.value}]`);
        if (/(serrated|lobed|parallel|cherry|maple|iris|lily)/i.test(a.value)) bad.push(`${el.tagName}[${a.name}=${a.value}]`);
      }
    }
    return bad;
  });
  expect(leaked).toEqual([]);
  await expect(body).not.toContainText('그물맥');
});

test('판정 색이 없다: 확인 뒤에도 카드 버튼과 노드 버튼 색이 같다', async ({ page }) => {
  await treeSplit(page, 'r', 'parallel', LEAF_CARDS, { override: { 붓꽃: '아니요' } });
  await expect(page.getByText('붓꽃은 관찰한 내용과')).toBeVisible();
  const colors = await Promise.all(
    LEAF_CARDS.map((c) => sortCard(page, c).evaluate((el) => { const s = getComputedStyle(el); return `${s.backgroundColor}|${s.borderColor}`; })),
  );
  expect(new Set(colors).size).toBe(1);
  // 맞게 나누어 자식이 생겨도 두 자식 노드 버튼의 색은 같다(정답 무리를 색으로 알리지 않는다).
  await sortCard(page, '붓꽃').click();
  await treePutButton(page, '예').click();
  await sortCheckButton(page).click();
  const nodeColors = await Promise.all(
    ['r/yes', 'r/no'].map((id) => treeNode(page, id).evaluate((el) => { const s = getComputedStyle(el); return `${s.backgroundColor}|${s.borderColor}`; })),
  );
  expect(new Set(nodeColors).size).toBe(1);
});

test('키보드만으로 질문 고르기, 관찰, 넣기, 확인, 노드 고르기를 할 수 있다', async ({ page }) => {
  const tabTo = async (target: Locator, max = 40) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      if (await target.evaluate((el) => el === document.activeElement)) return;
    }
    throw new Error('Tab으로 닿지 못했어요');
  };
  const radio = page.getByRole('radio', { name: Q_PARALLEL, exact: true });
  await radio.focus();
  await page.keyboard.press('Space');
  await expect(radio).toBeChecked();
  await expect(treeNode(page, 'r')).toContainText(Q_PARALLEL);

  for (const card of ['붓꽃', '백합'] as const) {
    await tabTo(sortCard(page, card));
    await page.keyboard.press('Enter');
    await expect(sortCard(page, card)).toHaveAttribute('aria-pressed', 'true');
    await tabTo(sortObserveButton(page, '잎맥'));
    await page.keyboard.press('Enter');
    await tabTo(treePutButton(page, '예'));
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('group', { name: /^예 쪽:/ }).getByRole('button', { name: /^붓꽃 관찰/ })).toBeVisible();
  // 나머지 6장은 마우스로 빨리 넣고, 확인과 노드 고르기는 키보드로 한다.
  for (const card of LEAF_CARDS.filter((c) => c !== '붓꽃' && c !== '백합')) {
    await sortCard(page, card).click();
    await sortObserveButton(page, '잎맥').click();
    await treePutButton(page, '아니요').click();
  }
  await sortCheckButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(treeNodes(page)).toHaveCount(3);
  await treeNode(page, 'r/yes').focus();
  await page.keyboard.press('Enter');
  await expect(treeNode(page, 'r/yes')).toHaveAttribute('aria-current', 'true');
  // 빼기 버튼도 키보드로 쓸 수 있다.
  await page.getByRole('radio', { name: Q_SERRATED, exact: true }).focus();
  await page.keyboard.press('Space');
  await sortCard(page, '붓꽃').click();
  await treePutButton(page, '아니요').click();
  const remove = page.getByRole('button', { name: '붓꽃 빼기' });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '붓꽃 빼기' })).toHaveCount(0);
});

test('잎 그림은 화면에 그려지고 SVG 글자는 13 px 이상이며 그림은 장식이다', async ({ page }) => {
  await sortChoose(page, Q_PARALLEL);
  await sortCard(page, '단풍나무').click();
  await expect(page.locator('svg.leaf-icon')).toHaveCount(9); // 더미 8장 + 돋보기 1장
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('svg')].flatMap((svg) => {
      const s = svg as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / (s.viewBox.baseVal.width || 1);
      return [...s.querySelectorAll('text')].map((t) => ({ text: t.textContent ?? '', px: parseFloat(getComputedStyle(t).fontSize) * scale }));
    }),
  );
  for (const { text, px } of sizes) expect(px, text).toBeGreaterThanOrEqual(13);
  await expect(page.locator('svg.leaf-icon').first()).toHaveAttribute('aria-hidden', 'true');
});

test.describe('휴대폰 폭', () => {
  test.use({ viewport: { width: 390, height: 800 } });
  test('가로 스크롤이 없다 (처음, 카드를 고른 뒤, 첫 나눔 뒤, 완성 뒤)', async ({ page }) => {
    const noScroll = async () => {
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
    };
    await noScroll();
    await sortChoose(page, Q_PARALLEL);
    await sortCard(page, '붓꽃').click();
    await sortObserveButton(page, '잎맥').click();
    await noScroll();
    await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
    await noScroll();
    await treeFinish(page);
    await noScroll();
    // 좁은 화면에서는 노드가 세로로 쌓인 들여쓰기 목록이다(자식이 부모보다 오른쪽 아래에 있다).
    const root = await treeNode(page, 'r').boundingBox();
    const child = await treeNode(page, 'r/no').boundingBox();
    expect(child!.y).toBeGreaterThan(root!.y + root!.height - 1);
    expect(child!.x).toBeGreaterThan(root!.x);
  });
});

test.describe('넓은 화면', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('두 자식 노드가 같은 높이에 나란히 놓인다(위에서 아래로 그린 트리)', async ({ page }) => {
    await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
    const a = await treeNode(page, 'r/yes').boundingBox();
    const b = await treeNode(page, 'r/no').boundingBox();
    const r = await treeNode(page, 'r').boundingBox();
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(a!.y).toBeGreaterThan(r!.y + r!.height);
    expect(a!.x).toBeLessThan(b!.x);
  });
});

// ---- 두 번째 활동: 사는 곳과 식물의 생김새(카드 분류 groups, 활동 탭) ----

defineSortSuite(PLANT_HABITAT_CFG);

