import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, gotoUnit, runButton, confirmSafetyDialog } from './helpers';

/**
 * 모든 단원의 SVG 글자는 화면에서 13 CSS px 이상이어야 한다(휴대폰 390 px, 데스크톱 1280 px).
 * 화면 크기 = 글자 font-size × SVG가 화면에 그려진 배율(getScreenCTM). 비어 있지 않고 실제로 그려지는 <text>는 모두 잰다.
 * 제외하는 글자는 없다: aria-hidden 글자도 눈에 보이는 읽을거리(눈금, 라벨)라서 함께 잰다.
 * 단원 목록은 content/units 폴더에서 읽는다(units.ts가 그 폴더의 매니페스트를 모두 불러온다).
 */
const MIN_PX = 13;
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

const UNITS_DIR = join(process.cwd(), '..', '..', 'content', 'units');
// 활동이 여럿인 단원은 활동마다 하나씩 잰다(첫 활동은 단원 id만, 나머지는 `단원 id/활동 id`로 부른다).
const UNITS = readdirSync(UNITS_DIR)
  .sort()
  .flatMap((id) => {
    const manifest = JSON.parse(readFileSync(join(UNITS_DIR, id, 'manifest.json'), 'utf8')) as { experiments: { id: string; module: string }[] };
    return manifest.experiments.map((e, i) => ({ id, name: i === 0 ? id : `${id}/${e.id}`, experiment: i === 0 ? undefined : e.id, module: e.module }));
  });

const NO_SVG_TEXT = new Set(['g3-animal', 'g3-material', 'g3-plantlife', 'g5-strata', 'g6-acid-base', 'g6-career', 'g5-mixture/separation-methods']);

test('단원 목록: 32개 단원의 모든 활동(33개)을 잰다', () => {
  expect(new Set(UNITS.map((u) => u.id)).size).toBe(32);
  expect(UNITS.length).toBe(33);
  expect(UNITS.map((u) => u.name)).toContain('g5-mixture/separation-methods');
});

/** 지금 화면의 SVG 글자를 재서 13 px보다 작은 것, 그림 밖으로 잘린 것, (그래프에서) 서로 겹친 것을 "상태 | 그림 | 글자 | 문제"로 돌려준다. */
async function smallTexts(page: Page, state: string): Promise<string[]> {
  const found = await page.evaluate((min) => {
    const out: string[] = [];
    const seen = { count: 0 };
    for (const svg of Array.from(document.querySelectorAll('svg'))) {
      const label = String(svg.closest('figure')?.getAttribute('aria-label') ?? svg.getAttribute('aria-label') ?? svg.parentElement?.className ?? '?').split(/[:,.]/)[0];
      const frame = svg.getBoundingClientRect();
      const drawn: { content: string; box: DOMRect }[] = [];
      for (const t of Array.from(svg.querySelectorAll('text'))) {
        const content = (t.textContent ?? '').trim();
        if (!content) continue;
        const cs = getComputedStyle(t);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const box = t.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue; // 그려지지 않는 글자(접힌 곳 등)
        seen.count++;
        drawn.push({ content, box });
        const m = (t as SVGGraphicsElement).getScreenCTM();
        const px = parseFloat(cs.fontSize) * (m ? Math.hypot(m.a, m.b) : 1);
        const name = `${label} | "${content.slice(0, 16)}"`;
        if (px < min - 0.05) out.push(`${name} | ${px.toFixed(1)}px`);
        // 글자 상자가 그림 틀 밖으로 나가면 잘린다(글자 상자의 위아래 여백 1 px는 봐준다).
        if (box.left < frame.left - 1 || box.right > frame.right + 1 || box.top < frame.top - 1 || box.bottom > frame.bottom + 1) out.push(`${name} | 그림 밖으로 잘림`);
      }
      // 그래프는 눈금·라벨·표식 글자가 서로 겹치면 읽을 수 없다.
      if (label === '그래프로 보기' || label === '서울의 해마다 평균 기온' || (svg.getAttribute('data-testid') ?? '').startsWith('moon-')) {
        for (let i = 0; i < drawn.length; i++) {
          for (let j = i + 1; j < drawn.length; j++) {
            const a = drawn[i]!.box;
            const b = drawn[j]!.box;
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 2 && h > 4) out.push(`${label} | "${drawn[i]!.content.slice(0, 10)}" / "${drawn[j]!.content.slice(0, 10)}" | 겹침`);
          }
        }
      }
    }
    out.push(`__measured ${seen.count}`);
    return out;
  }, MIN_PX);
  measured += Number(found.pop()!.split(' ')[1]);
  return found.map((f) => `[${state}] ${f}`);
}

