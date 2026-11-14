import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers';

// 교사 앱(교사 PC 수업 서버가 내보내는 화면, 포트 8790)의 「튜터 모델 고르기」: 두 예시 모델의 답을 견주고, 반에서 쓸 모델을 고른다.
const HOST = 'http://localhost:8790/';
const picker = (page: Page) => page.getByRole('dialog', { name: '튜터 모델 고르기' });

async function openPicker(page: Page) {
  await page.goto(HOST);
  await page.getByRole('button', { name: '튜터 모델 고르기' }).click();
  await expect(picker(page)).toBeVisible();
  await expect(picker(page).getByTestId('mp-sample').first()).toBeVisible(); // 비교 자료를 따로 불러온다
}

test.describe('튜터 모델 고르기', () => {
  test('모델을 고르고 답을 평가하면 이 PC에 남는다', async ({ page }) => {
    await openPicker(page);
    const d = picker(page);
    await expect(d).toContainText('아직 모델을 고르지 않았어요');
    await expect(d.getByRole('button', { name: '모델 내려받기(준비 중)' })).toBeDisabled();

    await d.getByTestId('mp-model-qwen3-1.7b').getByRole('button', { name: '이 모델 쓰기' }).click();
    await expect(d).toContainText('이 반에서 쓸 모델: Qwen3 1.7B');

    // 기본은 이름을 가리고 답 A·B로 보여 준다.
    const first = d.getByTestId('mp-sample').first();
    await expect(first).toContainText('답 A');
    await expect(first).not.toContainText('Qwen3 1.7B');
    await first.getByRole('button', { name: '답 A가 더 나아요' }).click();
    await expect(d.getByTestId('mp-tally')).toContainText('평가한 문항 1/');
    await d.getByRole('button', { name: '모델 이름 보기' }).click();
    await expect(first.getByRole('button', { name: /(Qwen3 4B \(고사양 기기용\)|Qwen3 1.7B)가 더 나아요/ }).first()).toHaveAttribute('aria-pressed', 'true');

    // 아직 평가하지 않은 문항만: 방금 평가한 문항이 빠진다.
    const firstText = (await first.locator('.mp-situation').textContent()) ?? '';
    await d.getByRole('button', { name: '아직 평가하지 않은 문항만' }).click();
    await expect(d.getByTestId('mp-sample').first().locator('.mp-situation')).not.toHaveText(firstText);
    // 거른 채로 평가해도 그 문항은 이번에 보는 동안 남고, 누른 단추에 포커스가 남는다.
    const next = d.getByTestId('mp-sample').first();
    const nextText = (await next.locator('.mp-situation').textContent()) ?? '';
    const voteBtn = next.getByRole('group', { name: '1번 문항: 어느 답이 더 나은가요?' }).getByRole('button', { name: '비슷해요' });
    await voteBtn.click();
    await expect(d.getByTestId('mp-sample').first().locator('.mp-situation')).toHaveText(nextText);
    await expect(voteBtn).toBeFocused();
    await expect(d.getByTestId('mp-tally')).toContainText('평가한 문항 2/');
    await voteBtn.click(); // 다시 누르면 평가를 지운다
    await expect(d.getByTestId('mp-tally')).toContainText('평가한 문항 1/');

    // 어려운 말 문항만 거른다.
    await d.getByLabel('문항 종류').selectOption('redteam');
    await expect(d.getByTestId('mp-sample').first()).toContainText('어려운 말:');

    // 닫았다가 새로고침해도 남아 있다(교사 PC의 브라우저 저장소).
    await d.getByRole('button', { name: '닫기' }).click();
    await expect(picker(page)).toHaveCount(0);
    await openPicker(page);
    await expect(picker(page)).toContainText('이 반에서 쓸 모델: Qwen3 1.7B');
    await expect(picker(page).getByTestId('mp-tally')).toContainText('평가한 문항 1/');
    await page.keyboard.press('Escape');
    await expect(picker(page)).toHaveCount(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`화면 접근성(${scheme === 'light' ? '밝게' : '어둡게'})과 좁은 화면에서 가로 스크롤이 없다`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openPicker(page);
      await picker(page).getByRole('button', { name: '자동 검사에 걸린 문항만' }).click(); // 검사 표시(주황 칩)도 대비를 본다
      await picker(page).getByTestId('mp-model-qwen3-4b').getByRole('button', { name: '이 모델 쓰기' }).click();
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
