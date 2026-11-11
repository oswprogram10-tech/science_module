import { createHash } from 'node:crypto';
import { test, expect, gotoUnit, activityTab, activityTabs, MIXTURE_SORT_TITLE } from './helpers';

test('단원 목록은 3·4·5·6학년으로 묶인 카드 32개를 보여 준다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  for (const g of ['3학년', '4학년', '5학년', '6학년']) {
    await expect(page.getByRole('heading', { level: 2, name: g })).toBeVisible();
  }
  const cards = page.getByRole('button', { name: /탐구 질문:/ });
  await expect(cards).toHaveCount(32);
  const grade3 = page.getByRole('region', { name: '3학년' }).getByRole('button');
  await expect(grade3).toHaveCount(8);
  await expect(grade3.nth(0)).toContainText('생물의 한살이');
  await expect(grade3.nth(1)).toContainText('동물의 생활');
  await expect(grade3.nth(2)).toContainText('식물의 생활');
  await expect(grade3.nth(3)).toContainText('힘과 우리 생활');
  await expect(grade3.nth(4)).toContainText('소리의 성질');
  await expect(grade3.nth(5)).toContainText('물체와 물질');
  await expect(grade3.nth(6)).toContainText('지구와 바다');
  await expect(grade3.nth(7)).toContainText('감염병과 건강한 생활');
  const grade4 = page.getByRole('region', { name: '4학년' }).getByRole('button');
  await expect(grade4).toHaveCount(8);
  await expect(grade4.nth(0)).toContainText('여러 가지 기체');
  await expect(grade4.nth(1)).toContainText('땅의 변화');
  await expect(grade4.nth(2)).toContainText('생물과 환경');
  await expect(grade4.nth(3)).toContainText('다양한 생물과 우리 생활');
  await expect(grade4.nth(4)).toContainText('자석의 이용');
  await expect(grade4.nth(5)).toContainText('물의 상태 변화');
  await expect(grade4.nth(6)).toContainText('밤하늘 관찰');
  await expect(grade4.nth(7)).toContainText('기후변화와 우리 생활');
  const grade5 = page.getByRole('region', { name: '5학년' }).getByRole('button');
  await expect(grade5).toHaveCount(8);
  await expect(grade5.nth(0)).toContainText('용해와 용액');
  await expect(grade5.nth(1)).toContainText('열과 우리 생활');
  await expect(grade5.nth(2)).toContainText('빛의 성질');
  await expect(grade5.nth(3)).toContainText('우리 몸의 구조와 기능');
  await expect(grade5.nth(4)).toContainText('혼합물의 분리');
  await expect(grade5.nth(5)).toContainText('지층과 화석');
  await expect(grade5.nth(6)).toContainText('날씨와 우리 생활');
  await expect(grade5.nth(7)).toContainText('자원과 에너지');
  const grade6 = page.getByRole('region', { name: '6학년' }).getByRole('button');
  await expect(grade6).toHaveCount(8);
  await expect(grade6.nth(0)).toContainText('산과 염기');
  await expect(grade6.nth(1)).toContainText('물질의 연소');
  await expect(grade6.nth(2)).toContainText('전기의 이용');
  await expect(grade6.nth(3)).toContainText('지구의 운동');
  await expect(grade6.nth(4)).toContainText('계절의 변화');
  await expect(grade6.nth(5)).toContainText('식물의 구조와 기능');
  await expect(grade6.nth(6)).toContainText('물체의 운동');
  await expect(grade6.nth(7)).toContainText('과학과 나의 진로');
});

