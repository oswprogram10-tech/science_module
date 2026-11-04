import { deflateSync } from 'node:zlib';
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

/** 모든 spec이 쓰는 fixture: pageerror와 console.error를 모아 테스트 끝에서 하나도 없는지 확인한다. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
      });
      await use(errors);
      expect(errors, '페이지 오류/콘솔 오류가 없어야 해요').toEqual([]);
    },
    { auto: true },
  ],
});

/** 단원 화면으로 간다. playback은 기본 0.3초(빠른 재생). */
export async function gotoUnit(page: Page, id: string, opts: { dev?: boolean; playback?: number | null } = {}) {
  const params: string[] = [];
  if (opts.dev) params.push('dev=1');
  const playback = opts.playback === undefined ? 0.3 : opts.playback;
  if (playback !== null) params.push(`playback=${playback}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  await page.goto(`/${qs}#/unit/${id}`);
}

/** 바꿀 조건(조작변인) 라디오를 고른다. 예: selectIV(page, '물의 온도') */
export async function selectIV(page: Page, label: string) {
  await page.getByRole('radio', { name: new RegExp(`^${label}(을|를) 바꿀 조건으로 고르기$`) }).check();
}

/** 변인 값을 고른다. group은 변인 이름(예: '물의 온도'), option은 버튼 글자(예: '60 °C'). */
export async function setValue(page: Page, group: string, option: string) {
  await page.getByRole('group', { name: group, exact: true }).getByRole('button', { name: option }).click();
}

/** 예측 버튼을 고른다. label: '늘어난다' 등 화면에 보이는 글자(아이콘 제외). */
export async function predict(page: Page, label: string) {
  await page.getByRole('group', { name: /^예측:/ }).getByRole('button', { name: label }).click();
}

export const runButton = (page: Page) => page.getByRole('button', { name: /^(▶ 실험 실행|실험 중…)$/ });

/** 실험 실행을 누르고, 버튼 글자가 '실험 중…'이 아닐 때까지 기다린다. */
export async function runTrial(page: Page) {
  const run = runButton(page);
  await expect(run).toBeEnabled();
  await run.click();
  await expect(run).not.toHaveText('실험 중…');
  await expect(run).toHaveText('▶ 실험 실행');
}

/** 결과표 본문 행들 */
export const resultRows = (page: Page) => page.locator('#results-table tbody tr');

/** 센서 값 (aria-label: 온도/무게/압력/산소/이산화 탄소) */
export const sensor = (page: Page, name: '온도' | '무게' | '압력' | '산소' | '이산화 탄소' | '빛 세기') => page.getByRole('status', { name, exact: true });

/** 가로 스크롤이 없는지(문서 폭 <= 뷰포트 폭) */
export async function scrollWidth(page: Page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
}

// ---- 단원 6 도우미 ----

/** 단색 사각형이 가운데 있는 PNG를 만든다(바깥은 흰색). 외부 의존성 없이 zlib로 인코딩한다. */
export function makePng(hex: string, size = 100): Buffer {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lo = Math.floor(size * 0.25);
  const hi = Math.ceil(size * 0.75);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inside = x >= lo && x < hi && y >= lo && y < hi;
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = inside ? rgb[c]! : 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 용액을 고른다(용액 고르기 구역). */
export async function pickSolution(page: Page, label: string) {
  await page.getByRole('region', { name: '용액 고르기' }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
}

/** 예측 버튼: '산성일 것 같아요' | '염기성일 것 같아요' | '잘 모르겠어요' */
export async function predictSolution(page: Page, label: string) {
  await page.getByRole('region', { name: '용액 고르기' }).getByRole('button', { name: label }).click();
}

export const indicatorButton = (page: Page, label: string) =>
  page.getByRole('region', { name: '실험대' }).getByRole('button', { name: label });

/** 안전 점검표 대화상자의 항목을 모두 체크하고 확인한다. */
export async function confirmSafetyDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  for (const box of await dialog.getByRole('checkbox').all()) await box.check();
  await dialog.getByRole('button', { name: '확인했어요' }).click();
  await expect(dialog).toBeHidden();
}
