import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const strip = (page: Page) => page.getByRole('figure', { name: '색 띠 기록' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const DROPS = '넣은 방울 수';
const DIRECTION = '넣는 방향';
const INDICATOR = '지시약';
const BEAKER = '비커 크기';
const BASE_FIRST = '묽은 수산화 나트륨 용액 10 mL에 묽은 염산을 넣음';
// 한계 용어 "염"은 화면의 "묽은 염산"과 겹치므로 나머지만 확인한다.
const LIMITS = /pH|수소 이온|수산화 이온|중화열/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g6-acid-base', { experiment: 'acid-base-mix', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '산과 염기' })).toBeVisible();
}

/** 처음 실행할 때만 안전 점검표(보안경·장갑)를 거친다. */
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

/** 결과표 한 줄의 지시약 색·넣은 양·색 띠에서의 자리: 네 조건 다음 세 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 7);
}

const stripRows = async (page: Page) =>
  await strip(page).getByTestId('strip-row').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-drops')), e.getAttribute('data-color')]));
const stripNames = async (page: Page) => await strip(page).getByTestId('strip-name').allTextContents();

test('두 번째 활동 탭으로 열리고, 첫 활동(지시약으로 여러 가지 용액 분류하기)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 산성 용액에 염기성 용액을 조금씩 넣으면 용액의 성질은 어떻게 변할까?')).toBeVisible();
  await expect(page.getByText('예측: 색 띠에서 지시약 색의 자리는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g6-acid-base\/indicator-classify$/);
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 지시약을 이용하면 여러 가지 용액을 어떻게 분류할 수 있을까?')).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: DROPS })).toBeVisible();
});

test('기준(0방울, 염산에 넣기, 붉은 양배추, 50 mL)이면 점검표를 거쳐 붉은색, 0.0, 1칸이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 색 없음, 색 이름은 "실험하면 나타나요", 색 띠 기록 비어 있음
  await expect(macro(page).getByTestId('mix-art')).toHaveAttribute('data-color', 'none');
  await expect(macro(page).getByTestId('color-label')).toHaveText('지시약 색: 실험하면 나타나요');
  await expect(strip(page).getByTestId('strip-row')).toHaveCount(0);
  await expect(strip(page).getByTestId('strip-note')).toContainText('실험하면');
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await selectIV(page, DROPS);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('보안경을 썼어요.')).toBeVisible();
  await expect(dialog.getByText('실험용 장갑을 꼈어요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');

  expect(await resultCells(resultRows(page).first())).toEqual(['붉은색', '0.0', '1']);
  for (const h of ['지시약 색', '넣은 양(mL)', '색 띠에서의 자리(칸)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByTestId('color-label')).toHaveText('지시약 색: 붉은색');
  expect(await stripRows(page)).toEqual([[0, 'cabRed']]);
  expect(await stripNames(page)).toEqual(['붉은색']);
  // 가상 센서는 없다
  await expect(page.getByRole('group', { name: '센서' })).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('넣은 방울 수를 20방울로 바꾸면 보라색, 10.0 mL, 3칸(늘어났다)이고 방울 수 전용 질문이 나오며 색 띠 기록에 칸이 둘 찍힌다', async ({ page }) => {
  await open(page);
  await baselineRun(page, DROPS);
  await setValue(page, DROPS, '20방울');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['보라색', '10.0', '3']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('넣은 방울 수만 바꾸었어요. 방울 수가 늘어남에 따라 지시약 색은 어떤 순서로 달라졌나요?');
  await expect(macro(page).getByTestId('color-label')).toHaveText('지시약 색: 보라색');
  await expect(macro(page).getByTestId('drops-label')).toHaveText('넣은 방울 수 20방울 · 10.0 mL');
  expect(await stripRows(page)).toEqual([[0, 'cabRed'], [20, 'cabPurple']]);
  expect(await stripNames(page)).toEqual(['붉은색', '보라색']);
  // 30방울: 노란색 6칸
  await setValue(page, DROPS, '30방울');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['노란색', '15.0', '6']);
  expect(await stripNames(page)).toEqual(['붉은색', '보라색', '노란색']);
});

test('넣는 방향만 바꾸면(30방울) 노란색 6칸에서 붉은색 1칸(줄어들었다)이 되고 방향 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, DROPS, '30방울');
  await baselineRun(page, DIRECTION);
  expect(await resultCells(resultRows(page).first())).toEqual(['노란색', '15.0', '6']);
  await setValue(page, DIRECTION, BASE_FIRST);
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['붉은색', '15.0', '1']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('넣는 방향만 바꾸었어요. 같은 방울 수에서 지시약 색은 어떻게 달랐나요?');
  await expect(macro(page).getByTestId('first-label')).toContainText('처음: 묽은 수산화 나트륨 10 mL');
  await expect(macro(page).getByTestId('added-label')).toContainText('넣는 용액: 묽은 염산');
});

test('지시약만 페놀프탈레인 용액으로 바꾸면(30방울) 붉은색 2칸(줄어들었다)이 되고 색 이름이 글자로 쓰인다', async ({ page }) => {
  await open(page);
  await setValue(page, DROPS, '30방울');
  await baselineRun(page, INDICATOR);
  await setValue(page, INDICATOR, '페놀프탈레인 용액');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['붉은색', '15.0', '2']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('지시약만 바꾸었어요. 같은 용액에서 두 지시약의 색은 각각 어떻게 달랐나요?');
  expect(await stripRows(page)).toEqual([[30, 'cabYellow'], [30, 'magenta']]);
  // 페놀프탈레인 20방울: 색 변화 없음
  await setValue(page, DROPS, '20방울');
  await selectIV(page, DROPS);
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['색 변화 없음', '10.0', '1']);
  expect(await stripNames(page)).toEqual(['노란색', '붉은색', '색 변화 없음']);
});

test('대조 변인: 비커 크기만 100 mL로 바꾸면 결과가 같고(변하지 않았다) 비커 크기 전용 질문이 나오며 비커 그림이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, DROPS, '20방울');
  await baselineRun(page, BEAKER);
  expect(await resultCells(resultRows(page).first())).toEqual(['보라색', '10.0', '3']);
  await expect(macro(page).getByTestId('mix-art')).toHaveAttribute('data-beaker', '50');
  await setValue(page, BEAKER, '100 mL');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['보라색', '10.0', '3']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('비커 크기만 바꾸었을 때 지시약 색은 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('mix-art')).toHaveAttribute('data-beaker', '100');
  await expect(macro(page).getByTestId('color-label')).toHaveText('지시약 색: 보라색');
});

test('그래프: y축 0~6칸(0, 1, …, 6), x축 0~3초(0, 1, 2, 3), 방울을 넣는 동안 칸이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, DROPS, '40방울');
  await baselineRun(page, DROPS);
  await expect(graph(page).getByText('색 띠에서의 자리(칸)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '1', '2', '3', '4', '5', '6']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2', '3']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  // 붉은색 1칸에서 시작해 노란색 6칸에서 멈춘다(그림 좌표는 아래가 크다)
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  // 슬라이더를 처음으로 옮기면 0방울(붉은색)로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('mix-art')).toHaveAttribute('data-drops', '0');
  await expect(macro(page).getByTestId('color-label')).toHaveText('지시약 색: 붉은색');
});
