import { test, expect } from './helpers';

test('단원 목록은 3·4·5·6학년으로 묶인 카드 26개를 보여 준다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  for (const g of ['3학년', '4학년', '5학년', '6학년']) {
    await expect(page.getByRole('heading', { level: 2, name: g })).toBeVisible();
  }
  const cards = page.getByRole('button', { name: /탐구 질문:/ });
  await expect(cards).toHaveCount(26);
  const grade3 = page.getByRole('region', { name: '3학년' }).getByRole('button');
  await expect(grade3).toHaveCount(7);
  await expect(grade3.nth(0)).toContainText('생물의 한살이');
  await expect(grade3.nth(1)).toContainText('동물의 생활');
  await expect(grade3.nth(2)).toContainText('식물의 생활');
  await expect(grade3.nth(3)).toContainText('힘과 우리 생활');
  await expect(grade3.nth(4)).toContainText('소리의 성질');
  await expect(grade3.nth(5)).toContainText('물체와 물질');
  await expect(grade3.nth(6)).toContainText('지구와 바다');
  const grade4 = page.getByRole('region', { name: '4학년' }).getByRole('button');
  await expect(grade4).toHaveCount(7);
  await expect(grade4.nth(0)).toContainText('여러 가지 기체');
  await expect(grade4.nth(1)).toContainText('땅의 변화');
  await expect(grade4.nth(2)).toContainText('생물과 환경');
  await expect(grade4.nth(3)).toContainText('다양한 생물과 우리 생활');
  await expect(grade4.nth(4)).toContainText('자석의 이용');
  await expect(grade4.nth(5)).toContainText('물의 상태 변화');
  await expect(grade4.nth(6)).toContainText('밤하늘 관찰');
  const grade5 = page.getByRole('region', { name: '5학년' }).getByRole('button');
  await expect(grade5).toHaveCount(5);
  await expect(grade5.nth(0)).toContainText('용해와 용액');
  await expect(grade5.nth(1)).toContainText('열과 우리 생활');
  await expect(grade5.nth(2)).toContainText('빛의 성질');
  await expect(grade5.nth(3)).toContainText('우리 몸의 구조와 기능');
  await expect(grade5.nth(4)).toContainText('혼합물의 분리');
  const grade6 = page.getByRole('region', { name: '6학년' }).getByRole('button');
  await expect(grade6).toHaveCount(7);
  await expect(grade6.nth(0)).toContainText('산과 염기');
  await expect(grade6.nth(1)).toContainText('물질의 연소');
  await expect(grade6.nth(2)).toContainText('전기의 이용');
  await expect(grade6.nth(3)).toContainText('지구의 운동');
  await expect(grade6.nth(4)).toContainText('계절의 변화');
  await expect(grade6.nth(5)).toContainText('식물의 구조와 기능');
  await expect(grade6.nth(6)).toContainText('물체의 운동');
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
