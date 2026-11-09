import { test, expect, gotoUnit, selectIV, setValue, predict, runTrial, runButton, resultRows, sensor } from './helpers';

const R_PRED = '예측을 먼저 골라 주세요.';
const R_IV = '바꿀 조건(조작변인)을 하나 골라 주세요.';

test.beforeEach(async ({ page }) => {
  await gotoUnit(page, 'g5-solution');
});

test('처음에는 실행할 수 없고 이유 두 가지를 알려 준다', async ({ page }) => {
  await expect(runButton(page)).toBeDisabled();
  const reasons = page.getByRole('list').filter({ hasText: R_PRED });
  await expect(reasons.getByRole('listitem').filter({ hasText: R_PRED })).toBeVisible();
  await expect(reasons.getByRole('listitem').filter({ hasText: R_IV })).toBeVisible();
});

test('백반의 온도를 바꿔 두 번 실험하고 결과표와 튜터를 확인한다', async ({ page }) => {
  await setValue(page, '용질의 종류', '백반');
  await selectIV(page, '물의 온도');
  await setValue(page, '물의 온도', '20 °C');
  await predict(page, '늘어난다');
  await runTrial(page);

  await expect(resultRows(page)).toHaveCount(1);
  await expect(resultRows(page).first()).toContainText('5.7');
  await expect(resultRows(page).first()).toContainText('2');

  await setValue(page, '물의 온도', '60 °C');
  await expect(page.getByRole('note')).toContainText('뜨거운 물 주의');
  await predict(page, '늘어난다');
  await runTrial(page);

  await expect(resultRows(page)).toHaveCount(2);
  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('28.7');
  await expect(row2).toContainText('14');
  await expect(row2).toContainText('결과: 늘어났다');
  // 공정한 비교 뒤의 튜터 질문
  await expect(page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..')).toContainText(
    '물의 온도만 바꾸었을 때 녹은 양과 걸린 시간은 각각 어떻게 달라졌나요?',
  );
});

test('물의 양과 물의 온도를 함께 바꾸면 무엇 때문인지 알 수 없다고 알려 준다', async ({ page }) => {
  await setValue(page, '용질의 종류', '백반');
  await selectIV(page, '물의 온도');
  await predict(page, '늘어난다');
  await runTrial(page);

  await setValue(page, '물의 양', '100 mL');
  await setValue(page, '물의 온도', '60 °C');
  await predict(page, '늘어난다');
  await runTrial(page);

  const feedback = page.getByRole('heading', { name: '피드백' }).locator('..');
  await expect(feedback).toContainText('물의 양과 물의 온도가 함께 바뀌어서, 녹은 양이 무엇 때문에 달라졌는지 알 수 없어요.');
});

test('바꿀 조건으로 고른 변인이 그대로면 알려 준다', async ({ page }) => {
  await selectIV(page, '물의 온도');
  await predict(page, '변하지 않는다');
  await runTrial(page);

  await setValue(page, '물의 양', '100 mL');
  await predict(page, '변하지 않는다');
  await runTrial(page);

  const feedback = page.getByRole('heading', { name: '피드백' }).locator('..');
  await expect(feedback).toContainText('바꿀 조건으로 고른 물의 온도는 그대로이고, 물의 양이 바뀌었어요.');
});

test('60 °C를 고르면 뜨거운 물 경고가 보인다', async ({ page }) => {
  await expect(page.getByRole('note')).toHaveCount(0);
  await setValue(page, '물의 온도', '60 °C');
  await expect(page.getByRole('note')).toContainText('뜨거운 물 주의: 60 °C의 물은 화상을 입을 수 있어요.');
});

test('그래프 슬라이더를 키보드로 움직이고 저울이 질량 보존을 보여 준다', async ({ page }) => {
  await setValue(page, '용질의 종류', '백반');
  await selectIV(page, '물의 온도');
  await predict(page, '늘어난다');
  await runTrial(page);

  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await expect(slider).toBeFocused();

  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', /^0초/);

  await page.keyboard.press('End');
  const max = await slider.getAttribute('aria-valuemax');
  await expect(slider).toHaveAttribute('aria-valuenow', max!);

  // 비커 아래 "넣은 용질 X g (N숟가락)"
  const caption = await page.getByRole('img', { name: /^비커:/ }).locator('text').last().textContent();
  const added = Number(/넣은 용질 ([\d.]+) g/.exec(caption ?? '')![1]);
  expect(added).toBeGreaterThan(0);
  const water = 50;
  const text = await sensor(page, '무게').textContent();
  const scale = Number(/[\d.]+/.exec(text ?? '')![0]);
  expect(scale).toBeCloseTo(100 + water + added, 0);
});
