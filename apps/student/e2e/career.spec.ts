import type { Page } from '@playwright/test';
import { test, expect, gotoUnit, sortChoose, selectIV, setValue, predict, runTrial, runButton, resultRows, confirmSafetyDialog, createClass, joinClass, scrollWidth } from './helpers';

const KEY = 'sci-bridge.logbook.v1';
const logJson = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const stage = (page: Page, n: number) =>
  page.getByRole('navigation', { name: '진로 탐색 단계' }).getByRole('button', { name: new RegExp(`^${n} `) });
const gotoCareer = async (page: Page) => {
  await page.goto('/#/unit/g6-career');
  await expect(page.getByRole('heading', { level: 1, name: '과학과 나의 진로' })).toBeVisible();
};

/** 단원 목록에서 안내 대화 상자를 거쳐 기록장을 켠다. */
async function enableLogbook(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '기록장 켜기' }).click();
  const dialog = page.getByRole('dialog', { name: '탐구 기록장을 켤까요?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '켤게요' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '기록장 끄기' })).toBeVisible();
}

/** 기체: 힘을 바꿔 공정한 비교 1번(시행 2번). */
async function gasesTrials(page: Page) {
  await gotoUnit(page, 'g4-gases');
  await selectIV(page, '피스톤을 누르는 힘');
  await predict(page, '줄어든다');
  await runTrial(page);
  await setValue(page, '피스톤을 누르는 힘', '세게 누름');
  await predict(page, '줄어든다');
  await runTrial(page);
  await expect(resultRows(page)).toHaveCount(2);
}
/** 용해: 한 번 실행. */
async function solutionTrial(page: Page) {
  await gotoUnit(page, 'g5-solution');
  await selectIV(page, '물의 온도');
  await predict(page, '늘어난다');
  await runTrial(page);
  await expect(resultRows(page)).toHaveCount(1);
}

test.describe('기록장 켜기', () => {
  test('처음에는 꺼져 있고 안내 대화 상자 없이 아무것도 저장하지 않는다', async ({ page }) => {
    await page.goto('/');
    const card = page.getByRole('region', { name: '탐구 기록장' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('지금은 꺼져 있어서 아무것도 남지 않아요');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await logJson(page)).toBeNull();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('logbook')))).toEqual([]);
  });

  test('켜기 안내 대화 상자: 다섯 가지를 쉬운 말로 알리고, 안 켤래요/Esc는 아무것도 남기지 않는다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '기록장 켜기' }).click();
    const dialog = page.getByRole('dialog', { name: '탐구 기록장을 켤까요?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('남기는 것', { exact: false })).toBeVisible();
    await expect(dialog.getByText('이 기기에만 남아요.', { exact: false })).toBeVisible();
    await expect(dialog.getByText('서버나 선생님 화면으로 보내지 않아요.', { exact: false })).toBeVisible();
    await expect(dialog.getByText('"모두 지우기"로 전부 지울 수 있어요.', { exact: false })).toBeVisible();
    await expect(dialog.getByText('같은 기기를 쓰는 친구가 이 기록을 볼 수 있어요.', { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: '안 켤래요' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await logJson(page)).toBeNull();
    await page.getByRole('button', { name: '기록장 켜기' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await logJson(page)).toBeNull();
  });

  test('켜면 키가 생기고, 끄기는 기록을 지울지 묻는다(남기고 끄기 / 지우고 끄기)', async ({ page }) => {
    await enableLogbook(page);
    expect(JSON.parse((await logJson(page))!)).toEqual({ v: 1, enabled: true, entries: [] });
    await solutionTrial(page);
    await page.goto('/#/');
    await expect(page.getByRole('region', { name: '탐구 기록장' })).toContainText('남은 기록 1개');

    await page.getByRole('button', { name: '기록장 끄기' }).click();
    const dialog = page.getByRole('dialog', { name: '기록장을 끌까요?' });
    await expect(dialog).toContainText('남은 기록도 지울까요?');
    await dialog.getByRole('button', { name: '기록은 남기고 끄기' }).click();
    expect(JSON.parse((await logJson(page))!)).toMatchObject({ enabled: false });
    await expect(page.getByRole('button', { name: '기록장 켜기' })).toBeVisible();
    // 꺼진 뒤에는 더 기록하지 않는다.
    const before = await logJson(page);
    await gasesTrials(page);
    expect(await logJson(page)).toBe(before);

    await page.goto('/#/');
    await page.getByRole('button', { name: '모두 지우기' }).click();
    expect(await logJson(page)).toBeNull();

    // 켠 채 끄면서 지우기
    await enableLogbook(page);
    await page.getByRole('button', { name: '기록장 끄기' }).click();
    await page.getByRole('dialog', { name: '기록장을 끌까요?' }).getByRole('button', { name: '기록도 지우고 끄기' }).click();
    expect(await logJson(page)).toBeNull();
  });

  test('저장소를 쓸 수 없으면 "이 기기에서는 기록장을 쓸 수 없어요"를 보여 준다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
    await page.goto('/');
    await expect(page.getByRole('region', { name: '탐구 기록장' })).toContainText('이 기기에서는 기록장을 쓸 수 없어요');
    await expect(page.getByRole('button', { name: '기록장 켜기' })).toHaveCount(0);
    await gotoCareer(page);
    await expect(page.getByText('이 기기에서는 기록장을 쓸 수 없어요').first()).toBeVisible();
    await expect(page.getByText('기록이 없어요')).toBeVisible();
  });
});

test.describe('기록장이 꺼져 있을 때', () => {
  test('변인 실험을 해도 아무것도 저장하지 않고, 진로 단원은 "기록이 없어요"를 보여 준다', async ({ page }) => {
    await gasesTrials(page);
    expect(await logJson(page)).toBeNull();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await gotoCareer(page);
    await expect(page.getByText('기록이 없어요')).toBeVisible();
    await expect(page.locator('.area-record')).toHaveCount(0);
    // 기록이 없어도 직업 카드는 볼 수 있다.
    await stage(page, 3).click();
    await expect(page.locator('li.job-card')).toHaveCount(15);
    expect(await logJson(page)).toBeNull();
  });

  test('분류·카드 분류·관찰 단원을 해도 아무것도 저장하지 않는다', async ({ page }) => {
    await gotoUnit(page, 'g3-animal');
    await sortChoose(page, '다리가 있나요?');
    await page.goto('/#/unit/g6-earth-motion');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test('4단계 카드는 "기록장을 켜야 저장돼요"를 알리고 저장 단추가 잠겨 있다', async ({ page }) => {
    await gotoCareer(page);
    await stage(page, 4).click();
    await expect(page.getByText('기록장을 켜야 저장돼요')).toBeVisible();
    await expect(page.getByRole('button', { name: '저장하기' })).toBeDisabled();
    await page.getByLabel('더 알아보고 싶은 것', { exact: false }).fill('쓰는 중');
    await expect(page.getByRole('button', { name: '인쇄하기' })).toBeEnabled();
    expect(await logJson(page)).toBeNull();
  });
});

test.describe('진로 단원 안에서 기록장 켜기', () => {
  test('1단계 "기록장 켜기"는 같은 안내 대화 상자를 띄우고, 안 켤래요/Esc는 아무것도 남기지 않는다', async ({ page }) => {
    await gotoCareer(page);
    const turnOn = page.getByRole('button', { name: '기록장 켜기' });
    await expect(turnOn).toBeVisible();
    await turnOn.click();
    const dialog = page.getByRole('dialog', { name: '탐구 기록장을 켤까요?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveCount(5);
    await expect(dialog.getByText('같은 기기를 쓰는 친구가 이 기록을 볼 수 있어요.', { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: '안 켤래요' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(turnOn).toBeFocused();
    expect(await logJson(page)).toBeNull();
    await turnOn.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await logJson(page)).toBeNull();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test('1단계에서 "켤게요"를 누르면 켜지고, 버튼이 사라지며 안내가 바뀐다', async ({ page }) => {
    await gotoCareer(page);
    await page.getByRole('button', { name: '기록장 켜기' }).click();
    await page.getByRole('dialog', { name: '탐구 기록장을 켤까요?' }).getByRole('button', { name: '켤게요' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '기록장 켜기' })).toHaveCount(0);
    await expect(page.getByText('탐구 기록장이 켜져 있어요.', { exact: false })).toBeVisible();
    expect(JSON.parse((await logJson(page))!)).toMatchObject({ v: 1, enabled: true, entries: [] });
    // 단원 목록의 카드도 켜진 상태로 보인다.
    await page.goto('/');
    await expect(page.getByRole('button', { name: '기록장 끄기' })).toBeVisible();
  });

  test('4단계에서 켜면 저장하기가 풀리고, 저장한 글은 기록장에만 남는다', async ({ page }) => {
    await gotoCareer(page);
    await stage(page, 4).click();
    await expect(page.getByRole('button', { name: '저장하기' })).toBeDisabled();
    await page.getByRole('button', { name: '기록장 켜기' }).click();
    await page.getByRole('dialog', { name: '탐구 기록장을 켤까요?' }).getByRole('button', { name: '켤게요' }).click();
    await expect(page.getByText('기록장을 켜야 저장돼요')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '저장하기' })).toBeEnabled();
    await page.getByLabel('더 알아보고 싶은 것', { exact: false }).fill('화석이 어떻게 생기는지');
    await page.getByRole('button', { name: '저장하기' }).click();
    await expect(page.getByText('이 기기의 기록장에 저장했어요.')).toBeVisible();
    expect(await logJson(page)).toContain('화석이 어떻게 생기는지');
  });
});

test.describe('진로 단원', () => {
  test('기록장을 켜고 두 단원에서 탐구하면 영역별 기록과 탐구 능력 막대가 보인다', async ({ page }) => {
    await enableLogbook(page);
    await gasesTrials(page);
    await solutionTrial(page);
    await gotoCareer(page);
    await expect(page.getByText('기록이 없어요')).toHaveCount(0);
    const matter = page.locator('.area-record').filter({ hasText: '물질' });
    await expect(matter).toContainText('기록한 단원 2개');
    await expect(matter).toContainText('여러 가지 기체');
    await expect(matter).toContainText('용해와 용액');
    await expect(page.locator('.area-record').filter({ hasText: '생명' })).toContainText('기록한 단원이 아직 없어요');
    // 공정한 비교 1번, 예측 3번(시행 3번 모두 예측함), 모형 3번
    const bars = page.getByRole('list', { name: '탐구 능력별 해 본 횟수' });
    await expect(bars.getByRole('listitem').filter({ hasText: '공정하게 비교하기' })).toContainText('1번');
    await expect(bars.getByRole('listitem').filter({ hasText: '예측하기' })).toContainText('3번');
    await expect(bars.getByRole('listitem').filter({ hasText: '관찰하고 기록하기' })).toContainText('0번');
    // 순위·비교 문구가 없다
    const text = await page.locator('main').innerText();
    for (const w of ['순위', '등수', '1등', '최고', '가장 잘', '제일', '우수', '부족', '못하는']) expect(text, w).not.toContain(w);
    // 기록장 JSON에는 시행별 값이 없다
    const entries = JSON.parse((await logJson(page))!).entries as { unitId: string; kind: string; summary: Record<string, unknown> }[];
    expect(entries.map((e) => [e.unitId, e.kind]).sort()).toEqual([['g4-gases', 'variable'], ['g5-solution', 'variable']]);
    expect(entries.find((e) => e.unitId === 'g4-gases')!.summary).toMatchObject({ trials: 2, fair: 1, predicted: 2 });
  });

  test('관심 영역: 처음에는 고른 것이 없고 참고 표시만 있으며 최대 2개까지 고른다', async ({ page }) => {
    await enableLogbook(page);
    await gasesTrials(page);
    await gotoCareer(page);
    await stage(page, 2).click();
    const boxes = page.getByRole('group', { name: /관심 영역/ }).getByRole('checkbox');
    await expect(boxes).toHaveCount(5);
    for (const b of await boxes.all()) await expect(b).not.toBeChecked();
    await expect(page.getByText('고른 영역이 없어요.')).toBeVisible();
    // 기록이 많은 영역은 참고로 표시만 한다(미리 고르지 않는다).
    await expect(page.getByText('참고: 기록이 많은 영역')).toHaveCount(1);
    await expect(page.getByRole('checkbox', { name: /물질/ })).not.toBeChecked();
    await page.getByRole('checkbox', { name: /생명/ }).check();
    await page.getByRole('checkbox', { name: /지구와 우주/ }).check();
    await expect(page.getByRole('checkbox', { name: /물질/ })).toBeDisabled();
    await page.getByRole('checkbox', { name: /생명/ }).uncheck();
    await expect(page.getByRole('checkbox', { name: /물질/ })).toBeEnabled();
  });

  test('직업 카드: 고른 영역 먼저, 다른 영역도 보기, 내가 해 본 탐구 능력, 관련 단원 가기', async ({ page }) => {
    await enableLogbook(page);
    await gasesTrials(page);
    await gotoCareer(page);
    await stage(page, 2).click();
    await page.getByRole('checkbox', { name: /물질/ }).check();
    await stage(page, 3).click();
    await expect(page.locator('li.job-card')).toHaveCount(3);
    await expect(page.getByRole('heading', { level: 3, name: '화학 연구원' })).toBeVisible();
    const chem = page.locator('li.job-card').filter({ hasText: '화학 연구원' });
    await expect(chem).toContainText('이 일을 하는 사람은');
    await expect(chem).toContainText('내가 해 본 탐구 능력');
    await expect(chem).toContainText('공정하게 비교하기');
    await expect(page.locator('svg.job-icon')).toHaveCount(3);
    await page.getByRole('button', { name: '다른 영역도 보기' }).click();
    await expect(page.locator('li.job-card')).toHaveCount(15);
    await expect(page.locator('li.job-card').first()).toContainText('화학 연구원');
    await page.getByRole('button', { name: '다른 영역도 보기' }).or(page.getByRole('button', { name: '다른 영역 접기' })).click();
    await expect(page.locator('li.job-card')).toHaveCount(3);
    await chem.getByRole('button', { name: '용해와 용액 단원 가기' }).click();
    await expect(page).toHaveURL(/#\/unit\/g5-solution$/);
    await expect(page.getByRole('heading', { level: 1, name: '용해와 용액' })).toBeVisible();
  });

  test('직업 카드를 보고 "이 직업으로 카드 쓰기"를 누르면 4단계에 그 직업이 골라진다', async ({ page }) => {
    await gotoCareer(page);
    await stage(page, 3).click();
    await page.locator('li.job-card').filter({ hasText: '수의사' }).getByRole('button', { name: '이 직업으로 카드 쓰기' }).click();
    await expect(page.getByRole('heading', { level: 2, name: '4. 나의 진로 탐색 카드' })).toBeVisible();
    await expect(page.getByLabel('관심 있는 직업')).toHaveValue('vet');
  });

  test('진로 탐색 카드를 저장하고 새로 고침해도 남아 있고, 모두 지우면 사라진다', async ({ page }) => {
    await enableLogbook(page);
    await gotoCareer(page);
    await stage(page, 4).click();
    await expect(page.getByText('기록장을 켜야 저장돼요')).toHaveCount(0);
    await page.getByLabel('관심 있는 직업').selectOption('free');
    await page.getByLabel('직업 이름 직접 쓰기').fill('바다 탐사 연구원');
    await page.getByRole('checkbox', { name: '관찰하고 기록하기' }).check();
    await page.getByRole('checkbox', { name: '예측하기' }).check();
    const more = page.getByLabel('더 알아보고 싶은 것', { exact: false });
    await more.fill('깊은 바다에는 어떤 생물이 사는지 알고 싶어요.');
    await page.getByRole('button', { name: '저장하기' }).click();
    await expect(page.getByText('이 기기의 기록장에 저장했어요.')).toBeVisible();

    await page.reload();
    await stage(page, 4).click();
    await expect(page.getByLabel('관심 있는 직업')).toHaveValue('free');
    await expect(page.getByLabel('직업 이름 직접 쓰기')).toHaveValue('바다 탐사 연구원');
    await expect(page.getByRole('checkbox', { name: '관찰하고 기록하기' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: '예측하기' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: '기준을 세워 분류하기' })).not.toBeChecked();
    await expect(page.getByLabel('더 알아보고 싶은 것', { exact: false })).toHaveValue('깊은 바다에는 어떤 생물이 사는지 알고 싶어요.');

    // 모두 지우기
    await page.goto('/#/');
    await page.getByRole('button', { name: '모두 지우기' }).click();
    expect(await logJson(page)).toBeNull();
    await page.goto('/#/unit/g6-career');
    await page.reload();
    await stage(page, 4).click();
    await expect(page.getByLabel('관심 있는 직업')).toHaveValue('');
    await expect(page.getByLabel('더 알아보고 싶은 것', { exact: false })).toHaveValue('');
    await expect(page.getByText('기록장을 켜야 저장돼요')).toBeVisible();
  });

  test('글자 수는 200자까지이고 인쇄하기는 window.print를 부른다', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    await gotoCareer(page);
    await stage(page, 4).click();
    const more = page.getByLabel('더 알아보고 싶은 것', { exact: false });
    await more.fill('가'.repeat(250));
    expect(await more.inputValue()).toHaveLength(200);
    await expect(page.getByText('200/200')).toBeVisible();
    await page.getByRole('button', { name: '인쇄하기' }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    // 인쇄용 화면: 단계 이동·튜터·단추는 숨고 카드 칸은 남는다.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('navigation', { name: '진로 탐색 단계' })).toBeHidden();
    await expect(page.getByRole('button', { name: '인쇄하기' })).toBeHidden();
    await expect(more).toBeVisible();
  });

  test('4단계 튜터 질문이 단계마다 바뀐다', async ({ page }) => {
    await gotoCareer(page);
    const tutor = page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
    await expect(tutor).toContainText('어떤 탐구를 할 때 가장 재미있었나요?');
    await stage(page, 2).click();
    await expect(tutor).toContainText('그 영역의 어떤 점이 궁금한가요?');
    await stage(page, 3).click();
    await expect(tutor).toContainText('이 직업에서 쓰이는 탐구 능력 중 내가 해 본 것은 무엇인가요?');
    await stage(page, 4).click();
    await expect(tutor).toContainText('더 알아보려면 누구에게, 어디에서 물어볼 수 있을까요?');
  });
});

test.describe('개인정보', () => {
  test.use({ reducedMotion: 'reduce' });

  test('내 맥박(g5-body)에 값을 넣어도 기록장 JSON에는 그 숫자가 없다', async ({ page }) => {
    await enableLogbook(page);
    await gotoUnit(page, 'g5-body');
    await selectIV(page, '운동 종류');
    await predict(page, '늘어난다');
    await runButton(page).click();
    await confirmSafetyDialog(page);
    await expect(runButton(page)).toHaveText('▶ 실험 실행');
    const panel = page.locator('details.real-pulse');
    await panel.locator('summary').click();
    await page.getByRole('dialog', { name: '내 맥박 재기' }).getByRole('button', { name: '허가할게요' }).click();
    await page.clock.install();
    for (const [key, count] of [['before', 19], ['after', 23]] as const) {
      const row = panel.locator(`[data-slot=${key}]`);
      await row.getByRole('button', { name: '15초 재기' }).click();
      await expect(row.getByRole('timer')).toContainText('남은 시간 15초');
      await page.clock.runFor(16_000);
      await row.getByLabel('15초 동안 센 횟수').fill(String(count));
      await row.getByRole('button', { name: '기록(×4)' }).click();
    }
    await expect(panel.locator('[data-slot=before]').getByLabel('운동 전 내 맥박')).toHaveText('76회/분');
    await expect(panel.locator('[data-slot=after]').getByLabel('운동 직후 내 맥박')).toHaveText('92회/분');
    // 맥박을 잰 뒤에도 시행을 하나 더 해서 기록장이 실제로 쓰이게 한다.
    await predict(page, '늘어난다');
    await runButton(page).click();
    await expect(runButton(page)).toHaveText('▶ 실험 실행');

    const json = await logJson(page);
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!) as { entries: { unitId: string; summary: { trials: number } }[] };
    expect(parsed.entries.find((e) => e.unitId === 'g5-body')?.summary.trials).toBeGreaterThanOrEqual(1);
    expect(json!).not.toMatch(/(?<![0-9])(76|92|19|23)(?![0-9])/);
    expect(json!).not.toMatch(/pulse|맥박|real/i);
    const all = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
    expect(all).not.toMatch(/(?<![0-9])(76|92)(?![0-9])/);
  });

  test('교실에 연결해도 기록장 내용과 진로 카드 글·직업은 메시지·xAPI에 없고 단계만 간다', async ({ page: teacher, context }) => {
    test.setTimeout(90_000);
    const code = await createClass(teacher);
    const student = await context.newPage();
    const frames: string[] = [];
    student.on('websocket', (ws) => ws.on('framesent', (f) => frames.push(String(f.payload))));
    const xapi: Promise<unknown>[] = [];
    student.on('console', (m) => {
      if (m.type() === 'debug' && m.text().startsWith('[xAPI]')) xapi.push(m.args()[1]!.jsonValue());
    });
    await enableLogbook(student); // 기록장은 기기에 남으므로 교실에 참여하기 전에 켜 둔다
    await joinClass(student, code, 4);

    // 시행을 하나 해서 기록장에 내용이 있게 한다.
    await student.evaluate(() => {
      window.location.hash = '#/unit/g4-gases';
    });
    await selectIV(student, '피스톤을 누르는 힘');
    await predict(student, '줄어든다');
    await runTrial(student);
    await expect(teacher.getByRole('listitem', { name: '4모둠', exact: true })).toContainText('시행 1회');

    await student.evaluate(() => {
      window.location.hash = '#/unit/g6-career';
    });
    await expect(student.getByRole('heading', { level: 1, name: '과학과 나의 진로' })).toBeVisible();
    await expect(teacher.getByRole('listitem', { name: '4모둠', exact: true })).toContainText('내 탐구 기록을 보는 중');
    await expect(teacher.getByRole('listitem', { name: '4모둠', exact: true })).toContainText('1단계');
    await stage(student, 3).click();
    await expect(teacher.getByRole('listitem', { name: '4모둠', exact: true })).toContainText('직업 카드를 살펴보는 중');
    await stage(student, 4).click();
    await student.getByLabel('관심 있는 직업').selectOption('free');
    await student.getByLabel('직업 이름 직접 쓰기').fill('비밀직업XYZ');
    await student.getByLabel('더 알아보고 싶은 것', { exact: false }).fill('비밀글ABC 를 알아보고 싶어요');
    await student.getByRole('checkbox', { name: '예측하기' }).check();
    await student.getByRole('button', { name: '저장하기' }).click();
    await expect(student.getByText('이 기기의 기록장에 저장했어요.')).toBeVisible();
    await expect(teacher.getByRole('listitem', { name: '4모둠', exact: true })).toContainText('진로 탐색 카드를 쓰는 중');
    await expect(teacher.getByRole('listitem', { name: '4모둠', exact: true })).toContainText('4단계');
    await expect(teacher.getByRole('listitem', { name: '4모둠', exact: true })).not.toContainText(/비밀/);

    const statements = await Promise.all(xapi);
    expect(statements.length).toBeGreaterThan(0);
    const stageStatements = statements.filter((s) => JSON.stringify(s).includes('stage-viewed'));
    expect(stageStatements.length).toBeGreaterThanOrEqual(2);
    for (const s of statements) {
      expect(JSON.stringify(s)).not.toMatch(/비밀|vet|fairKeys|logbook|sci-bridge\.logbook/);
    }
    expect(frames.length).toBeGreaterThan(0);
    const statuses = frames.map((f) => JSON.parse(f) as Record<string, unknown>).filter((m) => m.t === 'status' && m.activity === 'portfolio');
    expect(statuses.map((m) => m.lastKind)).toEqual(expect.arrayContaining(['stage-1', 'stage-3', 'stage-4']));
    for (const m of statuses) expect(Object.keys(m).sort()).toEqual(['activity', 'lastKind', 'phase', 'safetyLocked', 't', 'trials', 'unitId']);
    for (const f of frames) {
      expect(f).not.toMatch(/비밀|알아보고|fairKeys|jobKey|jobText|skills|summary|entries/);
    }
    // 저장은 실제로 이 기기에만 됐다.
    expect(await logJson(student)).toContain('비밀직업XYZ');
  });
});

test.describe('휴대폰 폭', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('가로 스크롤이 없다(단원 목록·기록장 대화 상자·네 단계·직업 카드 전체)', async ({ page }) => {
    const noScroll = async () => {
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
    };
    await page.goto('/');
    await noScroll();
    await page.getByRole('button', { name: '기록장 켜기' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await noScroll();
    await page.getByRole('button', { name: '켤게요' }).click();
    await gasesTrials(page);
    await gotoCareer(page);
    await noScroll();
    await stage(page, 2).click();
    await page.getByRole('checkbox', { name: /물질/ }).check();
    await noScroll();
    await stage(page, 3).click();
    await page.getByRole('button', { name: '다른 영역도 보기' }).click();
    await expect(page.locator('li.job-card')).toHaveCount(15);
    await noScroll();
    await stage(page, 4).click();
    await noScroll();
  });

  test('도구 그림은 장식이고 SVG 글자는 13 px 이상이다', async ({ page }) => {
    await gotoCareer(page);
    await stage(page, 3).click();
    await expect(page.locator('svg.job-icon')).toHaveCount(15);
    await expect(page.locator('svg.job-icon').first()).toHaveAttribute('aria-hidden', 'true');
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll('main svg')].flatMap((svg) => {
        const s = svg as unknown as SVGSVGElement;
        const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
        return [...s.querySelectorAll('text')].map((t) => ({ text: t.textContent ?? '', px: parseFloat(getComputedStyle(t).fontSize) * scale }));
      }),
    );
    for (const { text, px } of sizes) expect(px, text).toBeGreaterThanOrEqual(13);
  });
});
