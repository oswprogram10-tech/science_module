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
  createClass,
  rawStudent,
  studentUrl,
  sortCard,
  sortCheckButton,
  sortChoose,
  sortAll,
  sortPutButton,
  materialCard,
  materialFinishCriterion,
  materialObserveButton,
  materialSortAll,
  gotoMixtureSort,
  mixtureCard,
  mixtureFinishCriterion,
  mixtureObserveButton,
  mixtureSortAll,
  gotoWeatherSort,
  weatherCard,
  weatherFinishCriterion,
  weatherObserveButton,
  weatherSortAll,
  strataCard,
  strataFill,
  strataFinishEnv,
  strataObserveButton,
  strataOrderCheck,
  strataSlotButton,
  sortFinishCriterion,
  sortObserveButton,
  treeNode,
  treeSplit,
  LEAF_CARDS,
} from './helpers';
import type { Locator } from '@playwright/test';

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

test('g4-land 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g4-land', { dev: true });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g4-land 안전 점검표가 열린 상태', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await selectIV(page, '식히는 곳');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g4-land 다 굳은 뒤(비교 카드와 그래프 표식)와 중간에 멈춘 상태', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await selectIV(page, '식히는 곳');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await expect(page.getByText('중간 크기예요')).toBeVisible();
  await expectNoSeriousViolations(page);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  for (let i = 0; i < 4; i++) await slider.press('PageUp');
  await expect(page.getByText(/°C · 굳는 중$/)).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g4-land 검은색 색소, 알루미늄 접시, 얼음물 위로 바꾼 뒤', async ({ page }) => {
  await gotoUnit(page, 'g4-land');
  await setValue(page, '물질의 색깔', '검은색 색소를 넣음');
  await setValue(page, '담은 접시', '알루미늄 접시');
  await setValue(page, '식히는 곳', '얼음물 위');
  await expectNoSeriousViolations(page);
});

test('g4-land 어두운 화면에서 다 굳은 뒤', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await gotoUnit(page, 'g4-land');
  await setValue(page, '식히는 곳', '따뜻한 물 위');
  await selectIV(page, '식히는 곳');
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await expectNoSeriousViolations(page);
});

// ---- g6-earth-motion ----

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
async function earthPick(page: Page, title: string, prediction: string) {
  await region(page, '과제 목록').getByRole('button', { name: new RegExp(`^${title}`) }).click();
  await region(page, '예측').getByRole('button', { name: prediction, exact: true }).click();
}
const earthSlider = (page: Page, name: '시각' | '달'): Locator => page.getByRole('slider', { name, exact: true });

test('g6-earth-motion 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g6-earth-motion');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-earth-motion 태양 과제를 조작하고 기록한 뒤(낮, 만약에)', async ({ page }) => {
  await gotoUnit(page, 'g6-earth-motion');
  await earthPick(page, '하루 동안 태양의 움직임', '동쪽에서 서쪽으로');
  await earthSlider(page, '시각').fill('9');
  await region(page, '관찰 기록').getByRole('button', { name: '동쪽에서 서쪽으로', exact: true }).click();
  await expectNoSeriousViolations(page);
  await region(page, '관찰하기').getByRole('button', { name: /\(만약에\)/ }).click();
  await region(page, '관찰 기록').getByRole('button', { name: '동쪽에서 서쪽으로', exact: true }).click();
  await expect(page.getByText('관찰 화면을 다시 살펴볼까요?')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-earth-motion 낮과 밤 과제(반대편 표시, 밤)', async ({ page }) => {
  await gotoUnit(page, 'g6-earth-motion');
  await earthPick(page, '낮과 밤', '낮이에요');
  await earthSlider(page, '시각').fill('2');
  await expectNoSeriousViolations(page);
});

test('g6-earth-motion 별 과제(밤하늘, 별자리 이름)', async ({ page }) => {
  await gotoUnit(page, 'g6-earth-motion');
  await earthPick(page, '밤하늘 별의 움직임', '동쪽에서 서쪽으로');
  await earthSlider(page, '시각').fill('22');
  await expect(page.getByTestId('constellation-orion')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-earth-motion 계절 별자리 과제(공전 그림)', async ({ page }) => {
  await gotoUnit(page, 'g6-earth-motion');
  await earthPick(page, '계절에 따라 보이는 별자리', '계절이 바뀌어도 같아요');
  await earthSlider(page, '달').fill('1');
  await expectNoSeriousViolations(page);
});

test('g6-earth-motion 어두운 화면: 처음, 낮, 별, 계절', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await gotoUnit(page, 'g6-earth-motion');
  await expectNoSeriousViolations(page);
  await earthPick(page, '하루 동안 태양의 움직임', '동쪽에서 서쪽으로');
  await earthSlider(page, '시각').fill('9');
  await region(page, '관찰 기록').getByRole('button', { name: '동쪽에서 서쪽으로', exact: true }).click();
  await expectNoSeriousViolations(page);
  await earthPick(page, '밤하늘 별의 움직임', '동쪽에서 서쪽으로');
  await earthSlider(page, '시각').fill('22');
  await expectNoSeriousViolations(page);
  await earthPick(page, '계절에 따라 보이는 별자리', '계절마다 달라져요');
  await earthSlider(page, '달').fill('8');
  await expectNoSeriousViolations(page);
});

