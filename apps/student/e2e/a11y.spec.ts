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
