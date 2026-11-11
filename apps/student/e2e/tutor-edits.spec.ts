import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, selectIV, predict, runTrial } from './helpers';

// 교사 앱(교사 PC 수업 서버가 내보내는 화면, 포트 8790)에서 튜터 질문을 고치고, 수업에 참여한 학생(앱 모드) 화면에 반영되는지 본다.
const HOST = 'http://localhost:8790/';
const NEW_BEFORE_RUN = '출발 높이를 바꾸면 무엇이 달라질지 먼저 적어 볼까요?';
const DEFAULT_BEFORE_RUN = '예측해 볼까요?';
const BEFORE_RUN = '실행 전(예측할 때)';
const REPEAT = '같은 조건으로 다시 했을 때';
const FIRST_TRIAL = '첫 시행 뒤';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const editor = (page: Page) => page.getByRole('dialog', { name: '튜터 질문 고치기' });
const line = (page: Page, label: string) => editor(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: label, exact: true }) });

async function openEditor(teacher: Page) {
  await teacher.getByRole('button', { name: '튜터 질문 고치기' }).click();
  await expect(editor(teacher)).toBeVisible();
  await editor(teacher).getByLabel('단원').selectOption({ label: '물체의 운동' });
}

/** 6학년 물체의 운동: 실행 전 질문을 고치고, 같은 조건으로 다시 했을 때를 끄고, 저장한다. */
async function editAndSave(teacher: Page) {
  await openEditor(teacher);
  await expect(editor(teacher).getByTestId('te-summary')).toHaveText('고친 질문 0개 · 끈 질문 0개 · 더한 질문 0개');
  await line(teacher, BEFORE_RUN).getByRole('textbox', { name: `${BEFORE_RUN} 질문` }).fill(NEW_BEFORE_RUN);
  await expect(line(teacher, BEFORE_RUN)).toContainText('✓ 검사 통과');
  await line(teacher, REPEAT).getByRole('switch', { name: `${REPEAT} 튜터 말하기` }).uncheck();
  await expect(editor(teacher).getByTestId('te-summary')).toHaveText('고친 질문 1개 · 끈 질문 1개 · 더한 질문 0개');
  await editor(teacher).getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor(teacher)).toContainText('저장했어요');
}

