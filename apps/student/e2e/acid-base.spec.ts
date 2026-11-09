import {
  test,
  expect,
  gotoUnit,
  makePng,
  pickSolution,
  predictSolution,
  indicatorButton,
  confirmSafetyDialog,
} from './helpers';
import type { Page } from '@playwright/test';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const feedbackBox = (page: Page) => page.getByRole('heading', { name: '피드백' }).locator('..');

test.beforeEach(async ({ page }) => {
  await gotoUnit(page, 'g6-acid-base', { dev: true });
});

test.afterEach(async ({ page }) => {
  // 학생 화면 어디에도 'pH'라는 말은 나오지 않는다.
  await expect(page.locator('body')).not.toContainText('pH');
});

test('예측하기 전에는 지시약 버튼을 쓸 수 없다', async ({ page }) => {
  await expect(indicatorButton(page, '푸른색 리트머스 종이')).toBeDisabled();
  await pickSolution(page, '식초');
  await expect(indicatorButton(page, '푸른색 리트머스 종이')).toBeDisabled();
  await expect(page.getByText('예측을 먼저 골라 주세요.')).toBeVisible();
  await predictSolution(page, '염기성일 것 같아요');
  await expect(indicatorButton(page, '푸른색 리트머스 종이')).toBeEnabled();
});

test('식초를 염기성으로 예측하고 시험하면 예측과 다르다는 질문이 나온다', async ({ page }) => {
  await pickSolution(page, '식초');
  await predictSolution(page, '염기성일 것 같아요');
  await indicatorButton(page, '푸른색 리트머스 종이').click();
  await expect(tutorBox(page)).toContainText('식초에 대한 예측과 관찰 결과가 달랐네요.');
});

test('위험한 용액은 안전 점검표를 거치고 Esc로 닫으면 시험이 취소된다', async ({ page }) => {
  await pickSolution(page, '묽은 염산');
  await predictSolution(page, '산성일 것 같아요');
  await indicatorButton(page, '푸른색 리트머스 종이').click();

  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole('button', { name: '확인했어요' });
  await expect(confirm).toBeDisabled();
  const boxes = await dialog.getByRole('checkbox').all();
  expect(boxes).toHaveLength(3);
  for (let i = 0; i < boxes.length; i++) {
    await expect(confirm).toBeDisabled();
    await boxes[i]!.check();
  }
  await expect(confirm).toBeEnabled();

  // 포커스는 대화상자 안에 갇힌다.
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByText('지시약을 누르면 결과가 여기에 나타나요.')).toBeVisible();
});

test('모의 보안경 경고가 뜨면 확인 전까지 지시약 버튼이 잠긴다', async ({ page }) => {
  await pickSolution(page, '식초');
  await predictSolution(page, '산성일 것 같아요');
  await expect(indicatorButton(page, '붉은 양배추 지시약')).toBeEnabled();

  await page.getByRole('button', { name: /NO_GOGGLES/ }).click();
  const banner = page.getByRole('alert');
  await expect(banner).toContainText('산성 용액 실험 전 보안경을 먼저 착용해 주세요!');
  await expect(indicatorButton(page, '붉은 양배추 지시약')).toBeDisabled();

  await banner.getByRole('button', { name: '착용했어요' }).click();
  await expect(banner).toBeHidden();
  await expect(indicatorButton(page, '붉은 양배추 지시약')).toBeEnabled();
});

test('붉은 양배추 지시약으로 8가지를 시험하고 분류를 확인한다', async ({ page }) => {
  const acids = ['묽은 염산', '레몬즙', '식초', '탄산수'];
  const bases = ['빨랫비누 물', '유리 세정제', '석회수', '묽은 수산화 나트륨 용액'];

  for (const name of [...acids, ...bases]) {
    await pickSolution(page, name);
    await predictSolution(page, '잘 모르겠어요');
    await indicatorButton(page, '붉은 양배추 지시약').click();
    if (await page.getByRole('dialog', { name: '안전 점검표' }).isVisible()) await confirmSafetyDialog(page);
    await expect(page.getByRole('list', { name: '시험 결과' }).getByRole('listitem')).toContainText('붉은 양배추 지시약');
  }

  const place = async (solution: string, group: string) => {
    await page.getByRole('region', { name: '분류하기' }).getByRole('button', { name: solution, exact: true }).click();
    await page.getByRole('button', { name: `${group}에 놓기` }).click();
  };
  for (const s of acids) await place(s, s === '식초' ? '염기성 용액' : '산성 용액');
  for (const s of bases) await place(s, '염기성 용액');

  const check = page.getByRole('button', { name: '분류 확인하기' });
  await expect(check).toBeEnabled();
  await check.click();
  await expect(feedbackBox(page)).toContainText('식초는 관찰한 지시약 색 변화와 넣은 무리를 다시 비교해 볼까요?');

  await place('식초', '산성 용액');
  await check.click();
  await expect(feedbackBox(page)).toContainText('관찰한 지시약 색 변화와 분류가 서로 잘 맞아요.');
});

test.describe('사진으로 색 읽기', () => {
  test('붉은 양배추 지시약의 연한 붉은색을 읽는다', async ({ page }) => {
    await page.getByLabel('읽을 지시약').selectOption({ label: '붉은 양배추 지시약' });
    await page.locator('input[type="file"]').setInputFiles({ name: 'pink.png', mimeType: 'image/png', buffer: makePng('#c86fa8') });
    await expect(page.getByText('가장 가까운 색: 연한 붉은색')).toBeVisible();
  });

  test('회색 사진은 읽기 어렵다고 알려 준다', async ({ page }) => {
    await page.getByLabel('읽을 지시약').selectOption({ label: '붉은 양배추 지시약' });
    await page.locator('input[type="file"]').setInputFiles({ name: 'gray.png', mimeType: 'image/png', buffer: makePng('#808080') });
    await expect(page.getByText('색을 읽기 어려워요.')).toBeVisible();
  });
});
