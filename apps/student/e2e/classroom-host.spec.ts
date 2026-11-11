import { test, expect } from './helpers';

// 교사 PC 수업 서버(apps/classroom-host 묶음 JS, 포트 8790)가 교사 화면을 내보내고,
// 학생 화면은 "앱 모드"(?app=1)로 선생님 PC 주소를 입력해 참여한다.
const HOST = 'http://localhost:8790/';
const HOST_KEY = 'sci-bridge.classroom-host.v1';

test.describe('교사 PC 수업 서버', () => {
  test('교사 화면에 학생 앱에 입력할 주소와 QR이 보이고, 앱 모드 학생이 주소를 입력해 참여한다', async ({ page: teacher, context, request }) => {
    await teacher.goto(HOST);
    const create = teacher.getByRole('button', { name: '수업 만들기' });
    await expect(create).toBeEnabled(); // ws://localhost:8790/ws 로 이어졌다
    // 주소와 QR(서버의 /host-info가 알려 준 이 PC의 사설 IPv4. 없는 환경이면 안내 문구)
    const info = (await (await request.get('http://localhost:8790/host-info')).json()) as { addresses: string[]; port: number };
    expect(info.port).toBe(8790);
    const box = teacher.getByTestId('host-address');
    await expect(box).toBeVisible();
    if (info.addresses.length > 0) {
      await expect(box).toContainText('학생 앱에 입력할 주소');
      await expect(teacher.getByTestId('host-address-value')).toHaveText(`${info.addresses[0]}:${info.port}`);
      await expect(teacher.getByTestId('host-qr').locator('svg')).toBeVisible();
    } else {
      await expect(box).toContainText('주소를 찾지 못했어요');
    }

    await create.click();
    const code = (await teacher.getByTestId('class-code').textContent())!.trim();
    expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);

    // 학생(앱 모드): 서버 주소는 대화 상자에서 입력한다.
    const s = await context.newPage();
    await s.goto('/?app=1&playback=0.3');
    await s.getByRole('button', { name: '수업 참여' }).click();
    const dialog = s.getByRole('dialog', { name: '수업 참여' });
    const hostInput = dialog.getByLabel('선생님 PC 주소');
    await expect(hostInput).toBeVisible();
    await hostInput.fill('localhost:8790');
    await dialog.getByLabel('수업 코드').fill(code);
    await dialog.getByRole('button', { name: '3모둠', exact: true }).click();
    await dialog.getByRole('button', { name: '참여하기' }).click();
    await expect(s.getByTestId('classroom-status')).toHaveText(`수업 ${code} · 3모둠 · 연결됨`);
    await expect(teacher.getByRole('listitem', { name: '3모둠', exact: true })).toContainText('연결됨');

    // 기억하는 것은 주소 문자열뿐이다.
    expect(await s.evaluate((k) => localStorage.getItem(k), HOST_KEY)).toBe('localhost:8790');
    // 새로고침해도(주소를 다시 입력하지 않아도) 다시 참여한다.
    await s.reload();
    await expect(s.getByTestId('classroom-status')).toHaveText(`수업 ${code} · 3모둠 · 연결됨`);
    // 나갔다가 다시 열면 입력칸에 마지막 주소가 채워져 있다.
    await s.getByRole('button', { name: '수업 나가기' }).click();
    await s.getByRole('button', { name: '수업 참여' }).click();
    await expect(s.getByRole('dialog', { name: '수업 참여' }).getByLabel('선생님 PC 주소')).toHaveValue('localhost:8790');
  });

  test('앱 모드에서는 서버 주소가 없어도 수업 참여가 보이고, 틀린 주소는 안내한다. 웹에서는 그대로 숨는다', async ({ page }) => {
    await page.goto('/?playback=0.3');
    await expect(page.getByRole('heading', { level: 1, name: '과학 실험 단원 목록' })).toBeVisible();
    await expect(page.getByRole('button', { name: '수업 참여' })).toHaveCount(0);

    await page.goto('/?app=1&playback=0.3');
    await page.getByRole('button', { name: '수업 참여' }).click();
    const dialog = page.getByRole('dialog', { name: '수업 참여' });
    await dialog.getByLabel('선생님 PC 주소').fill('http://x y');
    await expect(dialog.getByText('주소를 다시 확인해 주세요')).toBeVisible();
    await dialog.getByLabel('수업 코드').fill('ABC234');
    await dialog.getByRole('button', { name: '1모둠', exact: true }).click();
    await expect(dialog.getByRole('button', { name: '참여하기' })).toBeDisabled();
    // 주소를 비우면 설정된 서버 주소가 없으므로 여전히 참여할 수 없다.
    await dialog.getByLabel('선생님 PC 주소').fill('');
    await expect(dialog.getByRole('button', { name: '참여하기' })).toBeDisabled();
  });

  test('수업 서버가 아닌 곳(개발·미리보기 교사 화면)에서는 주소 상자가 없다', async ({ page }) => {
    await page.goto('http://localhost:4175/');
    await expect(page.getByRole('button', { name: '수업 만들기' })).toBeEnabled();
    await expect(page.getByTestId('host-address')).toHaveCount(0);
  });
});
