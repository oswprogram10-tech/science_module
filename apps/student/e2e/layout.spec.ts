import { test, expect, gotoUnit, scrollWidth, runButton, selectIV, predict } from './helpers';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1100, height: 800 },
  { width: 1280, height: 800 },
];
const UNITS = ['g4-gases', 'g5-solution', 'g6-acid-base', 'g6-combustion', 'g5-heat', 'g5-light', 'g6-electricity', 'g4-land', 'g6-earth-motion', 'g6-seasons', 'g3-lifecycle', 'g6-plant', 'g4-ecosystem', 'g4-microbe', 'g5-body', 'g3-animal', 'g3-plantlife', 'g3-force', 'g3-sound', 'g4-magnet', 'g6-motion', 'g4-water-state', 'g3-material', 'g5-mixture', 'g4-night-sky', 'g5-strata', 'g5-weather', 'g3-health', 'g4-climate', 'g5-energy', 'g6-career'];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('단원 목록에 가로 스크롤이 없다', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
    });

    for (const id of UNITS) {
      test(`${id}에 가로 스크롤이 없다`, async ({ page }) => {
        await gotoUnit(page, id, { dev: id === 'g6-acid-base' || id === 'g6-combustion' || id === 'g5-heat' || id === 'g5-light' || id === 'g6-electricity' || id === 'g4-land' });
        await expect(page.getByRole('link', { name: '← 단원 목록' })).toBeVisible();
        const { sw, iw } = await scrollWidth(page);
        expect(sw).toBeLessThanOrEqual(iw);
        // 예측 문구가 실험 설계 패널 밖으로 넘치지 않는다(긴 문구는 줄을 바꾼다).
        const overflow = await page.evaluate(() => {
          const label = document.getElementById('predict-label');
          const box = label?.closest('.predict');
          if (!label || !box) return 0;
          // 요소 상자가 아니라 글자 자체가 차지한 범위로 잰다(block이면 상자는 넘쳐도 폭이 같다).
          const range = document.createRange();
          range.selectNodeContents(label);
          return range.getBoundingClientRect().right - box.getBoundingClientRect().right;
        });
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }

    test('g4-climate 기온 자료 패널을 펼쳐도(표까지) 가로 스크롤이 없다', async ({ page }) => {
      await gotoUnit(page, 'g4-climate');
      await page.getByTestId('climate-data').locator('summary').first().click();
      await page.getByTestId('climate-table').locator('summary').click();
      await expect(page.getByTestId('climate-svg')).toBeVisible();
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
      const box = await page.getByTestId('climate-svg').boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test('g4-land 두 번째 활동(흐르는 물, 활동 탭 포함)에 가로 스크롤이 없다', async ({ page }) => {
      await gotoUnit(page, 'g4-land', { experiment: 'stream-table' });
      await expect(page.getByRole('tab', { name: /^활동 2 · / })).toBeVisible();
      await expect(page.getByRole('link', { name: '← 단원 목록' })).toBeVisible();
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
      const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
      for (const right of tabs) expect(right).toBeLessThanOrEqual(vp.width + 1);
    });

    // 한 단원에 여러 활동: 두 번째 활동(분리 방법 고르기)과 활동 탭도 가로 스크롤이 없다.
    test('g5-mixture 두 번째 활동(활동 탭 포함)에 가로 스크롤이 없다', async ({ page }) => {
      await gotoUnit(page, 'g5-mixture', { experiment: 'separation-methods' });
      await expect(page.getByRole('tab', { name: /^활동 2 · / })).toBeVisible();
      await expect(page.getByRole('link', { name: '← 단원 목록' })).toBeVisible();
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
      // 탭이 화면 폭 안에 들어온다(긴 이름은 줄을 바꾼다).
      const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
      for (const right of tabs) expect(right).toBeLessThanOrEqual(vp.width + 1);
    });
  });
}

test.describe('어두운 화면', () => {
  test.use({ colorScheme: 'dark' });

  test('g5-solution 실행 버튼 글자색은 어두운 남색이다', async ({ page }) => {
    await gotoUnit(page, 'g5-solution');
    // 실행 버튼이 켜진(활성) 상태의 색을 본다.
    await selectIV(page, '물의 온도');
    await predict(page, '늘어난다');
    await expect(runButton(page)).toBeEnabled();
    await expect(runButton(page)).toHaveCSS('color', 'rgb(11, 26, 42)');
  });
});
