import { test, expect, gotoUnit, selectIV, setValue, predict, runTrial, resultRows, sensor } from './helpers';

const tutorBox = (page: import('@playwright/test').Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');

test('누르는 힘을 바꾸면 부피가 줄고, 기체의 종류를 바꾸면 변하지 않는다', async ({ page }) => {
  await gotoUnit(page, 'g4-gases');
  await selectIV(page, '피스톤을 누르는 힘');
  await predict(page, '줄어든다');
  await runTrial(page);
  await expect(resultRows(page).first()).toContainText('30.0');

  await setValue(page, '피스톤을 누르는 힘', '세게 누름');
  await predict(page, '줄어든다');
  await runTrial(page);
  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('15.0');
  await expect(row2).toContainText('-15.0');

  await selectIV(page, '기체의 종류');
  await setValue(page, '기체의 종류', '산소');
  await predict(page, '변하지 않는다');
  await runTrial(page);
  const row3 = resultRows(page).nth(2);
  await expect(row3).toContainText('15.0');
  await expect(row3).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('기체의 종류만 바꾸었을 때 부피 변화가 달라졌나요?');
});

test('물의 온도를 60 °C로 올리면 부피가 늘고 압력 센서는 kPa로 보인다', async ({ page }) => {
  await gotoUnit(page, 'g4-gases');
  await selectIV(page, '주사기를 담근 물의 온도');
  await predict(page, '늘어난다');
  await runTrial(page);
  await expect(resultRows(page).first()).toContainText('30.0');

  await setValue(page, '주사기를 담근 물의 온도', '60 °C');
  await predict(page, '늘어난다');
  await runTrial(page);
  const row2 = resultRows(page).nth(1);
  await expect(row2).toContainText('34.1');
  await expect(row2).toContainText('+4.1');

  await expect(sensor(page, '압력')).toContainText('kPa');
});
