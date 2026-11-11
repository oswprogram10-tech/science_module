import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const record = (page: Page) => page.getByRole('figure', { name: '검사 결과 기록' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const BURN = '초를 태운 시간';
const TEST = '검사 방법';
const JAR = '집기병 색';
// 한계 용어
const LIMITS = /산화|탄화수소|화학 반응식|수증기 응결/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g6-combustion', { experiment: 'combustion-products', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '물질의 연소' })).toBeVisible();
}

/** 처음 실행할 때만 안전 점검표(불 점검표)를 거친다. */
async function run(page: Page, prediction: string, first = false) {
  await predict(page, prediction);
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  if (first) await confirmSafetyDialog(page);
  else await expect(dialog).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 검사 결과·뿌연 정도·짧아진 길이·변화 단계: 세 조건 다음 네 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 7);
}

const recordNames = async (page: Page) => await record(page).getByTestId('record-name').allTextContents();

test('두 번째 활동 탭으로 열리고, 첫 활동(집기병으로 덮은 촛불)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 초가 타고 난 뒤에는 어떤 물질이 생길까?')).toBeVisible();
  await expect(page.getByText('예측: 검사 결과의 변화 단계는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g6-combustion\/candle-jar$/);
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 촛불을 집기병으로 덮으면 불이 꺼질 때까지 걸리는 시간은 어떤 조건에 따라 달라질까?')).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: BURN })).toBeVisible();
});

test('기준(태우지 않음, 코발트 종이, 투명)이면 불 점검표를 거쳐 푸른색 그대로이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 불꽃 없음, 초 그대로, 검사 결과는 "실험하면 나타나요", 기록 비어 있음
  await expect(macro(page).getByTestId('products-art')).toHaveAttribute('data-result', 'none');
  await expect(macro(page).getByTestId('products-art')).toHaveAttribute('data-lit', 'no');
  await expect(macro(page).getByTestId('flame')).toHaveCount(0);
  await expect(macro(page).getByTestId('result-label')).toHaveText('검사 결과: 실험하면 나타나요');
  await expect(record(page).getByTestId('record-row')).toHaveCount(0);
  await expect(page.getByText('아직 실험한 결과가 없어요.')).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await selectIV(page, BURN);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('불을 붙이거나 끌 때는 선생님과 함께해요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');

  expect(await resultCells(resultRows(page).first())).toEqual(['푸른색 그대로', '—', '0.0', '0']);
  for (const h of ['검사 결과', '석회수 뿌연 정도(눈금 0~10)', '초가 짧아진 길이(mm)', '변화 단계(0 = 변화 없음)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByTestId('result-label')).toHaveText('검사 결과: 푸른색 그대로');
  expect(await recordNames(page)).toEqual(['코발트 종이: 푸른색 그대로']);
  // 가상 센서는 없다
  await expect(page.getByRole('group', { name: '센서' })).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('초를 태운 시간만 1분으로 바꾸면 붉은색으로 변함(늘어났다)이고 시간 전용 질문이 나오며 불꽃이 켜졌다 꺼지고 초가 짧아진다', async ({ page }) => {
  await open(page, { playback: 4 });
  await baselineRun(page, BURN);
  await setValue(page, BURN, '1분');
  await predict(page, '늘어난다');
  await runButton(page).click();
  // 재생 중 앞부분에는 불꽃이 켜져 있다(태우는 동안)
  await expect(macro(page).getByTestId('products-art')).toHaveAttribute('data-lit', 'yes');
  await expect(macro(page).getByTestId('flame')).toHaveCount(1);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['붉은색으로 변함', '—', '1.0', '1']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('초를 태운 시간만 바꾸었어요. 태우지 않았을 때와 태운 뒤의 검사 결과는 어떻게 달랐나요?');
  await expect(macro(page).getByTestId('products-art')).toHaveAttribute('data-lit', 'no');
  await expect(macro(page).getByTestId('flame')).toHaveCount(0);
  await expect(macro(page).getByTestId('products-art')).toHaveAttribute('data-shorter', '1');
  await expect(macro(page).getByTestId('result-label')).toHaveText('검사 결과: 붉은색으로 변함');
  expect(await recordNames(page)).toEqual(['코발트 종이: 푸른색 그대로', '코발트 종이: 붉은색으로 변함']);
});

test('검사 방법만 석회수로 바꾸면(3분) 붉은색으로 변함에서 뿌예짐 8(늘어났다)이 되고 검사 방법 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, BURN, '3분');
  await baselineRun(page, TEST);
  expect(await resultCells(resultRows(page).first())).toEqual(['붉은색으로 변함', '—', '3.0', '1']);
  await setValue(page, TEST, '석회수');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['뿌예짐', '8', '3.0', '2']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('검사 방법만 바꾸었어요. 같은 시간 동안 태운 집기병에서 두 검사의 결과는 각각 어떻게 나타났나요?');
  await expect(macro(page).getByTestId('result-label')).toHaveText('검사 결과: 뿌예짐');
  await expect(macro(page).getByTestId('lime-milk')).toBeVisible();
  expect(await recordNames(page)).toEqual(['코발트 종이: 붉은색으로 변함', '석회수: 뿌예짐']);
  // 1분: 조금 뿌예짐 3, 태우지 않음: 맑음 0
  await selectIV(page, BURN);
  await setValue(page, BURN, '1분');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['조금 뿌예짐', '3', '1.0', '1']);
  await setValue(page, BURN, '태우지 않음');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(3))).toEqual(['맑음', '0', '0.0', '0']);
});