test.describe('튜터 질문 고치기', () => {
  test('고치고 끈 질문이 수업에 참여한 학생 화면에 나오고, 수업이 아닌 화면에는 기본 질문이 나온다', async ({ page: teacher, context }) => {
    await teacher.goto(HOST);
    await expect(teacher.getByRole('button', { name: '수업 만들기' })).toBeEnabled();

    // 금지 구절: 오류 문장이 나오고 저장할 수 없다. 기본으로 되돌리면 다시 저장할 수 있다.
    await openEditor(teacher);
    await line(teacher, FIRST_TRIAL).getByRole('textbox', { name: `${FIRST_TRIAL} 질문` }).fill('출발 높이가 높을수록 빨라질까요?');
    await expect(line(teacher, FIRST_TRIAL)).toContainText('정답이나 학년에 맞지 않는 말이 들어 있어요: ‘높을수록 빨라’');
    await expect(editor(teacher).getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    await expect(editor(teacher)).toContainText('검사를 통과하지 못한 줄이 있어서 저장할 수 없어요');
    await line(teacher, FIRST_TRIAL).getByRole('button', { name: `${FIRST_TRIAL} 기본으로` }).click();
    await expect(line(teacher, FIRST_TRIAL)).not.toContainText('정답이나 학년에');
    await expect(editor(teacher).getByRole('button', { name: '저장', exact: true })).toBeDisabled(); // 바뀐 것이 없다
    await editor(teacher).getByRole('button', { name: '닫기' }).click();
    await expect(editor(teacher)).toHaveCount(0);

    await editAndSave(teacher);
    // 새로고침해도(이 PC의 브라우저 저장소) 남아 있다.
    await teacher.reload();
    await openEditor(teacher);
    await expect(editor(teacher).getByTestId('te-summary')).toHaveText('고친 질문 1개 · 끈 질문 1개 · 더한 질문 0개');
    await expect(line(teacher, BEFORE_RUN).getByRole('textbox')).toHaveValue(NEW_BEFORE_RUN);
    await editor(teacher).getByRole('button', { name: '닫기' }).click();

    // 수업을 만들면 고친 내용이 학생 기기로 간다.
    await teacher.getByRole('button', { name: '수업 만들기' }).click();
    const code = (await teacher.getByTestId('class-code').textContent())!.trim();
    await expect(teacher.getByTestId('tutor-note')).toHaveText('튜터 질문: 고친 질문 2개를 학생 기기에 보냈어요');

    const s = await context.newPage();
    await s.goto('/?app=1&playback=0.3');
    await s.getByRole('button', { name: '수업 참여' }).click();
    const dialog = s.getByRole('dialog', { name: '수업 참여' });
    await dialog.getByLabel('선생님 PC 주소').fill('localhost:8790');
    await dialog.getByLabel('수업 코드').fill(code);
    await dialog.getByRole('button', { name: '4모둠', exact: true }).click();
    await dialog.getByRole('button', { name: '참여하기' }).click();
    await expect(s.getByTestId('classroom-status')).toHaveText(`수업 ${code} · 4모둠 · 연결됨`);

    await s.evaluate(() => {
      window.location.hash = '#/unit/g6-motion';
    });
    await expect(s.getByRole('heading', { level: 1, name: '물체의 운동' })).toBeVisible();
    await expect(tutorBox(s)).toContainText(NEW_BEFORE_RUN);

    // 같은 조건으로 다시 실행하면(repeat) 끈 상황이라 튜터 말풍선이 없다.
    await selectIV(s, '출발 높이');
    await predict(s, '변하지 않는다');
    await runTrial(s);
    await expect(tutorBox(s)).toContainText('이번 결과를 기준으로 삼을 거예요'); // 첫 시행은 기본 질문
    await predict(s, '변하지 않는다');
    await runTrial(s);
    await expect(s.getByRole('heading', { name: '생각해 볼까요?' })).toHaveCount(0);

    // 학생 기기 저장소에는 덧씌우기가 없다(메모리에만 둔다).
    const stored = await s.evaluate(() => JSON.stringify([{ ...sessionStorage }, { ...localStorage }]));
    expect(stored).not.toContain('출발 높이를 바꾸면 무엇이');
    expect(stored).not.toContain('"v":1');

    // 수업에서 나가면 기본 질문으로 돌아간다.
    await s.evaluate(() => {
      window.location.hash = '#/';
    });
    await s.getByRole('button', { name: '수업 나가기' }).click();
    await s.evaluate(() => {
      window.location.hash = '#/unit/g6-motion';
    });
    await expect(s.getByRole('heading', { level: 1, name: '물체의 운동' })).toBeVisible();
    await expect(s.getByRole('heading', { name: '생각해 볼까요?' })).toBeVisible();
    await expect(tutorBox(s)).toContainText(DEFAULT_BEFORE_RUN);
    await expect(tutorBox(s)).not.toContainText(NEW_BEFORE_RUN);
  });

  test('수업 없이(덧씌우기 없이) 열면 기본 문장이 나온다', async ({ page }) => {
    await page.goto('/?playback=0.3#/unit/g6-motion');
    await expect(page.getByRole('heading', { level: 1, name: '물체의 운동' })).toBeVisible();
    await expect(tutorBox(page)).toContainText(DEFAULT_BEFORE_RUN);
    await expect(tutorBox(page)).not.toContainText(NEW_BEFORE_RUN);
    await selectIV(page, '출발 높이');
    await predict(page, '변하지 않는다');
    await runTrial(page);
    await predict(page, '변하지 않는다');
    await runTrial(page);
    await expect(tutorBox(page)).toContainText('앞 시행과 조건이 같아요');
  });

  test('나중에 참여한 학생도 받고, 수업 중 다시 저장하면 학생 화면이 바뀐다', async ({ page: teacher, context }) => {
    await teacher.goto(HOST);
    await expect(teacher.getByRole('button', { name: '수업 만들기' })).toBeEnabled();
    await editAndSave(teacher);
    await editor(teacher).getByRole('button', { name: '닫기' }).click();
    await teacher.getByRole('button', { name: '수업 만들기' }).click();
    const code = (await teacher.getByTestId('class-code').textContent())!.trim();

    const s = await context.newPage();
    await s.goto('/?app=1&playback=0.3');
    await s.getByRole('button', { name: '수업 참여' }).click();
    const dialog = s.getByRole('dialog', { name: '수업 참여' });
    await dialog.getByLabel('선생님 PC 주소').fill('localhost:8790');
    await dialog.getByLabel('수업 코드').fill(code);
    await dialog.getByRole('button', { name: '2모둠', exact: true }).click();
    await dialog.getByRole('button', { name: '참여하기' }).click();
    await expect(s.getByTestId('classroom-status')).toContainText('연결됨');
    await s.evaluate(() => {
      window.location.hash = '#/unit/g6-motion';
    });
    await expect(tutorBox(s)).toContainText(NEW_BEFORE_RUN);

    // 수업 중에 교사가 질문을 끄면 학생 화면의 말풍선이 사라진다.
    await teacher.getByRole('button', { name: '튜터 질문 고치기' }).click();
    await editor(teacher).getByLabel('단원').selectOption({ label: '물체의 운동' });
    await line(teacher, BEFORE_RUN).getByRole('switch', { name: `${BEFORE_RUN} 튜터 말하기` }).uncheck();
    await editor(teacher).getByRole('button', { name: '저장', exact: true }).click();
    await expect(s.getByRole('heading', { name: '생각해 볼까요?' })).toHaveCount(0);
    // 편집 화면은 수업 화면 위에 열려 있어도 수업은 계속된다.
    await editor(teacher).getByRole('button', { name: '닫기' }).click();
    await expect(teacher.getByTestId('class-code')).toHaveText(code);
    await expect(teacher.getByTestId('tutor-note')).toHaveText('튜터 질문: 고친 질문 2개를 학생 기기에 보냈어요');
  });

  test('질문 더하기, 모두 기본으로, 저장하지 않고 닫기', async ({ page }) => {
    await page.goto(HOST);
    await openEditor(page);
    const add = editor(page).getByRole('region', { name: '질문 더하기' });
    // 아직 질문이 없는 상황(바닥만 바꿨을 때)을 고른다.
    await add.getByLabel('더할 상황').selectOption({ label: '‘바닥’만 바꿨을 때' });
    await add.getByRole('button', { name: '더하기' }).click();
    const added = editor(page).getByRole('textbox', { name: '‘바닥’만 바꿨을 때 질문' });
    await expect(added).toBeVisible();
    await expect(editor(page).getByRole('button', { name: '저장', exact: true })).toBeDisabled(); // 빈 질문은 저장할 수 없다
    await added.fill('〔카드 이름〕만 바꿨나요?');
    await expect(editor(page)).toContainText('쓸 수 없는 칸이에요: 〔카드 이름〕');
    await added.fill('〔바꾼 조건〕만 바꿨을 때 달라진 값은 무엇인가요?');
    await expect(editor(page)).toContainText('✓ 검사 통과');
    await expect(editor(page).getByTestId('te-summary')).toHaveText('고친 질문 0개 · 끈 질문 0개 · 더한 질문 1개');
    // 저장하지 않고 닫으면 확인을 묻는다.
    await editor(page).getByRole('button', { name: '닫기' }).click();
    await expect(page.getByRole('dialog', { name: '저장하지 않고 닫을까요?' })).toBeVisible();
    await page.getByRole('button', { name: '취소' }).click();
    await editor(page).getByRole('button', { name: '저장', exact: true }).click();
    await expect(editor(page)).toContainText('저장했어요');
    // 모두 기본으로: 확인 뒤 저장하면 비워진다.
    await editor(page).getByRole('button', { name: '모두 기본으로' }).click();
    await page.getByRole('dialog', { name: '모두 기본으로 되돌릴까요?' }).getByRole('button', { name: '모두 기본으로' }).click();
    await expect(editor(page).getByTestId('te-summary')).toHaveText('고친 질문 0개 · 끈 질문 0개 · 더한 질문 0개');
    await editor(page).getByRole('button', { name: '저장', exact: true }).click();
    await expect(editor(page)).toContainText('저장했어요');
    await editor(page).getByRole('button', { name: '닫기' }).click();
    await expect(editor(page)).toHaveCount(0);
  });

  test('파일로 내보내고 불러온다(넣지 못한 줄은 이유와 함께 알린다)', async ({ page }) => {
    await page.goto(HOST);
    await editAndSave(page);
    const [download] = await Promise.all([page.waitForEvent('download'), editor(page).getByRole('button', { name: '파일로 내보내기' }).click()]);
    // 파일 이름(튜터질문-YYYYMMDD.json)은 단위 테스트로 확인한다(헤드리스 크롬은 한글 이름을 suggestedFilename에 돌려주지 않는다).
    const saved = JSON.parse(readFileSync((await download.path())!, 'utf8')) as { v: number; units: Record<string, Record<string, { changed: Record<string, { text?: string; off?: boolean }> }>> };
    expect(saved.v).toBe(1);
    expect(saved.units['g6-motion']!['ramp-cart']!.changed).toEqual({ '|before-run|': { text: NEW_BEFORE_RUN }, '|repeat|': { off: true } });
    // 모두 기본으로 + 저장한 뒤, 일부가 틀린 파일을 불러온다.
    await editor(page).getByRole('button', { name: '모두 기본으로' }).click();
    await page.getByRole('dialog', { name: '모두 기본으로 되돌릴까요?' }).getByRole('button', { name: '모두 기본으로' }).click();
    await editor(page).getByRole('button', { name: '저장', exact: true }).click();
    const file = JSON.stringify({
      v: 1,
      units: { 'g6-motion': { 'ramp-cart': { changed: { '|before-run|': { text: NEW_BEFORE_RUN }, '|first-trial|': { text: '높을수록 빨라질까요?' } }, added: [] } } },
    });
    await editor(page).getByTestId('te-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(file) });
    await expect(editor(page)).toContainText('1줄을 불러왔어요');
    await expect(editor(page)).toContainText('넣지 못한 줄 1줄');
    await expect(editor(page)).toContainText('정답이나 학년에 맞지 않는 말이 들어 있어요');
    await expect(editor(page).getByTestId('te-summary')).toHaveText('고친 질문 1개 · 끈 질문 0개 · 더한 질문 0개');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`편집 화면 접근성(${scheme === 'light' ? '밝게' : '어둡게'})과 좁은 화면에서 가로 스크롤이 없다`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(HOST);
      await openEditor(page);
      await line(page, BEFORE_RUN).getByRole('textbox').fill('높을수록 빨라요?'); // 오류 문장도 대비를 검사한다
      await expect(line(page, BEFORE_RUN)).toContainText('정답이나 학년에');
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `폭 ${width}`).toEqual([]);
        const overflow = await page.evaluate(() => document.querySelector('.te-backdrop')!.scrollWidth - document.querySelector('.te-backdrop')!.clientWidth);
        expect(overflow, `폭 ${width}: 가로 스크롤`).toBeLessThanOrEqual(0);
      }
    });
  }
});