// ---- g6-seasons ----

const SEASON_IV = '계절(공전 위치)을 바꿀 조건으로 고르기';

async function seasonsRun(page: Page) {
  await page.getByRole('radio', { name: SEASON_IV }).check();
  await predict(page, '늘어난다');
  await runButton(page).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

test('g6-seasons 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-seasons 안전 점검표가 열린 상태', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await page.getByRole('radio', { name: SEASON_IV }).check();
  await predict(page, '늘어난다');
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-seasons 실행한 뒤(그래프 표식)와 한밤(그래프 시각을 처음으로)', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await seasonsRun(page);
  await expect(page.getByRole('figure', { name: '그래프로 보기' }).getByTestId('graph-marker')).toBeVisible();
  await expectNoSeriousViolations(page);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(page.getByText('0시 0분 · 태양이 지평선 아래에 있어요')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-seasons 여름, 기울기 0°, 겨울·30°·20 cm로 바꾼 뒤', async ({ page }) => {
  await gotoUnit(page, 'g6-seasons');
  await setValue(page, '계절(공전 위치)', '여름');
  await expectNoSeriousViolations(page);
  await setValue(page, '자전축 기울기', '기울지 않음');
  await expectNoSeriousViolations(page);
  await setValue(page, '계절(공전 위치)', '겨울');
  await setValue(page, '자전축 기울기', '30° (만약에)');
  await setValue(page, '막대 길이', '20 cm');
  await expect(page.getByText('→ 더 길어요')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-seasons 어두운 화면: 처음, 여름 실행 뒤, 한밤, 기울기 0°', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await gotoUnit(page, 'g6-seasons');
  await expectNoSeriousViolations(page);
  await setValue(page, '계절(공전 위치)', '여름');
  await seasonsRun(page);
  await expectNoSeriousViolations(page);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expectNoSeriousViolations(page);
  await setValue(page, '자전축 기울기', '기울지 않음');
  await expectNoSeriousViolations(page);
});

// ---- g3-lifecycle ----

async function lifecycleRun(page: Page) {
  await selectIV(page, '물');
  await predict(page, '늘어난다');
  await runTrial(page);
}

test('g3-lifecycle 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g3-lifecycle');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g3-lifecycle 실행한 뒤(그래프 표식)와 0일째, 어두운 곳·냉장고', async ({ page }) => {
  await gotoUnit(page, 'g3-lifecycle');
  await lifecycleRun(page);
  await expect(page.getByRole('figure', { name: '그래프로 보기' }).getByTestId('graph-marker')).toBeVisible();
  await expectNoSeriousViolations(page);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(page.getByText('0일째 · 싹 튼 씨앗 0개')).toBeVisible();
  await expectNoSeriousViolations(page);
  await setValue(page, '빛', '어두운 곳');
  await setValue(page, '온도', '냉장고');
  await expect(page.getByText('상자를 덮음')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g3-lifecycle 어두운 화면: 처음, 실행 뒤, 어두운 곳·따뜻한 곳, 물 없음', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await gotoUnit(page, 'g3-lifecycle');
  await expectNoSeriousViolations(page);
  await lifecycleRun(page);
  await expectNoSeriousViolations(page);
  await setValue(page, '빛', '어두운 곳');
  await setValue(page, '온도', '따뜻한 곳');
  await expectNoSeriousViolations(page);
  await setValue(page, '물', '물을 주지 않음');
  await expectNoSeriousViolations(page);
});

// ---- g6-plant ----

async function plantRun(page: Page) {
  await selectIV(page, '잎의 수');
  await predict(page, '줄어든다');
  await runTrial(page);
}

test('g6-plant 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-plant 실행한 뒤(그래프 표식)와 0시간째, 잎 0장·어두운 곳·바람', async ({ page }) => {
  await gotoUnit(page, 'g6-plant');
  await plantRun(page);
  await expect(page.getByRole('figure', { name: '그래프로 보기' }).getByTestId('graph-marker')).toBeVisible();
  await expectNoSeriousViolations(page);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(page.getByText('0시간 · 남은 물 100.0 mL')).toBeVisible();
  await expectNoSeriousViolations(page);
  // 시행이 있으면 그림은 그 시행의 조건을 보여 주므로, 새 화면에서 조건을 바꿔 본다.
  await gotoUnit(page, 'g6-plant');
  await page.reload();
  await setValue(page, '빛', '어두운 곳');
  await setValue(page, '바람', '선풍기 약하게');
  await expect(page.getByText('선풍기', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page);
  await setValue(page, '잎의 수', '0장');
  await expect(page.getByText('잎을 딴 자국')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g6-plant 어두운 화면: 처음, 실행 뒤, 어두운 곳·바람, 잎 0장', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await gotoUnit(page, 'g6-plant');
  await expectNoSeriousViolations(page);
  await plantRun(page);
  await expectNoSeriousViolations(page);
  await page.reload();
  await setValue(page, '빛', '어두운 곳');
  await setValue(page, '바람', '선풍기 약하게');
  await expect(page.getByText('선풍기', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page);
  await setValue(page, '잎의 수', '0장');
  await expectNoSeriousViolations(page);
});

// ---- g4-ecosystem ----

async function ecosystemRun(page: Page) {
  await selectIV(page, '처음 여우 수');
  await predict(page, '줄어든다');
  await runTrial(page);
}

test('g4-ecosystem 처음 화면', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g4-ecosystem 실행한 뒤(그래프 범례·표식)와 0일째, 여우 0마리·비 많이·토끼 20마리', async ({ page }) => {
  await gotoUnit(page, 'g4-ecosystem');
  await ecosystemRun(page);
  await expect(page.getByRole('figure', { name: '그래프로 보기' }).getByTestId('graph-legend-item')).toHaveCount(3);
  await expectNoSeriousViolations(page);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(page.getByText('0일째 · 풀 80% · 토끼 10마리 · 여우 2마리')).toBeVisible();
  await expectNoSeriousViolations(page);
  // 시행이 있으면 그림은 그 시행의 조건을 보여 주므로, 새 화면에서 조건을 바꿔 본다.
  await gotoUnit(page, 'g4-ecosystem');
  await page.reload();
  await setValue(page, '처음 여우 수', '0마리 (여우 없음)');
  await expect(page.getByText('여우가 없어요')).toBeVisible();
  await expect(page.getByText('없음', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page);
  await setValue(page, '비가 오는 정도', '많이');
  await setValue(page, '처음 토끼 수', '20마리');
  await setValue(page, '토끼 털 색', '갈색');
  await expectNoSeriousViolations(page);
});

test('g4-ecosystem 어두운 화면: 처음, 실행 뒤, 여우 0마리·비 많이', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await gotoUnit(page, 'g4-ecosystem');
  await expectNoSeriousViolations(page);
  await ecosystemRun(page);
  await expectNoSeriousViolations(page);
  await page.reload();
  await setValue(page, '처음 여우 수', '0마리 (여우 없음)');
  await expect(page.getByText('여우가 없어요')).toBeVisible();
  await expectNoSeriousViolations(page);
  await setValue(page, '비가 오는 정도', '많이');
  await setValue(page, '토끼 털 색', '갈색');
  await expectNoSeriousViolations(page);
});

// ---- g4-microbe ----

async function microbeRun(page: Page) {
  await selectIV(page, '온도');
  await predict(page, '늘어난다');
  await page.getByRole('button', { name: '▶ 실험 실행' }).click();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

test('g4-microbe 처음 화면과 안전 점검표가 열린 상태', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
  await selectIV(page, '온도');
  await predict(page, '늘어난다');
  await page.getByRole('button', { name: '▶ 실험 실행' }).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g4-microbe 실행한 뒤(그래프 표식)와 0일째, 배율 ×400·×40, 마른 빵·냉장고·어두운 곳', async ({ page }) => {
  await gotoUnit(page, 'g4-microbe');
  await microbeRun(page);
  await expect(page.getByRole('figure', { name: '그래프로 보기' }).getByTestId('graph-marker')).toBeVisible();
  await expectNoSeriousViolations(page);
  const micro = page.getByRole('figure', { name: '가상 현미경으로 보기' });
  await micro.getByRole('button', { name: '×400', exact: true }).click();
  await expectNoSeriousViolations(page);
  await micro.getByRole('button', { name: '×40', exact: true }).click();
  await expectNoSeriousViolations(page);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(page.getByText('0일째 · 곰팡이가 덮은 넓이 0%')).toBeVisible();
  await expectNoSeriousViolations(page);
  // 시행이 있으면 그림은 그 시행의 조건을 보여 주므로, 새 화면에서 조건을 바꿔 본다.
  await page.reload();
  await setValue(page, '빵의 물기', '마른 빵');
  await setValue(page, '온도', '냉장고');
  await setValue(page, '빛', '어두운 곳');
  await expect(page.getByText('지퍼 봉지 · 어두운 곳')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('g4-microbe 어두운 화면: 처음, 점검표, 실행 뒤, 배율 ×400, 마른 빵·어두운 곳', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await gotoUnit(page, 'g4-microbe');
  await expectNoSeriousViolations(page);
  await selectIV(page, '온도');
  await predict(page, '늘어난다');
  await page.getByRole('button', { name: '▶ 실험 실행' }).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
  await expectNoSeriousViolations(page);
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await expectNoSeriousViolations(page);
  await page.getByRole('figure', { name: '가상 현미경으로 보기' }).getByRole('button', { name: '×400', exact: true }).click();
  await expectNoSeriousViolations(page);
  await page.reload();
  await setValue(page, '빵의 물기', '마른 빵');
  await setValue(page, '빛', '어두운 곳');
  await expect(page.getByText('지퍼 봉지 · 어두운 곳')).toBeVisible();
  await expectNoSeriousViolations(page);
});

// ---- g3-animal ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g3-animal ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 돋보기와 관찰 기록, 다시 비교하기, 두 기준을 끝낸 뒤`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g3-animal');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);

    await sortChoose(page, '다리가 있나요?');
    await sortCard(page, '게').click();
    await sortObserveButton(page, '다리').click();
    await sortObserveButton(page, '사는 곳').click();
    await expect(page.getByRole('list', { name: '게 관찰 기록' })).toContainText('다리가 10개 있어요.');
    await expectNoSeriousViolations(page);

    await sortAll(page, 'legs', { override: { 게: '다리가 없다' } });
    await sortCheckButton(page).click();
    await expect(page.getByText('게는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?')).toBeVisible();
    await expectNoSeriousViolations(page);

    // 게를 옮겨 첫 기준을 끝내고, 두 번째 기준까지 끝낸다.
    await sortCard(page, '게').click();
    await page.getByRole('button', { name: '다리가 있다에 넣기', exact: true }).click();
    await sortCheckButton(page).click();
    await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
    await sortFinishCriterion(page, 'habitat');
    await expect(page.getByText('두 가지 기준으로 분류했어요!')).toBeVisible();
    await expectNoSeriousViolations(page);

    await sortChoose(page, '귀여운가요?');
    await expectNoSeriousViolations(page);
  });
}

// ---- g3-material ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g3-material ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 시험 결과 그림, 다시 비교하기, 두 기준을 끝낸 뒤`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g3-material');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);

    await sortChoose(page, '손으로 눌러도 모양이 그대로인가요?');
    await materialCard(page, '알루미늄 포일').click();
    await materialObserveButton(page, 'hard').click();
    await materialObserveButton(page, 'bends').click();
    await materialObserveButton(page, 'absorbs').click();
    await expect(page.locator('svg .mat-result')).not.toHaveCount(0);
    await expectNoSeriousViolations(page);
    await materialCard(page, '나무 블록').click();
    await materialObserveButton(page, 'absorbs').click();
    await expect(page.locator('svg .mat-stain')).toHaveCount(1);
    await expectNoSeriousViolations(page);

    await materialSortAll(page, 'hard', { override: { '알루미늄 포일': '그대로이다' } });
    await sortCheckButton(page).click();
    await expect(page.getByText('알루미늄 포일은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?')).toBeVisible();
    await expectNoSeriousViolations(page);

    await materialCard(page, '알루미늄 포일').click();
    await sortPutButton(page, '모양이 변한다').click();
    await sortCheckButton(page).click();
    await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
    await materialFinishCriterion(page, 'bends');
    await expect(page.getByText('두 가지 기준으로 분류했어요!')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g5-mixture 두 번째 활동(활동 탭, 분리 방법 고르기) ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g5-mixture 활동 탭 ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 첫 활동의 탭, 분리 방법 고르기 처음, 결과 그림, 다시 비교하기, 두 기준을 끝낸 뒤`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    // 단원 목록의 "활동 2개" 표시
    await page.goto('/');
    // 활동이 둘인 단원은 땅의 변화, 혼합물의 분리, 지구와 바다, 날씨와 우리 생활 네 곳이다.
    await expect(page.getByText('활동 2개')).toHaveCount(4);
    await expect(page.getByText('활동 2개').first()).toBeVisible();
    await expectNoSeriousViolations(page);
    // 첫 활동 화면의 활동 탭
    await gotoUnit(page, 'g5-mixture');
    await expect(page.getByRole('tablist', { name: '활동 고르기' })).toBeVisible();
    await expectNoSeriousViolations(page);

    await gotoMixtureSort(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^활동 2 · / })).toHaveAttribute('aria-selected', 'true');
    await expectNoSeriousViolations(page);

    await sortChoose(page, '한 가지가 자석에 붙나요?');
    await mixtureCard(page, '철 가루와 모래').click();
    await mixtureObserveButton(page, 'size').click();
    await mixtureObserveButton(page, 'magnet').click();
    await mixtureObserveButton(page, 'dissolve').click();
    await expect(page.locator('svg .mix-result')).not.toHaveCount(0);
    await expectNoSeriousViolations(page);
    await mixtureCard(page, '소금과 모래').click();
    await mixtureObserveButton(page, 'dissolve').click();
    await expect(page.locator('svg .mix-gone')).toHaveCount(1);
    await expectNoSeriousViolations(page);

    await mixtureSortAll(page, 'magnet', { override: { '철 구슬과 유리 구슬': '붙지 않는다' } });
    await sortCheckButton(page).click();
    await expect(page.getByText('철 구슬과 유리 구슬은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?')).toBeVisible();
    await expectNoSeriousViolations(page);

    await mixtureCard(page, '철 구슬과 유리 구슬').click();
    await sortPutButton(page, '붙는다').click();
    await sortCheckButton(page).click();
    await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
    await mixtureFinishCriterion(page, 'dissolve');
    await expect(page.getByText('두 가지 기준으로 분류했어요!')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g5-weather 두 번째 활동(활동 탭, 이슬·안개·구름 비교하기) ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g5-weather 활동 탭 ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 첫 활동의 탭, 이슬·안개·구름 비교하기 처음, 결과 그림, 다시 비교하기, 두 기준을 끝낸 뒤`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    // 첫 활동 화면의 활동 탭
    await gotoUnit(page, 'g5-weather');
    await expect(page.getByRole('tablist', { name: '활동 고르기' })).toBeVisible();
    await expectNoSeriousViolations(page);

    await gotoWeatherSort(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^활동 2 · / })).toHaveAttribute('aria-selected', 'true');
    await expectNoSeriousViolations(page);

    await sortChoose(page, '물체의 겉에 붙어 있나요?');
    await weatherCard(page, '새벽 강가를 덮은 뿌연 공기').click();
    await weatherObserveButton(page, 'surface').click();
    await weatherObserveButton(page, 'air').click();
    await weatherObserveButton(page, 'high').click();
    await expect(page.locator('svg .wx-result')).not.toHaveCount(0);
    await expectNoSeriousViolations(page);
    await weatherCard(page, '하늘 높이 떠 있는 하얀 구름').click();
    await weatherObserveButton(page, 'high').click();
    await expect(page.locator('svg .wx-high')).toHaveCount(1);
    await expectNoSeriousViolations(page);

    await weatherSortAll(page, 'surface', { override: { '새벽 강가를 덮은 뿌연 공기': '붙어 있다' } });
    await sortCheckButton(page).click();
    await expect(page.getByText('새벽 강가를 덮은 뿌연 공기는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?')).toBeVisible();
    await expectNoSeriousViolations(page);

    await weatherCard(page, '새벽 강가를 덮은 뿌연 공기').click();
    await sortPutButton(page, '붙어 있지 않다').click();
    await sortCheckButton(page).click();
    await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
    await weatherFinishCriterion(page, 'high');
    await expect(page.getByText('두 가지 기준으로 분류했어요!')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g5-strata ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g5-strata ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 화석 그림, 어긋난 순서 확인, 환경 칸, 완료 뒤`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g5-strata');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);

    await strataCard(page, '석회암').click();
    await strataObserveButton(page, '높이 확인하기').click();
    await strataObserveButton(page, '알갱이 살펴보기').click();
    await strataObserveButton(page, '화석 살펴보기').click();
    await expect(page.getByTestId('fossil-shape')).toHaveCount(1);
    await expectNoSeriousViolations(page);

    await strataFill(page, ['역암', '이암', '사암', '석회암', '셰일']);
    await strataOrderCheck(page).click();
    await expect(page.getByText('사암, 이암은 이웃한 칸의 표본과 채집한 높이를 견주어 보면 차례가 맞지 않아요.')).toBeVisible();
    await expectNoSeriousViolations(page);

    await strataCard(page, '사암').click();
    await strataSlotButton(page, 2).click();
    await strataOrderCheck(page).click();
    await expect(page.getByRole('button', { name: '환경 확인하기' })).toBeVisible();
    await expectNoSeriousViolations(page);

    await strataFinishEnv(page);
    await expect(page.getByText('지층의 차례와 그때의 환경을 모두 알아냈어요!')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g3-plantlife ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g3-plantlife ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 돋보기, 첫 나눔, 한쪽으로 모인 노드, 비활성 질문, 다 나눈 뒤`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g3-plantlife');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);

    await sortChoose(page, '잎맥이 나란한가요?');
    await sortCard(page, '단풍나무').click();
    await sortObserveButton(page, '잎맥').click();
    await sortObserveButton(page, '갈라짐').click();
    await expect(page.getByRole('list', { name: '단풍나무 관찰 기록' })).toContainText('손바닥처럼 5~7갈래로 깊게 갈라져 있어요.');
    await expectNoSeriousViolations(page);
    await sortCard(page, '단풍나무').click();

    await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
    await expect(treeNode(page, 'r/yes')).toBeVisible();
    await expectNoSeriousViolations(page);

    await treeNode(page, 'r/no').click();
    await expect(page.getByText('위에서 이미 쓴 질문이에요')).toBeVisible();
    await expectNoSeriousViolations(page);

    await treeSplit(page, 'r/yes', 'serrated', ['붓꽃', '백합']);
    await expect(page.getByText('모든 잎이 한쪽으로 모였어요.').first()).toBeVisible();
    await expectNoSeriousViolations(page);

    await treeSplit(page, 'r/no', 'serrated', ['단풍나무', '국화', '벚나무', '동백나무', '감나무', '라일락']);
    await treeSplit(page, 'r/no/yes', 'lobed', ['단풍나무', '국화', '벚나무', '동백나무']);
    await expect(page.getByText('더 나눌 수 없을 때까지 나누었어요!')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g5-body ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g5-body ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 점검표, 실행 뒤, 달리기·앉기·오른손, 내 맥박 허가 화면과 측정 칸`, async ({ page }) => {
    // 검사가 많아 오래 걸리고, 가짜 시계로 15초를 건너뛰므로 움직임 줄이기로 그림 반복을 멈춘다.
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await gotoUnit(page, 'g5-body');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '운동 종류');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByRole('figure', { name: '그래프로 보기' }).getByTestId('graph-marker')).toHaveCount(2);
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '운동 종류', '제자리 달리기');
    await expectNoSeriousViolations(page);
    await setValue(page, '운동 종류', '가만히 앉아 있기');
    await setValue(page, '맥박을 잰 손목', '오른손 손목');
    await expectNoSeriousViolations(page);
    // 내 맥박 재기: 허가 화면, 허가 전(비활성 버튼), 허가 뒤 값이 있는 칸
    await page.locator('details.real-pulse summary').click();
    await expect(page.getByRole('dialog', { name: '내 맥박 재기' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.getByRole('button', { name: '안 할래요' }).click();
    await expectNoSeriousViolations(page);
    await page.getByRole('button', { name: '허가 화면 열기' }).click();
    await page.getByRole('button', { name: '허가할게요' }).click();
    await page.clock.install();
    const row = page.locator('[data-slot=before]');
    await row.getByRole('button', { name: '15초 재기' }).click();
    await expectNoSeriousViolations(page);
    await page.clock.runFor(16_000);
    await row.getByLabel('15초 동안 센 횟수').fill('19');
    await expectNoSeriousViolations(page);
    await row.getByRole('button', { name: '기록(×4)' }).click();
    await expect(row.getByLabel('운동 전 내 맥박')).toHaveText('76회/분');
    await expectNoSeriousViolations(page);
  });
}

// ---- g3-force ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g3-force ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 실행 뒤(수평), 오른쪽이 내려감, 왼쪽이 내려감, 정육면체`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g3-force');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '오른쪽 추의 거리');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('기울어진 쪽: 수평이에요 · 오른쪽 끝 높이 10 cm')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '오른쪽 추의 거리', '받침점에서 8칸');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByTestId('touch-mark')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '오른쪽 추의 수', '1개');
    await setValue(page, '추의 모양', '정육면체');
    await expectNoSeriousViolations(page);
    await selectIV(page, '오른쪽 추의 수');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByTestId('touch-mark')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g3-sound ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g3-sound ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 실행 뒤(약하게 20 cm), 15 cm와 앞 시행, 세게`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g3-sound');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '떨리는 줄의 길이');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('1초 동안 330번 떨려요 · 소리의 크기 62.0')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '떨리는 줄의 길이', '15 cm');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('1초 동안 440번 떨려요 · 소리의 크기 62.0')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '튕기는 세기', '세게');
    await setValue(page, '고무줄 색', '노란색');
    await expectNoSeriousViolations(page);
    await selectIV(page, '튕기는 세기');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('1초 동안 330번 떨려요 · 소리의 크기 70.0')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g4-magnet ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g4-magnet ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 점검표, 실행 뒤(0.5 cm), 철판, 자석 2개 0 cm 종이`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g4-magnet');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '자석과 클립 사이의 거리');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('6.0초 · 자석 높이 5.0 cm · 붙은 클립 5개')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '사이에 둔 물체', '얇은 철판');
    await selectIV(page, '사이에 둔 물체');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('6.0초 · 자석 높이 5.0 cm · 붙은 클립 0개')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '자석의 수', '2개 (겹쳐서)');
    await setValue(page, '자석과 클립 사이의 거리', '0 cm (닿게)');
    await setValue(page, '사이에 둔 물체', '종이');
    await expectNoSeriousViolations(page);
    await selectIV(page, '사이에 둔 물체');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('6.0초 · 자석 높이 5.0 cm · 붙은 클립 19개')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g6-motion ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g6-motion ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 실행 뒤(20 cm), 40 cm와 앞 시행, 수건·추 2개`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g6-motion');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '출발 높이');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('1.2초 · 출발선에서 1.50 m · 1 m까지 0.55초')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '출발 높이', '40 cm');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('1.2초 · 출발선에서 1.50 m · 1 m까지 0.38초')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '바닥', '수건을 깐 바닥');
    await setValue(page, '수레에 실은 추', '2개');
    await setValue(page, '출발 높이', '10 cm');
    await expectNoSeriousViolations(page);
    await selectIV(page, '바닥');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('1.2초 · 출발선에서 1.17 m · 1 m까지 0.95초')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g4-water-state ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g4-water-state ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 점검표, 실행 뒤(얼리기 10 mL), 녹이기와 앞 시행, 녹이기 20 mL 플라스틱`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g4-water-state');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '과정');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('30.0분 · 부피 10.9 mL · 무게 10.0 g')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '과정', '얼음 녹이기');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('30.0분 · 부피 10.0 mL · 무게 10.0 g')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '과정', '얼음 녹이기');
    await setValue(page, '처음 물의 양', '20 mL');
    await setValue(page, '시험관 종류', '플라스틱 시험관');
    await expectNoSeriousViolations(page);
    await selectIV(page, '처음 물의 양');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('30.0분 · 부피 20.0 mL · 무게 20.0 g')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g5-mixture ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g5-mixture ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 점검표, 실행 뒤(50 mL), 20 mL와 앞 시행, 따르기`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g5-mixture');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '넣는 물의 양');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 증발시키기 · 접시 위 가루 9.0 g')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '넣는 물의 양', '20 mL');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 증발시키기 · 접시 위 가루 6.5 g')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '거르는 방법', '거름종이 없이 윗물만 따르기');
    await expectNoSeriousViolations(page);
    await selectIV(page, '거르는 방법');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 증발시키기 · 접시 위 가루 10.5 g')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g4-land 두 번째 활동(흐르는 물, stream-table) ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g4-land 흐르는 물 ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 실행 뒤(20·16), 가파르게(50·40)와 앞 시행, 2 L`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g4-land', { experiment: 'stream-table' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '언덕의 기울기');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('60.0초 · 깎인 흙 20 g · 쌓인 흙 16 g')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '언덕의 기울기', '가파르게');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('60.0초 · 깎인 흙 50 g · 쌓인 흙 40 g')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '흘려보내는 물의 양', '2 L');
    await selectIV(page, '흘려보내는 물의 양');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('60.0초 · 깎인 흙 40 g · 쌓인 흙 32 g')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g3-earth-sea ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g3-earth-sea ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 점검표, 실행 뒤(강물 0.0·10분), 바닷물(1.8)과 앞 시행, 100 mL(3.6)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g3-earth-sea');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '물의 종류');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 0.0 g')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '물의 종류', '바닷물');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 1.8 g')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '물의 종류', '바닷물');
    await setValue(page, '증발 접시에 붓는 물의 양', '100 mL');
    await setValue(page, '증발 접시 모양', '네모난 접시');
    await expectNoSeriousViolations(page);
    await selectIV(page, '증발 접시에 붓는 물의 양');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 3.6 g')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g3-earth-sea 활동 2 (밀물과 썰물 관찰하기) ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g3-earth-sea 밀물과 썰물 ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 예측 뒤(2시), 8시(갯벌), 기록 뒤(이름 문구), 둘째 과제`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g3-earth-sea', { experiment: 'tide' });
    await expect(page.getByTestId('tide-svg')).toBeVisible();
    await expectNoSeriousViolations(page);
    await earthPick(page, '바닷물이 높이 들어오는 때', '한 번');
    await expectNoSeriousViolations(page);
    await earthSlider(page, '시각').fill('8');
    await expectNoSeriousViolations(page);
    await region(page, '관찰 기록').getByRole('button', { name: '두 번', exact: true }).click();
    await expect(page.getByTestId('tide-state-name')).toBeVisible();
    await expectNoSeriousViolations(page);
    await earthPick(page, '바닷물이 가장 빠졌을 때', '모래사막');
    await earthSlider(page, '시각').fill('20.5');
    await region(page, '관찰 기록').getByRole('button', { name: '넓은 갯벌', exact: true }).click();
    await expectNoSeriousViolations(page);
  });
}