for (const [grade, title, id] of [
  ['4학년', '여러 가지 기체', 'g4-gases'],
  ['5학년', '용해와 용액', 'g5-solution'],
  ['6학년', '산과 염기', 'g6-acid-base'],
  ['6학년', '물질의 연소', 'g6-combustion'],
  ['5학년', '열과 우리 생활', 'g5-heat'],
  ['5학년', '빛의 성질', 'g5-light'],
  ['6학년', '전기의 이용', 'g6-electricity'],
  ['4학년', '땅의 변화', 'g4-land'],
  ['6학년', '지구의 운동', 'g6-earth-motion'],
  ['6학년', '계절의 변화', 'g6-seasons'],
  ['3학년', '생물의 한살이', 'g3-lifecycle'],
  ['6학년', '식물의 구조와 기능', 'g6-plant'],
  ['4학년', '생물과 환경', 'g4-ecosystem'],
  ['4학년', '다양한 생물과 우리 생활', 'g4-microbe'],
  ['5학년', '우리 몸의 구조와 기능', 'g5-body'],
  ['3학년', '동물의 생활', 'g3-animal'],
  ['3학년', '식물의 생활', 'g3-plantlife'],
  ['3학년', '힘과 우리 생활', 'g3-force'],
  ['3학년', '소리의 성질', 'g3-sound'],
  ['4학년', '자석의 이용', 'g4-magnet'],
  ['6학년', '물체의 운동', 'g6-motion'],
  ['3학년', '물체와 물질', 'g3-material'],
  ['4학년', '물의 상태 변화', 'g4-water-state'],
  ['5학년', '혼합물의 분리', 'g5-mixture'],
  ['3학년', '지구와 바다', 'g3-earth-sea'],
  ['4학년', '밤하늘 관찰', 'g4-night-sky'],
  ['5학년', '지층과 화석', 'g5-strata'],
  ['5학년', '날씨와 우리 생활', 'g5-weather'],
  ['3학년', '감염병과 건강한 생활', 'g3-health'],
  ['4학년', '기후변화와 우리 생활', 'g4-climate'],
  ['5학년', '자원과 에너지', 'g5-energy'],
  ['6학년', '과학과 나의 진로', 'g6-career'],
] as const) {
  test(`${title} 카드를 누르면 #/unit/${id}로 가고 단원 목록으로 돌아온다`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('region', { name: grade }).getByRole('button', { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`#/unit/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.getByRole('link', { name: '← 단원 목록' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  });
}

test('알 수 없는 단원 id는 단원 목록(#/)으로 돌아간다', async ({ page }) => {
  await page.goto('/#/unit/nope');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
});

test('예전 주소 #/unit/g3-earth-sea는 이제 새 「지구와 바다」 단원(바닷물과 강물 비교하기)을 열고, 흐르는 물은 #/unit/g4-land/stream-table로 연다', async ({ page }) => {
  await page.goto('/#/unit/g3-earth-sea');
  await expect(page).toHaveURL(/#\/unit\/g3-earth-sea$/);
  await expect(page.getByRole('heading', { level: 1, name: '지구와 바다' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 바닷물과 강물을 증발시키면 남는 것이 어떻게 다를까?')).toBeVisible();
  await expect(page.getByRole('group', { name: '물의 종류' })).toBeVisible();
  // 활동이 둘(바닷물과 강물 비교하기, 밀물과 썰물 관찰하기)이라 활동 탭이 있고 첫 활동이 열린다
  await expect(activityTabs(page)).toHaveCount(1);
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
  await page.goto('/#/unit/g4-land/stream-table');
  await expect(page.getByRole('heading', { level: 1, name: '땅의 변화' })).toBeVisible();
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('group', { name: '언덕의 기울기' })).toBeVisible();
});

// ---- 한 단원에 여러 활동 ----

test('단원 목록 카드: 활동이 둘인 땅의 변화, 혼합물의 분리, 지구와 바다, 날씨와 우리 생활, 동물의 생활, 식물의 생활, 생물과 환경, 지층과 화석만 "활동 2개"를 보이고 카드는 단원당 하나다', async ({ page }) => {
  await page.goto('/');
  const cards = page.getByRole('button', { name: /탐구 질문:/ });
  await expect(cards).toHaveCount(32);
  await expect(page.getByText(/^활동 \d+개$/)).toHaveCount(8);
  await expect(page.getByRole('region', { name: '3학년' }).getByRole('button', { name: /지구와 바다/ })).toContainText('활동 2개');
  await expect(page.getByRole('region', { name: '4학년' }).getByRole('button', { name: /땅의 변화/ })).toContainText('활동 2개');
  const weather = page.getByRole('region', { name: '5학년' }).getByRole('button', { name: /날씨와 우리 생활/ });
  await expect(weather).toHaveCount(1);
  await expect(weather).toContainText('활동 2개');
  // 카드의 탐구 질문은 첫 활동(해륙풍)의 것이다.
  await expect(weather).toContainText('낮과 밤에 바닷가에서는 바람이 어느 쪽으로 불까?');
  // 카드 분류 두 번째 활동을 더한 네 단원(카드의 탐구 질문은 모두 첫 활동의 것이다).
  for (const [grade, name, q] of [
    ['3학년', /동물의 생활/, '동물을 어떤 기준으로 분류할 수 있을까?'],
    ['3학년', /식물의 생활/, '잎의 생김새에 따라 식물을 어떻게 분류할 수 있을까?'],
    ['4학년', /생물과 환경/, '풀, 토끼, 여우가 사는 곳에서 어떤 조건이 바뀌면 생물의 수는 어떻게 달라질까?'],
    ['5학년', /지층과 화석/, '지층이 쌓인 순서와 그때의 환경을 어떻게 알 수 있을까?'],
  ] as const) {
    const card = page.getByRole('region', { name: grade }).getByRole('button', { name });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('활동 2개');
    await expect(card).toContainText(q);
  }
  const mixture = page.getByRole('region', { name: '5학년' }).getByRole('button', { name: /혼합물의 분리/ });
  await expect(mixture).toHaveCount(1);
  await expect(mixture).toContainText('활동 2개');
  // 카드의 탐구 질문은 첫 활동의 것이다.
  await expect(mixture).toContainText('소금과 모래가 섞인 혼합물에서 소금을 어떻게 분리할 수 있을까?');
  await mixture.click();
  await expect(page).toHaveURL(/#\/unit\/g5-mixture$/);
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
});

test('#/unit/{id}는 첫 활동, #/unit/{id}/{experimentId}는 그 활동을 연다', async ({ page }) => {
  await page.goto('/#/unit/g5-mixture');
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('group', { name: '넣는 물의 양' })).toBeVisible();
  await page.goto('/#/unit/g5-mixture/separation-methods');
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 혼합물을 이루는 물질의 성질이 다르면')).toBeVisible();
  await page.goto('/#/unit/g5-mixture/salt-sand');
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
});

test('모르는 experimentId는 첫 활동으로 돌린다', async ({ page }) => {
  await page.goto('/#/unit/g5-mixture/nope');
  await expect(page.getByRole('heading', { level: 1, name: '혼합물의 분리' })).toBeVisible();
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('group', { name: '넣는 물의 양' })).toBeVisible();
  // 활동이 하나인 단원에서는 어떤 experimentId도 그 단원의 활동을 연다.
  await page.goto('/#/unit/g4-gases/separation-methods');
  await expect(page.getByRole('heading', { level: 1, name: '여러 가지 기체' })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
});

test('고른 탭은 활동 화면을 감싼 탭 패널을 가리키고, 패널 이름은 고른 탭이다', async ({ page }) => {
  await page.goto('/#/unit/g5-mixture/separation-methods');
  const panel = page.getByRole('tabpanel');
  await expect(panel).toHaveCount(1);
  await expect(panel).toHaveAccessibleName('활동 2 · 혼합물의 성질에 따라 분리 방법 고르기');
  await expect(activityTab(page, 2)).toHaveAttribute('aria-controls', 'activity-panel');
  await expect(activityTab(page, 1)).not.toHaveAttribute('aria-controls', /.+/);
  await expect(panel.getByRole('radio', { name: '한 가지가 자석에 붙나요?', exact: true })).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('활동 1 · 소금과 모래의 혼합물 분리하기');
  // 활동이 하나인 단원에는 탭 패널이 없다.
  await page.goto('/#/unit/g4-gases');
  await expect(page.getByRole('heading', { level: 1, name: '여러 가지 기체' })).toBeVisible();
  await expect(page.getByRole('tabpanel')).toHaveCount(0);
});

test('새로 고침해도 같은 활동이 열린다', async ({ page }) => {
  await page.goto('/#/unit/g5-mixture');
  await activityTab(page, 2).click();
  await expect(page).toHaveURL(/#\/unit\/g5-mixture\/separation-methods$/);
  await page.reload();
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('radio', { name: '한 가지가 자석에 붙나요?', exact: true })).toBeVisible();
  await activityTab(page, 1).click();
  await page.reload();
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
});

test('뒤로 가기로 활동이 바뀌고 활동의 상태는 새로 시작한다', async ({ page }) => {
  await page.goto('/#/unit/g5-mixture/separation-methods');
  await page.getByRole('radio', { name: '한 가지가 자석에 붙나요?', exact: true }).check();
  await expect(page.getByRole('radio', { name: '한 가지가 자석에 붙나요?', exact: true })).toBeChecked();
  await activityTab(page, 1).click();
  await activityTab(page, 2).click();
  await expect(page.getByRole('radio', { name: '한 가지가 자석에 붙나요?', exact: true })).not.toBeChecked();
  await page.goBack();
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
});

test('키보드로 탭을 옮긴다: 화살표, Home, End', async ({ page }) => {
  await page.goto('/#/unit/g5-mixture');
  await expect(activityTabs(page)).toBeVisible();
  // 선택된 탭만 Tab 순서에 들어 있다(roving tabindex).
  await expect(activityTab(page, 1)).toHaveAttribute('tabindex', '0');
  await expect(activityTab(page, 2)).toHaveAttribute('tabindex', '-1');
  await activityTab(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/unit\/g5-mixture\/separation-methods$/);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(activityTab(page, 2)).toBeFocused();
  await expect(page.getByRole('heading', { level: 1, name: '혼합물의 분리' })).toBeVisible();
  await page.keyboard.press('ArrowRight'); // 끝에서 처음으로
  await expect(activityTab(page, 1)).toBeFocused();
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(activityTab(page, 2)).toBeFocused();
  await expect(page).toHaveURL(/#\/unit\/g5-mixture\/separation-methods$/);
  await page.keyboard.press('Home');
  await expect(activityTab(page, 1)).toBeFocused();
  await page.keyboard.press('ArrowLeft'); // 처음에서 끝으로
  await expect(activityTab(page, 2)).toBeFocused();
  await expect(activityTab(page, 2)).toHaveText(`활동 2 · ${MIXTURE_SORT_TITLE}`);
});

test('활동이 하나인 단원은 탭을 그리지 않고 머리 바로 아래가 본문이다(구조 그대로)', async ({ page }) => {
  for (const id of ['g4-gases', 'g5-solution', 'g6-acid-base', 'g3-material', 'g4-night-sky', 'g6-career']) {
    await gotoUnit(page, id);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('tablist'), id).toHaveCount(0);
    await expect(page.getByRole('tab'), id).toHaveCount(0);
    await expect(page.locator('.activity-tabs'), id).toHaveCount(0);
    // 머리(header.top) 바로 뒤 형제는 본문(main)이다: 탭 자리가 DOM에 아무것도 남기지 않는다.
    const next = await page.locator('.app > header.top').evaluate((h) => h.nextElementSibling?.tagName ?? null);
    expect(next, id).toBe('MAIN');
  }
});

test('활동이 둘인 단원은 머리 바로 아래에 탭이 있다', async ({ page }) => {
  await gotoUnit(page, 'g5-mixture');
  const next = await page.locator('.app > header.top').evaluate((h) => h.nextElementSibling?.className ?? null);
  expect(next).toBe('activity-tabs');
});

/**
 * 여러 활동 지원을 더하기 전의 코드로 만든 화면(#root의 innerHTML, 처음 상태)의 SHA-256.
 * 활동이 하나인 단원은 한 글자도 달라지면 안 된다(탭 자리가 DOM에 아무것도 남기지 않는다).
 */
const BASELINE_DOM: Record<string, string> = {
  'g4-gases': '88a2f9af0f667dc4e24ed3a4e713a33551ad13e9906629f9ab60a4c7f43c7bbb',
  'g5-solution': '5a419295a21b415e3bd24ed2b086ac4d851b453cbf4953b1bb9f42c93e4586ae',
  'g6-acid-base': '82cf6aa6cc7d15ec3e3db7f9eee55708f52ba91d06bb59d6bf3f7aa2d914f073',
  'g3-material': 'ccfbecacc9872a8c06aa62ccb273a21781f1841ae715a1fec7b80ca7528e94aa',
  // 진로 단원 안 "기록장 켜기" 버튼(1단계)과 안내 한 문장을 더한 뒤의 값. 그 둘을 되돌리면 앞의 값(8483518f…)과 같음을 확인했다.
  'g6-career': '42ee7d70874a9f08c896311d310ecb85e56fd2ed61ec90f1868ad02606bed06f',
};

/**
 * 카드 분류 두 번째 활동을 더하기 전에는 활동이 하나여서 위 BASELINE_DOM에 있던 세 단원. 두 번째 활동을 더하자 활동 탭이 생겨 첫 활동 화면(DOM)이
 * 바뀌었다. 옛 값은 동물의 생활 ba076977…, 지층과 화석 37617a9f…, 식물의 생활 9d2d2010…이었고, 세 단원 매니페스트에서 두 번째 활동(과 standards)만
 * 되돌렸을 때 이 옛 값이 그대로 나오는 것을 확인했다(탭 자리 말고 달라진 것이 없다).
 */
const TABBED_DOM: Record<string, string> = {
  'g3-animal': '90e53c3aa7bda823a380c9f0a8f31192bfaa143092158edfe2ce65836bf48217',
  'g5-strata': '1e3d8f571fcc15ee89a343380d19b6d1548a400ab1457cdc79cc0966a5ed01f7',
  'g3-plantlife': '1c312401ae692c183cb52f7fab8de4c23b1ac16838e8e7360abed699a45eaa22',
};

test('활동이 하나인 대표 단원 5개의 화면(DOM)이 활동 탭을 더하기 전과 같고, 활동이 둘이 된 세 단원은 탭이 더해진 화면과 같다', async ({ page }) => {
  for (const [id, sha] of Object.entries({ ...BASELINE_DOM, ...TABBED_DOM })) {
    await gotoUnit(page, id);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(300);
    const html = await page.locator('#root').innerHTML();
    expect(createHash('sha256').update(html).digest('hex'), `${id}: 화면이 달라졌어요`).toBe(sha);
  }
});
