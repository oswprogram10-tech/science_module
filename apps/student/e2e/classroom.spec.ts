import { test, expect, createClass, joinClass, studentUrl, selectIV, predict, runTrial, resultRows, TEACHER_URL } from './helpers';

const card = (teacher: import('@playwright/test').Page, group: number) => teacher.getByRole('listitem', { name: `${group}모둠`, exact: true });

test.describe('수업 연결', () => {
  test('교사가 수업을 만들고 학생 두 명이 참여하면 카드에 연결됨이 보인다', async ({ page: teacher, context }) => {
    const code = await createClass(teacher);
    // 주소 해시에 코드와 토큰이 들어가고, 새로고침해도 같은 수업을 다시 본다.
    await expect(teacher).toHaveURL(new RegExp(`#class=${code}&token=[0-9a-f]{32}$`));
    await expect(card(teacher, 2)).toContainText('참여 전');

    const s2 = await context.newPage();
    const s5 = await context.newPage();
    await joinClass(s2, code, 2);
    await joinClass(s5, code, 5);
    await expect(card(teacher, 2)).toContainText('연결됨');
    await expect(card(teacher, 5)).toContainText('연결됨');
    await expect(card(teacher, 3)).toContainText('참여 전');

    await teacher.reload();
    await expect(teacher.getByTestId('class-code')).toHaveText(code);
    await expect(card(teacher, 2)).toContainText('연결됨');

    // 새로고침해도 학생은 다시 참여한다(sessionStorage).
    await s2.reload();
    await expect(s2.getByTestId('classroom-status')).toHaveText(`수업 ${code} · 2모둠 · 연결됨`);
    await expect(card(teacher, 2)).toContainText('연결됨');
  });

  test('같은 모둠 번호로 두 번 참여하면 안내가 나온다', async ({ page: teacher, context }) => {
    const code = await createClass(teacher);
    const a = await context.newPage();
    await joinClass(a, code, 4);
    const b = await context.newPage();
    await b.goto(studentUrl());
    await b.getByRole('button', { name: '수업 참여' }).click();
    const dialog = b.getByRole('dialog', { name: '수업 참여' });
    await dialog.getByLabel('수업 코드').fill(code);
    await dialog.getByRole('button', { name: '4모둠', exact: true }).click();
    await dialog.getByRole('button', { name: '참여하기' }).click();
    await expect(dialog.getByRole('alert')).toContainText('이미 쓰고 있어요');
    await dialog.getByRole('button', { name: '닫기' }).click();
    await expect(b.getByRole('button', { name: '수업 참여' })).toBeVisible();
  });

  test('2모둠 학생이 용해와 용액을 한 번 실행하면 교사 카드의 시행 수가 1이 된다', async ({ page: teacher, context }) => {
    const code = await createClass(teacher);
    const s2 = await context.newPage();
    await joinClass(s2, code, 2);
    await expect(card(teacher, 2)).toContainText('단원 고르는 중');
    await s2.evaluate(() => {
      window.location.hash = '#/unit/g5-solution';
    });
    await expect(s2.getByRole('heading', { level: 1 })).toHaveText('용해와 용액');
    await expect(card(teacher, 2)).toContainText('용해와 용액');
    await expect(card(teacher, 2)).toContainText('실험 설계 중');
    await selectIV(s2, '물의 온도');
    await predict(s2, '늘어난다');
    await runTrial(s2);
    await expect(resultRows(s2)).toHaveCount(1);
    await expect(card(teacher, 2)).toContainText('시행 1회');
    await expect(card(teacher, 2)).toContainText('결과 보는 중');
  });

  test('5모둠의 모의 안전 경고가 교사 화면에 붉게 보이고, 확인하면 사라진다', async ({ page: teacher, context }) => {
    const code = await createClass(teacher);
    const s5 = await context.newPage();
    await joinClass(s5, code, 5, { dev: true });
    await s5.evaluate(() => {
      window.location.hash = '#/unit/g5-solution';
    });
    await s5.getByRole('button', { name: /NO_GOGGLES/ }).click();
    await expect(s5.getByRole('alert')).toContainText('보안경');

    const banner = teacher.getByRole('alert');
    await expect(banner).toContainText('확인하지 않은 안전 경고 1건');
    await expect(card(teacher, 5)).toHaveClass(/alert/);
    await expect(card(teacher, 5)).toContainText('⚠ 보안경 안 씀');
    await expect(card(teacher, 5)).toContainText('안전 경고로 실험이 잠겨 있어요');
    // 경고가 있는 모둠이 맨 위로 올라온다.
    await expect(teacher.getByRole('listitem').first()).toHaveAccessibleName('5모둠');

    await card(teacher, 5).getByRole('button', { name: '확인' }).click();
    await expect(banner).toHaveCount(0);
    await expect(card(teacher, 5)).not.toHaveClass(/alert/);
    // 학생이 "착용했어요"를 눌러야 잠금이 풀린다.
    await s5.getByRole('button', { name: '착용했어요' }).click();
    await expect(card(teacher, 5)).not.toContainText('잠겨 있어요');
  });

  test('교사가 모두 멈춤을 누르면 두 학생 화면에 막이 뜨고, 다시 시작하면 사라진다', async ({ page: teacher, context }) => {
    const code = await createClass(teacher);
    const s2 = await context.newPage();
    const s5 = await context.newPage();
    await joinClass(s2, code, 2);
    await joinClass(s5, code, 5);
    await s5.evaluate(() => {
      window.location.hash = '#/unit/g5-solution';
    });

    await teacher.getByRole('button', { name: '모두 멈춤' }).click();
    for (const s of [s2, s5]) {
      const overlay = s.getByTestId('pause-overlay');
      await expect(overlay).toBeVisible();
      await expect(overlay).toHaveText('선생님 말씀을 들어요 ✋');
      await expect(s.locator('[aria-live="assertive"]').filter({ has: overlay })).toHaveCount(1);
      await expect(s.locator('div[inert]')).toHaveCount(1); // 아래 화면은 입력을 받지 않는다
    }
    await expect(teacher.getByRole('button', { name: '다시 시작' })).toBeVisible();
    await expect(teacher.getByText('모든 학생 화면이 멈춰 있어요')).toBeVisible();

    // 멈춘 동안 들어온 학생도 막을 본다.
    const s7 = await context.newPage();
    await s7.goto(studentUrl());
    await s7.getByRole('button', { name: '수업 참여' }).click();
    const dialog = s7.getByRole('dialog', { name: '수업 참여' });
    await dialog.getByLabel('수업 코드').fill(code);
    await dialog.getByRole('button', { name: '7모둠', exact: true }).click();
    await dialog.getByRole('button', { name: '참여하기' }).click();
    await expect(s7.getByTestId('pause-overlay')).toBeVisible();

    await teacher.getByRole('button', { name: '다시 시작' }).click();
    for (const s of [s2, s5, s7]) {
      await expect(s.getByTestId('pause-overlay')).toHaveCount(0);
      await expect(s.locator('div[inert]')).toHaveCount(0);
    }
  });

  test('수업 끝내기는 확인 단계를 거치고 학생에게 알린다', async ({ page: teacher, context }) => {
    const code = await createClass(teacher);
    const s1 = await context.newPage();
    await joinClass(s1, code, 1);
    await teacher.getByRole('button', { name: '수업 끝내기' }).click();
    const dialog = teacher.getByRole('dialog', { name: '수업을 끝낼까요?' });
    await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
    await teacher.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await teacher.getByRole('button', { name: '수업 끝내기' }).click();
    await teacher.getByRole('dialog').getByRole('button', { name: '수업 끝내기' }).click();
    await expect(teacher.getByRole('button', { name: '수업 만들기' })).toBeVisible();
    await expect(s1.getByRole('alert')).toContainText('선생님이 수업을 끝냈어요');
    await expect(s1.getByRole('button', { name: '수업 참여' })).toBeVisible();
  });

  test('서버가 없어도 학생 앱 실험은 되고 다시 연결 중이 보인다', async ({ page, errors }) => {
    // 이 테스트만의 서버(8788)를 띄웠다가 내린다.
    const { buildServer } = await import('../../server/src/app');
    const srv = await buildServer();
    await srv.app.listen({ port: 8788, host: '127.0.0.1' });
    const server = 'ws://localhost:8788/ws';
    try {
      const creator = new WebSocket(server);
      const code = await new Promise<string>((res, rej) => {
        creator.onopen = () => creator.send(JSON.stringify({ t: 'create' }));
        creator.onmessage = (ev) => {
          const m = JSON.parse(String(ev.data));
          if (m.t === 'created') res(m.code);
        };
        creator.onerror = () => rej(new Error('서버에 연결하지 못했어요'));
      });
      await joinClass(page, code, 3, { server });
      await page.evaluate(() => {
        window.location.hash = '#/unit/g5-solution';
      });
      await expect(page.getByTestId('classroom-status')).toHaveText(`수업 ${code} · 3모둠 · 연결됨`);

      creator.close();
      await srv.app.close(); // 서버를 내린다
      await expect(page.getByTestId('classroom-status')).toHaveText(`수업 ${code} · 3모둠 · 다시 연결 중`);

      await selectIV(page, '물의 온도');
      await predict(page, '늘어난다');
      await runTrial(page);
      await expect(resultRows(page)).toHaveCount(1);
    } finally {
      await srv.app.close().catch(() => {});
    }
    // 서버에 닿지 못한 연결 오류는 브라우저가 콘솔에 남긴다. 그것만 허용한다.
    const unexpected = errors.filter((e) => !/WebSocket connection to 'ws:\/\/localhost:8788\/ws' failed/.test(e));
    expect(unexpected).toEqual([]);
    errors.length = 0;
  });

  test('서버 주소가 없으면 수업 참여 버튼이 보이지 않는다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: '수업 참여' })).toHaveCount(0);
  });

  test('경고음 버튼과 교사 화면의 첫 모습', async ({ page: teacher }) => {
    await teacher.goto(TEACHER_URL);
    await expect(teacher.getByRole('heading', { level: 1, name: '교사 대시보드' })).toBeVisible();
    const sound = teacher.getByRole('button', { name: '알림 소리 켜기' });
    await sound.click();
    await expect(teacher.getByRole('button', { name: '알림 소리 켜짐' })).toBeVisible();
    // 소리를 켜도 화면 오류가 없어야 한다(errors fixture).
  });
});