// ---- g4-night-sky ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g4-night-sky ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 거리 비교, 북쪽 하늘(길잡이 선·별 자취), 기록 뒤`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g4-night-sky');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await earthPick(page, '행성의 크기 비교', '약 2배');
    await page.getByRole('button', { name: '거리 비교', exact: true }).click();
    await expectNoSeriousViolations(page);
    await page.getByRole('button', { name: '크기 비교', exact: true }).click();
    await region(page, '관찰 기록').getByRole('button', { name: '약 11배', exact: true }).click();
    await expectNoSeriousViolations(page);
    await earthPick(page, '북극성 찾기', '직녀성');
    await page.getByRole('button', { name: '길잡이 선 보기' }).click();
    await page.getByRole('button', { name: '별 자취 남기기' }).click();
    await earthSlider(page, '시각').fill('24');
    await expectNoSeriousViolations(page);
    await region(page, '관찰 기록').getByRole('button', { name: '북극성', exact: true }).click();
    await expectNoSeriousViolations(page);
  });
}

// ---- g5-weather ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g5-weather ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 점검표, 실행 뒤(낮 20 cm), 밤과 앞 시행, 40 cm`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g5-weather');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '때');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('10.0분 · 모래 34.7 °C · 물 26.3 °C · 바람: 바다 → 육지')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '때', '밤');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('10.0분 · 모래 21.2 °C · 물 23.8 °C · 바람: 육지 → 바다')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.reload();
    await setValue(page, '전등과의 거리', '40 cm');
    await selectIV(page, '전등과의 거리');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('10.0분 · 모래 23.7 °C · 물 21.6 °C · 바람: 바다 → 육지')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- g3-health ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g3-health ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 실행 뒤(기준), 마스크·자주 씻음·8명`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g3-health');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '마스크');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20일째 · 지금 아픈 사람 3명 · 지금까지 감염 12명')).toBeVisible();
    await expectNoSeriousViolations(page);
    // '씀'은 '안 씀'에도 들어 있어 글자가 같은 버튼만 고른다.
    await page.getByRole('group', { name: '마스크', exact: true }).getByRole('button', { name: '씀', exact: true }).click();
    await setValue(page, '손 씻기', '자주 씻음');
    await setValue(page, '하루에 가까이 만나는 친구 수', '8명');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expectNoSeriousViolations(page);
  });
}

// ---- g4-climate ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g4-climate ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 점검표, 실행 뒤(기준), 덮개 씌움·이산화 탄소와 "모형의 한계" 펼침`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g4-climate');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '투명 비닐 덮개');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 병 속 27.8 °C (처음보다 +5.8 °C)')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '투명 비닐 덮개', '씌움');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 병 속 31.6 °C (처음보다 +9.6 °C)')).toBeVisible();
    await page.getByText('모형의 한계', { exact: true }).click();
    await expectNoSeriousViolations(page);
    await page.reload();
    await selectIV(page, '병 속 공기');
    await setValue(page, '병 속 공기', '이산화 탄소를 더 넣은 공기');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('20.0분 · 병 속 29.2 °C (처음보다 +7.2 °C)')).toBeVisible();
    await expectNoSeriousViolations(page);
    // 진짜 기온 자료 패널과 그 안의 표를 연 상태
    await page.getByTestId('climate-data').locator('summary').first().click();
    await expect(page.getByTestId('climate-svg')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.getByTestId('climate-table').locator('summary').click();
    await expect(page.getByTestId('climate-table').locator('tbody tr')).toHaveCount(12);
    await expectNoSeriousViolations(page);
  });
}

