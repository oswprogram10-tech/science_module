import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, selectIV, predict, runButton, resultRows, sensor, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const record = (page: Page) => page.getByRole('figure', { name: '관찰 기록 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const DAY = '관찰한 날';
const TIME = '관찰한 때';
const LIMITS = /탈피 호르몬|변태|유충|성충/;
const STAGE_NAMES = /애벌레|번데기|어른벌레|탈바꿈/;

async function open(page: Page) {
  await gotoUnit(page, 'g3-lifecycle', { experiment: 'butterfly-life' });
  await expect(page.getByRole('heading', { level: 1, name: '생물의 한살이' })).toBeVisible();
}

/** 이 활동에는 안전 점검표가 없으므로 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 관찰한 날 선택지는 "1일째"가 "21일째"에도 들어 있어 이름을 정확히 맞춘다(고른 것은 앞에 ✓가 붙는다). */
async function pickDay(page: Page, day: number) {
  await page.getByRole('group', { name: DAY, exact: true }).getByRole('button', { name: new RegExp(`^(✓ )?${day}일째$`) }).click();
}

/** 결과표 한 줄의 몸 길이·먹이·움직임·날개: 두 조건 다음 네 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(2, 6);
}

const shape = async (page: Page) => (await macro(page).getByTestId('creature').getAttribute('data-shape'))!;
const dots = async (page: Page) => record(page).getByTestId('life-dot').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-day')), Number(e.getAttribute('data-value'))]));

test('두 번째 활동 탭으로 열리고, 첫 활동(씨가 싹 트는 조건)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 배추흰나비는 알에서 어른벌레가 되기까지 어떻게 변할까?')).toBeVisible();
  await expect(page.getByText('예측: 몸 길이는?')).toBeVisible();
  await expect(page.locator('.activity-note')).toHaveText('교실에서 기르는 배추흰나비와 함께 보며 기록해요.');
  await expect(macro(page).getByText('교실에서 기르는')).toHaveCount(0);
  await activityTab(page, 1).click();
  await expect(page.locator('.activity-note')).toHaveCount(0);
  await activityTab(page, 2).click();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g3-lifecycle\/germination$/);
  await expect(page.getByRole('group', { name: '물', exact: true })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: DAY, exact: true })).toBeVisible();
  await page.reload();
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
});

test('기준(1일째, 아침)이면 몸 길이 1·먹지 않음이고 실행 전에는 사육 상자에 아무것도 없으며 단계 이름이 화면에 없다', async ({ page }) => {
  await open(page);
  // 실행 전: 빈 사육 상자와 자뿐이고, 몸 그림·점·결과 문구가 없다.
  await expect(macro(page).getByTestId('creature')).toHaveCount(0);
  await expect(macro(page).getByTestId('life-note')).toContainText('실험하면');
  await expect(record(page).getByTestId('life-dot')).toHaveCount(0);
  await expect(macro(page).getByTestId('ruler')).toBeVisible();
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, DAY);
  expect(await resultCells(resultRows(page).first())).toEqual(['1', '먹지 않음', '거의 움직이지 않음', '없음']);
  for (const h of ['몸 길이(mm)', '먹이를 먹나요', '움직이나요', '날개']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByTestId('life-note')).toHaveText('1일째 · 몸 길이 1 mm · 먹이: 먹지 않음 · 움직임: 거의 움직이지 않음 · 날개: 없음');
  expect(await shape(page)).toBe('egg');
  expect(await dots(page)).toEqual([[1, 1]]);
  await expect(page.getByText('가상 자: 몸 길이')).toBeVisible();
  await expectSensorNear(page, '거리', 1, 1.5);
  await expect(sensor(page, '거리')).toContainText(' mm');
  // 단계 이름을 결과표·그림·기록 그래프 어디에도 쓰지 않는다.
  expect(await resultRows(page).first().innerText()).not.toMatch(STAGE_NAMES);
  expect(await page.locator('.views').innerText()).not.toMatch(STAGE_NAMES);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('관찰한 날을 바꾸면 길이·먹이·움직임·날개가 표대로 바뀌고 날 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, DAY);
  await pickDay(page, 9);
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['10', '먹음', '기어 다님', '없음']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('관찰한 날만 바꾸었어요. 몸 길이와 모습은 어떻게 달라졌나요? 가장 크게 바뀐 때는 언제인가요?');
  expect(await shape(page)).toBe('larva');
  await pickDay(page, 15);
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['28', '먹음', '기어 다님', '없음']);
  expect(await shape(page)).toBe('big');
  await pickDay(page, 18);
  await run(page, '줄어든다');
  const row4 = resultRows(page).nth(3);
  expect(await resultCells(row4)).toEqual(['22', '먹지 않음', '거의 움직이지 않음', '없음']);
  await expect(row4).toContainText('결과: 줄어들었다');
  expect(await shape(page)).toBe('shell');
  await pickDay(page, 30);
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(4))).toEqual(['20', '먹음', '날아다님', '있음']);
  expect(await shape(page)).toBe('adult');
  // 기록 그래프는 관찰한 날(1·9·15·18·30일째)에만 점이 있고 날 순서로 이어진다.
  expect(await dots(page)).toEqual([[1, 1], [9, 10], [15, 28], [18, 22], [30, 20]]);
  await expect(record(page).getByTestId('life-line')).toHaveCount(1);
  expect(await page.locator('.views').innerText()).not.toMatch(STAGE_NAMES);
});

test('대조 변인: 관찰한 때만 저녁으로 바꾸면 결과가 같고(변하지 않았다) 때 전용 질문이 나오며 사육 상자 바탕만 달라진다', async ({ page }) => {
  await open(page);
  await pickDay(page, 12);
  await baselineRun(page, TIME);
  expect(await resultCells(resultRows(page).first())).toEqual(['20', '먹음', '기어 다님', '없음']);
  const before = (await macro(page).getByTestId('cage').getAttribute('data-fill'))!;
  await page.getByRole('group', { name: TIME, exact: true }).getByRole('button', { name: '저녁' }).click();
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['20', '먹음', '기어 다님', '없음']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('관찰한 때만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await macro(page).getByTestId('cage').getAttribute('data-fill')).not.toBe(before);
  await expect(macro(page).getByTestId('day-label')).toHaveText('12일째 · 저녁');
  // 같은 날을 두 번 관찰해도 기록 그래프의 점은 하나다.
  expect(await dots(page)).toEqual([[12, 20]]);
});

test('그래프: y축 0~30 mm(0, 10, 20, 30), x축 0~30일(5일 간격), 관찰한 날의 표식 하나와 그 날에서 멈추는 플레이헤드', async ({ page }) => {
  await open(page);
  await pickDay(page, 12);
  await baselineRun(page, DAY);
  await expect(graph(page).getByText('몸 길이(mm)').first()).toBeVisible();
  await expect(graph(page).getByText('관찰한 날(일째)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '10', '20', '30']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '5', '10', '15', '20', '25', '30']);
  await expect(graph(page).getByTestId('graph-marker')).toHaveCount(1);
  await expect(graph(page).getByTestId('graph-marker')).toContainText('12일째 · 20 mm');
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuemax', '12');
  await expect(slider).toHaveAttribute('aria-valuenow', '12');
  // 관찰하지 않은 날은 그리지 않는다: 몸 길이를 이은 기울어진 선이 없다.
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  expect(new Set(raw!.trim().split(/\s+/)).size).toBe(1);
});
