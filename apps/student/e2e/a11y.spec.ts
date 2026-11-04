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
  setValue,
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

test('g5-heat 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g5-heat', { dev: true });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g5-heat 안전 점검표가 열린 상태', async ({ page }) => {
  await gotoUnit(page, 'g5-heat');
  await selectIV(page, '감싸는 재료');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g5-heat 한 번 실험한 뒤', async ({ page }) => {
  await gotoUnit(page, 'g5-heat');
  await selectIV(page, '감싸는 재료');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await expectNoSeriousViolations(page);
});

test('g5-heat 솜으로 감싸고 뚜껑을 덮은 뒤', async ({ page }) => {
  await gotoUnit(page, 'g5-heat');
  await selectIV(page, '감싸는 재료');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await setValue(page, '감싸는 재료', '솜');
  await setValue(page, '뚜껑', '뚜껑 덮음');
  await expectNoSeriousViolations(page);
});

test('g5-light 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g5-light', { dev: true });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g5-light 안전 점검표가 열린 상태', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  await selectIV(page, '렌즈와 종이 사이 거리');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g5-light 종이가 그을린 상태', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  await selectIV(page, '렌즈와 종이 사이 거리');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await setValue(page, '렌즈와 종이 사이 거리', '10 cm');
  await predict(page, '늘어난다');
  await runTrial(page);
  await expect(page.getByText('⚠ 종이가 그을리고 있어요. 실제 실험에서는 바로 렌즈를 치워요.')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g5-light 조금 볼록한 큰 렌즈로 바꾼 뒤', async ({ page }) => {
  await gotoUnit(page, 'g5-light');
  await setValue(page, '렌즈가 볼록한 정도', '조금 볼록한 렌즈');
  await setValue(page, '렌즈의 크기', '큰 렌즈 (지름 8 cm)');
  await setValue(page, '렌즈와 종이 사이 거리', '20 cm');
  await expectNoSeriousViolations(page);
});

test('g6-electricity 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity', { dev: true });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-electricity 안전 점검표가 열린 상태', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await selectIV(page, '전지 연결');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-electricity 에나멜선이 뜨거워진 뒤(켜진 상태와 꺼진 상태)', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await selectIV(page, '전지 연결');
  await setValue(page, '에나멜선을 감은 횟수', '50회');
  await setValue(page, '전지 연결', '전지 2개 직렬 연결');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await expect(page.getByText('⚠ 에나멜선이 40 °C 넘게 뜨거워졌어요. 실제 실험에서는 오래 연결하지 않아요.')).toBeVisible();
  await expectNoSeriousViolations(page);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  for (let i = 0; i < 6; i++) await slider.press('PageUp');
  await expect(page.getByText('스위치 켜짐 · 클립 18개 · ⚠ 에나멜선이 뜨거워요')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-electricity 빨대, 병렬, 반대 방향으로 바꾼 뒤', async ({ page }) => {
  await gotoUnit(page, 'g6-electricity');
  await setValue(page, '속에 넣은 것', '빨대만 (철못 없음)');
  await setValue(page, '전지 연결', '전지 2개 병렬 연결');
  await setValue(page, '전지 방향', '반대 방향');
  await expectNoSeriousViolations(page);
});
