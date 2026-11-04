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
  sensor,
  confirmSafetyDialog,
} from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');

/** 실행을 누르고 재생이 끝날 때까지 기다린다(점검표는 따로 다룬다). */
async function finishRun(page: Page) {
  const run = runButton(page);
  await expect(run).toHaveText('▶ 실험 실행');
}

test('처음 실행할 때 안전 점검표가 뜨고 Esc를 누르면 실행되지 않는다', async ({ page }) => {
  await gotoUnit(page, 'g6-combustion');
  await selectIV(page, '집기병의 크기');
  await predict(page, '늘어난다');

  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: '확인했어요' })).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(resultRows(page)).toHaveCount(1);
  await expect(page.getByText('아직 실험한 결과가 없어요.')).toBeVisible();
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
});

test('점검표를 확인하면 실행되고, 집기병을 키우면 걸린 시간이 늘어난다', async ({ page }) => {
  await gotoUnit(page, 'g6-combustion');
  await selectIV(page, '집기병의 크기');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);

  const row1 = resultRows(page).first();
  await expect(row1).toContainText('17.2'); // 가는 초 1개, 500 mL 기준값
  await expect(row1).toContainText('25.0'); // 쓰인 산소의 양(mL) = 500 × 5%
  await expect(page.getByText('불이 꺼졌어요 · 17.2초')).toBeVisible();
  await expect(sensor(page, '산소')).toContainText('%');
  await expect(sensor(page, '이산화 탄소')).toContainText('%');

  // 확인 상태는 유지되므로 두 번째부터는 점검표 없이 바로 실행된다.
  await setValue(page, '집기병의 크기', '큰 집기병 1000 mL');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeHidden();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('34.4');
  await expect(row2).toContainText('50.0');
  await expect(row2).toContainText('결과: 늘어났다');
});

test('초의 색깔만 바꾸면 걸린 시간이 변하지 않고 색깔 전용 질문이 나온다', async ({ page }) => {
  await gotoUnit(page, 'g6-combustion');
  await selectIV(page, '초의 색깔');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await finishRun(page);

  await setValue(page, '초의 색깔', '빨간색 초');
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await finishRun(page);

  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('17.2');
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('초의 색깔만 바꾸었을 때 걸린 시간이 달라졌나요?');
});

test('모의 보안경 경고가 뜨면 확인 전까지 실행 버튼이 잠긴다', async ({ page }) => {
  await gotoUnit(page, 'g6-combustion', { dev: true });
  await selectIV(page, '초의 개수');
  await predict(page, '줄어든다');
  await expect(runButton(page)).toBeEnabled();

  await page.getByRole('button', { name: /NO_GOGGLES/ }).click();
  const banner = page.getByRole('alert');
  await expect(banner).toContainText('불을 다루기 전에 보안경을 먼저 착용해 주세요!');
  await expect(runButton(page)).toBeDisabled();
  await expect(page.getByText('안전 경고를 먼저 확인해 주세요.')).toBeVisible();

  await banner.getByRole('button', { name: '착용했어요' }).click();
  await expect(banner).toBeHidden();
  await expect(runButton(page)).toBeEnabled();
});
