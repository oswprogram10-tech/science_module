import { test, expect, gotoUnit, scrollWidth, runButton, selectIV, predict } from './helpers';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1100, height: 800 },
  { width: 1280, height: 800 },
];
const UNITS = ['g4-gases', 'g5-solution', 'g6-acid-base', 'g6-combustion', 'g5-heat', 'g5-light', 'g6-electricity', 'g4-land', 'g6-earth-motion', 'g6-seasons', 'g3-lifecycle', 'g6-plant', 'g4-ecosystem', 'g4-microbe', 'g5-body', 'g3-animal', 'g3-plantlife'];

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
      });
    }
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
