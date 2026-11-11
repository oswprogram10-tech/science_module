// 스모크 시험: 만든 실행 파일(또는 `node dist/host.cjs`)을 띄워 교사 화면, /host-info, 수업 만들기를 확인하고 끈다.
// 사용: node scripts/smoke.mjs [실행 파일 경로]   (경로를 안 주면 dist 안의 실행 파일을 찾는다)
// 환경 변수: SMOKE_PORT(기본 8787)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe =
  process.argv[2] ??
  [join(root, 'dist', 'SciBridgeON-수업서버.exe'), join(root, 'dist', 'SciBridgeON-classroom-host')].find((p) => existsSync(p));
if (!exe || !existsSync(exe)) {
  console.error('실행 파일을 찾지 못했어요. 먼저 `pnpm host:build`를 하세요.');
  process.exit(1);
}
const port = Number(process.env.SMOKE_PORT ?? 8787);
const base = `http://localhost:${port}`;

const fail = (msg) => {
  throw new Error(msg);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let output = '';
const child = spawn(exe, [], { env: { ...process.env, PORT: String(port), NO_BROWSER: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', (d) => (output += d));
child.stderr.on('data', (d) => (output += d));
let exited = null;
child.on('exit', (code) => (exited = code ?? -1));

async function waitUp() {
  for (let i = 0; i < 100; i++) {
    if (exited !== null) fail(`실행 파일이 바로 끝났어요(코드 ${exited}).`);
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return;
    } catch {
      /* 아직 */
    }
    await sleep(300);
  }
  fail('30초 안에 서버가 켜지지 않았어요.');
}

async function createClass() {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('수업 만들기 응답이 없어요.')), 8000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'create' }));
      ws.onerror = () => reject(new Error('WebSocket 연결에 실패했어요.'));
      ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data));
        if (m.t === 'created') {
          clearTimeout(timer);
          resolve(m);
        } else if (m.t === 'error') {
          clearTimeout(timer);
          reject(new Error(`서버가 오류를 돌려줬어요: ${m.code}`));
        }
      };
    });
  } finally {
    ws.close();
  }
}

try {
  await waitUp();

  const page = await fetch(`${base}/`);
  const html = await page.text();
  if (!page.ok || !/<div id="root">/.test(html)) fail('`/`가 교사 화면 HTML이 아니에요.');
  if (!html.includes('name="sci-bridge-host"')) fail('교사 화면에 수업 서버 표시(meta)가 없어요.');
  const js = /src="(\.\/assets\/[^"]+\.js)"/.exec(html)?.[1];
  if (!js) fail('교사 화면의 스크립트 경로를 찾지 못했어요.');
  const jsRes = await fetch(new URL(js, `${base}/`));
  if (!jsRes.ok || !(jsRes.headers.get('content-type') ?? '').includes('javascript')) fail('교사 화면 스크립트를 받지 못했어요.');
  if ((await fetch(`${base}/..%2f..%2fetc/passwd`)).status === 200) fail('경로 이탈을 막지 못했어요.');
  if ((await fetch(`${base}/없는-파일.js`)).status !== 404) fail('없는 파일이 404가 아니에요.');

  const info = await (await fetch(`${base}/host-info`)).json();
  if (!Array.isArray(info.addresses) || !info.addresses.every((a) => typeof a === 'string') || info.port !== port) {
    fail(`/host-info 응답이 이상해요: ${JSON.stringify(info)}`);
  }

  const created = await createClass();
  if (!/^[A-HJ-KM-NP-Z2-9]{6}$/.test(created.code)) fail(`수업 코드가 이상해요: ${created.code}`);

  console.log(`스모크 통과: 교사 화면, /host-info(주소 ${info.addresses.length}개), 수업 만들기(${created.code})`);
} catch (e) {
  console.error(`스모크 실패: ${e instanceof Error ? e.message : e}`);
  console.error('--- 실행 파일 출력 ---\n' + output);
  process.exitCode = 1;
} finally {
  child.kill();
  await sleep(300);
}
