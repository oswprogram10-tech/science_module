import { test, expect } from './helpers';

test('단원 목록은 4·5·6학년으로 묶인 카드 3개를 보여 준다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
  for (const g of ['4학년', '5학년', '6학년']) {
    await expect(page.getByRole('heading', { level: 2, name: g })).toBeVisible();
  }
  const cards = page.getByRole('button', { name: /탐구 질문:/ });
  await expect(cards).toHaveCount(3);
  // 학년 구역 안에 카드가 하나씩 들어 있다.
  await expect(page.getByRole('region', { name: '4학년' }).getByRole('button')).toContainText('여러 가지 기체');
  await expect(page.getByRole('region', { name: '5학년' }).getByRole('button')).toContainText('용해와 용액');
  await expect(page.getByRole('region', { name: '6학년' }).getByRole('button')).toContainText('산과 염기');
});

for (const [grade, title, id] of [
  ['4학년', '여러 가지 기체', 'g4-gases'],
  ['5학년', '용해와 용액', 'g5-solution'],
  ['6학년', '산과 염기', 'g6-acid-base'],
] as const) {
  test(`${title} 카드를 누르면 #/unit/${id}로 가고 단원 목록으로 돌아온다`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('region', { name: grade }).getByRole('button').click();
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