test('대조 변인: 집기병 색만 연한 파랑으로 바꾸면 결과가 같고(변하지 않았다) 집기병 색 전용 질문이 나오며 병 그림이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, BURN, '3분');
  await baselineRun(page, JAR);
  await expect(macro(page).getByTestId('products-art')).toHaveAttribute('data-jar', 'clear');
  await setValue(page, JAR, '연한 파랑');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['붉은색으로 변함', '—', '3.0', '1']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('집기병 색만 바꾸었을 때 검사 결과는 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('products-art')).toHaveAttribute('data-jar', 'blue');
  await expect(macro(page).getByTestId('jar')).toHaveAttribute('data-fill', '#bfdbfe');
  await expect(macro(page).getByTestId('jar-label')).toHaveText('집기병 색: 연한 파랑');
});

test('그래프: 석회수(3분)는 y축 0~10, x축 0~3분이고 선이 올라가며, 종이 검사는 선 없이 안내 글자만 있다', async ({ page }) => {
  await open(page);
  await setValue(page, BURN, '3분');
  await setValue(page, TEST, '석회수');
  await baselineRun(page, BURN);
  await expect(graph(page).getByText('석회수 뿌연 정도(눈금)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(분)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '2', '4', '6', '8', '10']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2', '3']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  // 맑음 0에서 시작해 8까지 올라간다(그림 좌표는 아래가 크다)
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  // 슬라이더를 처음으로 옮기면 처음 모습(맑음)으로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('products-art')).toHaveAttribute('data-result', 'limeClear');
  await expect(macro(page).getByTestId('result-label')).toHaveText('검사 결과: 맑음');
  // 종이 검사로 바꾸면 선이 없다
  await selectIV(page, TEST);
  await setValue(page, TEST, '푸른색 염화 코발트 종이');
  await run(page, '줄어든다');
  await expect(graph(page).getByTestId('graph-empty')).toHaveText('종이 검사는 선을 그리지 않아요.');
  await expect(graph(page).locator('polyline[stroke="#1f6fb5"]')).toHaveCount(0);
  // 앞 시행(석회수)은 흐린 선으로 남는다
  await expect(graph(page).locator('polyline')).toHaveCount(1);
});