/** 이 테스트에서 잰 글자 수(0이면 아무것도 재지 못한 것이다). */
let measured = 0;

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** 바꿀 조건·예측을 고르고 한 번 실행한다(안전 점검표가 뜨면 확인). */
async function firstTrial(page: Page) {
  await page.getByRole('radio', { name: /바꿀 조건으로 고르기$/ }).first().check();
  await page.getByRole('group', { name: /^예측:/ }).getByRole('button').first().click();
  await expect(runButton(page)).toBeEnabled();
  await runButton(page).click();
  await page.locator('#results-table tbody tr, [role="dialog"]').first().waitFor();
  if (await page.getByRole('dialog', { name: '안전 점검표' }).isVisible()) await confirmSafetyDialog(page);
  await expect(page.locator('#results-table tbody tr')).toHaveCount(1);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function cardSortStates(page: Page, found: string[]) {
  const criterion = page.getByRole('radio').first();
  if ((await criterion.count()) > 0) await criterion.check();
  await page.getByRole('button', { name: / 관찰 \d\/3$/ }).first().click();
  found.push(...(await smallTexts(page, '카드 고름')));
  // 돋보기로 살펴본다.
  const lens = region(page, '돋보기').getByRole('button');
  for (const b of await lens.all()) {
    if (await b.isEnabled()) await b.click();
  }
  found.push(...(await smallTexts(page, '돋보기로 살펴봄')));
  // 칸에 넣는다.
  const put = page.getByRole('button', { name: /(에 넣기|에 놓기)$/ });
  for (const b of await put.all()) {
    if (await b.isEnabled()) {
      await b.click();
      break;
    }
  }
  found.push(...(await smallTexts(page, '카드를 넣음')));
}

async function observeStates(page: Page, found: string[]) {
  const tasks = region(page, '과제 목록').getByRole('button');
  const n = await tasks.count();
  for (let i = 0; i < n; i++) {
    await tasks.nth(i).click();
    const title = ((await tasks.nth(i).textContent()) ?? '').slice(0, 10);
    const pick = region(page, '예측').getByRole('button').first();
    if ((await pick.count()) > 0) await pick.click();
    found.push(...(await smallTexts(page, `과제 ${i + 1} ${title}`)));
    for (const b of await region(page, '관찰하기').getByRole('button').all()) {
      if (!(await b.isEnabled())) continue;
      await b.click();
      found.push(...(await smallTexts(page, `과제 ${i + 1} ${title} / ${((await b.textContent()) ?? '').slice(0, 10)}`)));
    }
    for (const s of await page.getByRole('slider').all()) {
      if (!(await s.isEnabled())) continue;
      for (const at of ['min', 'max'] as const) {
        const v = await s.getAttribute(at);
        if (v === null) continue;
        await s.fill(v);
        found.push(...(await smallTexts(page, `과제 ${i + 1} ${title} / 슬라이더 ${at}`)));
      }
      // 달 보기(음력 1~29일)는 날짜마다 달 위치·라벨 자리가 달라지므로 모든 날짜를 잰다(글자 크기·잘림·겹침).
      if ((await s.getAttribute('max')) === '29') {
        for (let d = 1; d <= 29; d++) {
          await s.fill(String(d));
          found.push(...(await smallTexts(page, `과제 ${i + 1} ${title} / 음력 ${d}일`)));
        }
      }
    }
  }
}

async function classifyStates(page: Page, found: string[]) {
  await region(page, '용액 고르기').getByRole('button').first().click();
  await region(page, '용액 고르기').getByRole('button', { name: '잘 모르겠어요' }).click();
  await region(page, '실험대').getByRole('button').first().click();
  if (await page.getByRole('dialog', { name: '안전 점검표' }).isVisible()) await confirmSafetyDialog(page);
  found.push(...(await smallTexts(page, '지시약으로 시험함')));
}

async function careerStates(page: Page, found: string[]) {
  const stages = page.getByRole('navigation', { name: '진로 탐색 단계' }).getByRole('button');
  const n = await stages.count();
  for (let i = 0; i < n; i++) {
    const b = stages.nth(i);
    if (!(await b.isEnabled())) continue;
    await b.click();
    found.push(...(await smallTexts(page, `단계 ${i + 1}`)));
  }
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}px`, () => {
    test.use({ viewport: vp });
    for (const unit of UNITS) {
      test(`${unit.name}: SVG 글자가 ${MIN_PX}px 이상`, async ({ page }) => {
        measured = 0;
        await gotoUnit(page, unit.id, { experiment: unit.experiment });
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const found: string[] = [...(await smallTexts(page, '처음'))];
        switch (unit.module) {
          case 'card-sort':
            await cardSortStates(page, found);
            break;
          case 'sky-observation':
            await observeStates(page, found);
            break;
          case 'indicator-classify':
            await classifyStates(page, found);
            break;
          case 'career-portfolio':
            await careerStates(page, found);
            break;
          default:
            await firstTrial(page);
            found.push(...(await smallTexts(page, '시행 1회 뒤')));
            // 접힌 패널 안의 그림(g4-climate의 서울 기온 그래프)도 펼쳐서 잰다.
            if ((await page.getByTestId('climate-data').count()) > 0) {
              await page.getByTestId('climate-data').locator('summary').first().click();
              found.push(...(await smallTexts(page, '기온 자료 패널 펼침')));
              expect(await page.getByTestId('climate-svg').isVisible(), '기온 자료 그래프가 보여야 해요').toBe(true);
            }
        }
        // 카드 그림·도구 그림·지시약 단원에는 SVG 글자가 없다(그림은 글자 없이 그린다). 나머지는 반드시 글자를 잰다.
        if (!NO_SVG_TEXT.has(unit.name)) expect(measured, '잰 SVG 글자가 하나도 없어요').toBeGreaterThan(0);
        expect([...new Set(found)], `${MIN_PX}px보다 작거나 잘리거나 겹친 SVG 글자`).toEqual([]);
      });
    }
  });
}
