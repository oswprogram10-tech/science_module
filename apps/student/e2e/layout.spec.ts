import { test, expect, gotoUnit, scrollWidth, runButton, selectIV, predict } from './helpers';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1100, height: 800 },
  { width: 1280, height: 800 },
];
const UNITS = ['g4-gases', 'g5-solution', 'g6-acid-base', 'g6-combustion', 'g5-heat', 'g5-light', 'g6-electricity', 'g4-land', 'g6-earth-motion', 'g6-seasons', 'g3-lifecycle', 'g6-plant', 'g4-ecosystem', 'g4-microbe', 'g5-body', 'g3-animal', 'g3-plantlife', 'g3-force', 'g3-sound', 'g4-magnet', 'g6-motion', 'g4-water-state', 'g3-material', 'g5-mixture', 'g3-earth-sea', 'g4-night-sky', 'g5-strata', 'g5-weather', 'g3-health', 'g4-climate', 'g5-energy', 'g6-career'];

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

    test('g3-earth-sea 두 번째 활동(밀물과 썰물 관찰하기, 활동 탭 포함)에 가로 스크롤이 없다', async ({ page }) => {
      await gotoUnit(page, 'g3-earth-sea', { experiment: 'tide' });
      await expect(page.getByRole('tab', { name: /^활동 2 · / })).toBeVisible();
      await expect(page.getByTestId('tide-svg')).toBeVisible();
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
      const box = await page.getByTestId('tide-svg').boundingBox();
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

    // 변인 실험을 두 번째 활동으로 더한 여덟 단원(지레와 빗면, 소리 나는 물체의 떨림, 자석과 자석 사이, 용액의 진하기, 온도가 다른 두 물이 닿으면, 산성 용액과 염기성 용액 섞기, 시간에 따른 위치 변화, 연소 전과 후 비교하기): 활동 탭 포함 가로 스크롤이 없고 그림 셋이 폭 안에 들어온다.
    for (const [id, experiment] of [['g3-force', 'lever-lift'], ['g3-sound', 'sound-vibration'], ['g4-magnet', 'magnet-poles'], ['g5-solution', 'concentration'], ['g5-heat', 'heat-contact'], ['g6-acid-base', 'acid-base-mix'], ['g6-motion', 'position-time'], ['g6-combustion', 'combustion-products'], ['g3-force', 'push-pull'], ['g3-force', 'spring-scale'], ['g4-gases', 'gas-weight']] as const) {
      // 힘과 우리 생활의 활동 3·4(밀고 당기면 생기는 변화, 용수철저울로 무게 비교하기)와 여러 가지 기체 활동 2(공기를 넣은 페트병의 무게)도 같다: 활동 탭 넷도 폭 안에 들어온다.
      const n = (['g3-force', 'push-pull'] as readonly string[]).includes(experiment) ? 3 : experiment === 'spring-scale' ? 4 : 2;
      test(`${id} ${n}번째 활동(${experiment}, 활동 탭 포함)에 가로 스크롤이 없다`, async ({ page }) => {
        await gotoUnit(page, id, { experiment });
        await expect(page.getByRole('tab', { name: new RegExp(`^활동 ${n} · `) })).toBeVisible();
        await expect(page.getByRole('tab')).toHaveCount(id === 'g3-force' ? 4 : 2);
        await expect(page.getByRole('link', { name: '← 단원 목록' })).toBeVisible();
        const { sw, iw } = await scrollWidth(page);
        expect(sw).toBeLessThanOrEqual(iw);
        const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
        for (const right of tabs) expect(right).toBeLessThanOrEqual(vp.width + 1);
        // 눈으로 보기·둘째 그림·그래프 그림이 모두 화면 폭 안에 있다
        const figures = await page.locator('.views svg').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
        expect(figures).toHaveLength(3);
        for (const right of figures) expect(right).toBeLessThanOrEqual(vp.width + 1);
        // 예측 문구가 실험 설계 패널 밖으로 넘치지 않는다
        const overflow = await page.evaluate(() => {
          const label = document.getElementById('predict-label');
          const box = label?.closest('.predict');
          if (!label || !box) return 0;
          const range = document.createRange();
          range.selectNodeContents(label);
          return range.getBoundingClientRect().right - box.getBoundingClientRect().right;
        });
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }

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

    // 카드 분류 두 번째 활동 넷(사는 곳과 동물의 생김새, 사는 곳과 식물의 생김새, 생태계를 이루는 것 나누기, 퇴적암을 알갱이 크기로 나누기)도 활동 탭 포함 가로 스크롤이 없다.
    for (const [unit, experiment, cards] of [
      ['g3-animal', 'animal-habitat', 8],
      ['g3-plantlife', 'plant-habitat', 8],
      ['g4-ecosystem', 'living-nonliving', 10],
      ['g5-strata', 'rock-grain', 8],
    ] as const) {
      test(`${unit} 두 번째 활동(${experiment}, 활동 탭 포함)에 가로 스크롤이 없다`, async ({ page }) => {
        await gotoUnit(page, unit, { experiment });
        await expect(page.getByRole('tab', { name: /^활동 2 · / })).toBeVisible();
        await expect(page.getByRole('link', { name: '← 단원 목록' })).toBeVisible();
        const { sw, iw } = await scrollWidth(page);
        expect(sw).toBeLessThanOrEqual(iw);
        const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
        for (const right of tabs) expect(right).toBeLessThanOrEqual(vp.width + 1);
        const rights = await page.locator('.sort-pile .sort-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
        expect(rights).toHaveLength(cards);
        for (const right of rights) expect(right).toBeLessThanOrEqual(vp.width + 1);
      });
    }

    // 날씨와 우리 생활의 두 번째 활동(이슬·안개·구름 비교하기)도 활동 탭과 긴 카드 이름 포함 가로 스크롤이 없다.
    test('g5-weather 두 번째 활동(활동 탭 포함)에 가로 스크롤이 없다', async ({ page }) => {
      await gotoUnit(page, 'g5-weather', { experiment: 'dew-fog-cloud' });
      await expect(page.getByRole('tab', { name: /^활동 2 · / })).toBeVisible();
      await expect(page.getByRole('link', { name: '← 단원 목록' })).toBeVisible();
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
      const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
      for (const right of tabs) expect(right).toBeLessThanOrEqual(vp.width + 1);
      // 카드 8장이 화면 폭 안에 들어온다.
      const cards = await page.locator('.sort-pile .sort-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
      expect(cards).toHaveLength(8);
      for (const right of cards) expect(right).toBeLessThanOrEqual(vp.width + 1);
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