// ---- g5-energy ----

for (const scheme of ['light', 'dark'] as const) {
  test(`g5-energy ${scheme === 'dark' ? '어두운 화면' : '밝은 화면'}: 처음, 점검표, 실행 뒤(기준), 30°, 흐림·그늘과 "모형의 한계" 펼침`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoUnit(page, 'g5-energy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
    await selectIV(page, '패널 기울기');
    await predict(page, '변하지 않는다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(page.getByRole('dialog', { name: '안전 점검표' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('60.0초 · 만든 전기 433 mW · 돈 횟수 104번')).toBeVisible();
    await expectNoSeriousViolations(page);
    await setValue(page, '패널 기울기', '30°');
    await predict(page, '늘어난다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('60.0초 · 만든 전기 500 mW · 돈 횟수 120번')).toBeVisible();
    await page.getByText('모형의 한계', { exact: true }).click();
    await expectNoSeriousViolations(page);
    await page.reload();
    await selectIV(page, '날씨');
    await setValue(page, '날씨', '흐린 날');
    await setValue(page, '그늘', '패널 절반을 가림');
    await predict(page, '줄어든다');
    await page.getByRole('button', { name: '▶ 실험 실행' }).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    await expect(page.getByText('60.0초 · 만든 전기 65 mW · 돈 횟수 16번')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- 수업 연결 ----

for (const scheme of ['light', 'dark'] as const) {
  test(`교사 화면(${scheme === 'light' ? '밝게' : '어둡게'}): 시작·수업 화면·끝내기 대화상자`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('http://localhost:4175/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);

    const code = await createClass(page);
    // 연결된 모둠, 안전 경고가 있는 모둠, 끊긴 모둠을 한 화면에 모은다.
    const a = await rawStudent(code, 2);
    const b = await rawStudent(code, 5);
    b.send(JSON.stringify({ t: 'status', unitId: 'g5-solution', activity: 'variable', phase: 'reviewing', trials: 2, lastKind: 'confounded', mismatch: false, safetyLocked: true }));
    b.send(JSON.stringify({ t: 'safety', type: 'NO_GOGGLES', at: Date.now() }));
    const c = await rawStudent(code, 8);
    c.close();
    await expect(page.getByRole('alert')).toContainText('1건');
    await expect(page.getByRole('listitem', { name: '8모둠', exact: true })).toContainText('끊김');
    await expectNoSeriousViolations(page);

    await page.getByRole('button', { name: '모두 멈춤' }).click();
    await expect(page.getByRole('button', { name: '다시 시작' })).toBeVisible();
    await page.getByRole('button', { name: '수업 끝내기' }).click();
    await expect(page.getByRole('dialog', { name: '수업을 끝낼까요?' })).toBeVisible();
    await expectNoSeriousViolations(page);
    a.close();
    b.close();
  });

  test(`학생 수업 참여 대화상자(${scheme === 'light' ? '밝게' : '어둡게'})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(studentUrl());
    await page.getByRole('button', { name: '수업 참여' }).click();
    await expect(page.getByRole('dialog', { name: '수업 참여' })).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

// ---- 탐구 기록장과 g6-career(진로) ----

for (const scheme of ['light', 'dark'] as const) {
  const label = scheme === 'light' ? '밝게' : '어둡게';

  test(`탐구 기록장 카드와 켜기·끄기 대화 상자(${label})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.getByRole('region', { name: '탐구 기록장' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.getByRole('button', { name: '기록장 켜기' }).click();
    await expect(page.getByRole('dialog', { name: '탐구 기록장을 켤까요?' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.getByRole('button', { name: '켤게요' }).click();
    await expectNoSeriousViolations(page);
    await page.getByRole('button', { name: '기록장 끄기' }).click();
    await expect(page.getByRole('dialog', { name: '기록장을 끌까요?' })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test(`g6-career 네 단계(${label})`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await page.getByRole('button', { name: '기록장 켜기' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '켤게요' }).click();
    await gotoUnit(page, 'g4-gases');
    await selectIV(page, '피스톤을 누르는 힘');
    await predict(page, '줄어든다');
    await runTrial(page);
    await setValue(page, '피스톤을 누르는 힘', '세게 누름');
    await predict(page, '줄어든다');
    await runTrial(page);
    await page.goto('/#/unit/g6-career');
    const step = (n: number) => page.getByRole('navigation', { name: '진로 탐색 단계' }).getByRole('button', { name: new RegExp(`^${n} `) });
    await expect(page.getByRole('heading', { level: 1, name: '과학과 나의 진로' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await step(2).click();
    await page.getByRole('checkbox', { name: /물질/ }).check();
    await expectNoSeriousViolations(page);
    await step(3).click();
    await page.getByRole('button', { name: '다른 영역도 보기' }).click();
    await expectNoSeriousViolations(page);
    await step(4).click();
    await page.getByLabel('관심 있는 직업').selectOption('vet');
    await page.getByRole('checkbox', { name: '관찰하고 기록하기' }).check();
    await page.getByLabel('더 알아보고 싶은 것', { exact: false }).fill('동물의 마음을 어떻게 알 수 있을까요?');
    await page.getByRole('button', { name: '저장하기' }).click();
    await expectNoSeriousViolations(page);
  });

  test(`g6-career 기록장이 꺼진 처음 화면(${label})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/#/unit/g6-career');
    await expect(page.getByText('기록이 없어요')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}
