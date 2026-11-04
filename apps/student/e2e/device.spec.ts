import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(report, '심각한 접근성 위반이 없어야 해요').toEqual([]);
}

const micro = (page: Page) => page.getByRole('img', { name: /^알갱이 그림/ });

test('?tier=C이면 촛불 미시 화면 알갱이 수가 줄어든다', async ({ page }) => {
  await page.goto('/?tier=A#/unit/g6-combustion');
  await expect(micro(page)).toHaveAccessibleName('알갱이 그림: 산소 알갱이 13개, 이산화 탄소 알갱이 0개, 물 알갱이 0개, 그 밖의 기체 알갱이 47개');
  await page.goto('/?tier=B#/unit/g6-combustion');
  await expect(micro(page)).toHaveAccessibleName('알갱이 그림: 산소 알갱이 9개, 이산화 탄소 알갱이 0개, 물 알갱이 0개, 그 밖의 기체 알갱이 33개');
  await page.goto('/?tier=C#/unit/g6-combustion');
  await expect(micro(page)).toHaveAccessibleName('알갱이 그림: 산소 알갱이 5개, 이산화 탄소 알갱이 0개, 물 알갱이 0개, 그 밖의 기체 알갱이 19개');
});

test('?dev=1에 기기 등급이 나온다', async ({ page }) => {
  await page.goto('/?dev=1&tier=C#/unit/g4-gases');
  await expect(page.getByTestId('device-tier')).toHaveText(/^기기 등급 C \(메모리 .+, 코어 .+, 주소로 지정\)$/);
  await page.goto('/?dev=1#/unit/g4-gases');
  await expect(page.getByTestId('device-tier')).toHaveText(/^기기 등급 [ABC] \(메모리 .+, 코어 \d+\)$/);
});

test('?dev=1이 아니면 실물 센서 연결 버튼이 없다', async ({ page }) => {
  await page.goto('/#/unit/g4-gases');
  await expect(page.getByRole('group', { name: '센서' })).toBeVisible();
  await expect(page.getByRole('button', { name: /실물 온도 센서 연결/ })).toHaveCount(0);
});

test('웹에서 실물 온도 센서 연결을 누르면 안내가 나온다(블루투스 없음·거부·기기 없음)', async ({ page }) => {
  await page.goto('/?dev=1#/unit/g4-gases');
  const button = page.getByRole('button', { name: '실물 온도 센서 연결(시험)' });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.getByLabel('센서 종류').selectOption('microbit-temperature');
  await button.click();
  const status = page.locator('.real-temp-status');
  await expect(status).toHaveText(
    /이 기기에서는 블루투스 센서를 쓸 수 없어요\.|블루투스 사용이 허락되지 않았어요|센서를 고르지 않았거나 찾지 못했어요|연결하지 못했어요/,
  );
  await expect(page.getByText('실물 센서', { exact: true })).toHaveCount(0); // 연결 전에는 가상 온도계 그대로
  await expect(button).toBeEnabled();
});

test('블루투스 API가 없는 환경에서는 지원 안 함 안내', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'bluetooth', { value: undefined, configurable: true });
  });
  await page.goto('/?dev=1#/unit/g4-gases');
  await page.getByRole('button', { name: '실물 온도 센서 연결(시험)' }).click();
  await expect(page.locator('.real-temp-status')).toHaveText('이 기기에서는 블루투스 센서를 쓸 수 없어요.');
});

test('실물 센서 연결 조작이 있는 화면의 접근성(밝은·어두운)', async ({ page }) => {
  await page.goto('/?dev=1#/unit/g4-gases');
  await page.getByRole('button', { name: '실물 온도 센서 연결(시험)' }).click();
  await expect(page.locator('.real-temp-status')).not.toHaveText('');
  await expectNoSeriousViolations(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectNoSeriousViolations(page);
});

test('상대 경로 빌드: 해시 주소로 단원이 열린다', async ({ page }) => {
  await page.goto('/#/unit/g5-heat');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
