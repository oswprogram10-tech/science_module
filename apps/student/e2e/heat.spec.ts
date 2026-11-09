import type { Page } from '@playwright/test';
import {
  test,
  expect,
  gotoUnit,
  selectIV,
  setValue,
  predict,
  runButton,
  resultRows,
  confirmSafetyDialog,
} from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');

/** 실행 버튼이 다시 '▶ 실험 실행'이 될 때까지(재생이 끝날 때까지) 기다린다. */
async function finishRun(page: Page) {
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

test('처음 실행할 때 점검표를 거쳐 기준 시행을 하면 7.6이 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-heat');
  await selectIV(page, '감싸는 재료');
  await predict(page, '줄어든다');

  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('뜨거운 물은 선생님이 따라 주세요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await finishRun(page);

  const row1 = resultRows(page).first();
  await expect(row1).toContainText('7.6'); // 물이 식은 정도
  await expect(row1).toContainText('52.4'); // 10분 뒤 물의 온도
  await expect(row1).toContainText('60.0'); // 처음 컵 바깥 온도(감싸지 않음)
  await expect(page.getByText('물 52.4 °C · 10분')).toBeVisible();
  await expect(page.getByRole('status', { name: '온도 센서 1, 컵 속 물' })).toContainText('°C');
  await expect(page.getByRole('status', { name: '온도 센서 2, 실내 공기' })).toContainText('°C');
});

test('감싸는 재료를 솜으로 바꾸면 식은 정도가 줄고 재료 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g5-heat');
  await selectIV(page, '감싸는 재료');
  await predict(page, '줄어든다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);
  await expect(resultRows(page).first()).toContainText('7.6');

  await setValue(page, '감싸는 재료', '솜');
  await predict(page, '줄어든다');
  await runButton(page).click();
  // 점검표는 한 번만 뜬다.
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeHidden();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('4.9');
  await expect(row2).toContainText('37.8'); // 솜으로 감싼 컵의 처음 바깥 온도
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('감싸는 재료만 바꾸었을 때 열화상 화면에서 컵 바깥의 색은 어떻게 달랐나요?');
});

test('새 페이지에서 겹 수만 바꾸면(감싸지 않음) 변하지 않았다와 겹 수 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g5-heat');
  await selectIV(page, '감싸는 겹 수');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);
  await expect(resultRows(page).first()).toContainText('7.6');

  await setValue(page, '감싸는 겹 수', '2겹');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('7.6');
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('겹 수만 바꾸었을 때 결과가 달라졌나요?');
});

test('열화상 화면에 숫자 온도와 안내 문구가 보인다', async ({ page }) => {
  await gotoUnit(page, 'g5-heat');
  const thermal = page.getByRole('figure', { name: '열화상으로 보기' });
  await expect(thermal.getByText('계산으로 그린 열화상 그림이에요.')).toBeVisible();
  await expect(thermal.getByText('옆면 60.0 °C')).toBeVisible();
  await expect(thermal.getByText('윗면 60.0 °C')).toBeVisible();
  // 색 막대 눈금과 화살표 라벨
  for (const tick of ['60', '40', '20']) await expect(thermal.getByText(tick, { exact: true })).toBeVisible();
  await expect(thermal.getByText(/열이 빠져나가요/)).toBeVisible();

  // 솜으로 감싸면 옆면 바깥이 덜 뜨겁다(숫자로도 보인다).
  await setValue(page, '감싸는 재료', '솜');
  await expect(thermal.getByText('옆면 37.8 °C')).toBeVisible();
  await expect(thermal.getByText('윗면 60.0 °C')).toBeVisible();
  // 뚜껑을 덮으면 윗면도 덜 뜨겁다.
  await setValue(page, '뚜껑', '뚜껑 덮음');
  await expect(thermal.getByText('윗면 46.7 °C')).toBeVisible();
});

test('모의 보안경 경고는 이 단원의 문구로 나온다', async ({ page }) => {
  await gotoUnit(page, 'g5-heat', { dev: true });
  await selectIV(page, '뚜껑');
  await predict(page, '줄어든다');
  await page.getByRole('button', { name: /NO_GOGGLES/ }).click();
  await expect(page.getByRole('alert')).toContainText('뜨거운 물을 다룰 때는 보안경을 착용해 주세요!');
  await expect(runButton(page)).toBeDisabled();
});
