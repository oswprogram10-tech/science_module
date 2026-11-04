import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  test,
  expect,
  gotoUnit,
  selectIV,
  predict,
  runTrial,
  runButton,
  confirmSafetyDialog,
  pickSolution,
  predictSolution,
  indicatorButton,
} from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(report, '심각한 접근성 위반이 없어야 해요').toEqual([]);
}

test('단원 목록', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g4-gases 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g4-gases');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g5-solution 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g5-solution');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g5-solution 한 번 실험한 뒤', async ({ page }) => {
  await gotoUnit(page, 'g5-solution');
  await selectIV(page, '물의 온도');
  await predict(page, '늘어난다');
  await runTrial(page);
  await expectNoSeriousViolations(page);
});

test('g6-acid-base 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g6-acid-base', { dev: true });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-acid-base 안전 점검표가 열린 상태', async ({ page }) => {
  await gotoUnit(page, 'g6-acid-base', { dev: true });
  await pickSolution(page, '묽은 염산');
  await predictSolution(page, '산성일 것 같아요');
  await indicatorButton(page, '푸른색 리트머스 종이').click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-combustion 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g6-combustion', { dev: true });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-combustion 안전 점검표가 열린 상태', async ({ page }) => {
  await gotoUnit(page, 'g6-combustion');
  await selectIV(page, '집기병의 크기');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-combustion 한 번 실험한 뒤', async ({ page }) => {
  await gotoUnit(page, 'g6-combustion');
  await selectIV(page, '집기병의 크기');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await expectNoSeriousViolations(page);
});

test('g6-combustion 안전 경고 배너가 떠 있는 상태', async ({ page }) => {
  await gotoUnit(page, 'g6-combustion', { dev: true });
  await page.getByRole('button', { name: /NO_GOGGLES/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expectNoSeriousViolations(page);
});
