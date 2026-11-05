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
