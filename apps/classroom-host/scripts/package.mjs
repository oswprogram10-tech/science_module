// 교사 PC 수업 서버 실행 파일 만들기: 묶음 JS + 교사 화면 정적 파일 → Node SEA blob → postject로 node 실행 파일에 넣는다.
// 먼저 교사 앱을 빌드해야 한다(`pnpm host:build`가 순서대로 한다). 이 스크립트가 도는 OS용 실행 파일이 나온다
// (Windows: SciBridgeON-수업서버.exe, 그 밖: SciBridgeON-classroom-host).
import { execFileSync } from 'node:child_process';
import { copyFileSync, chmodSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const teacherDist = join(root, '..', 'teacher', 'dist');
const dist = join(root, 'dist');
const win = process.platform === 'win32';
const outName = win ? 'SciBridgeON-수업서버.exe' : 'SciBridgeON-classroom-host';
const outFile = join(dist, outName);
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

if (!existsSync(join(teacherDist, 'index.html'))) {
  console.error('apps/teacher/dist 가 없어요. 먼저 `pnpm --filter teacher build`를 하세요(또는 `pnpm host:build`).');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const bundlePath = await bundle();

// 정적 파일 → SEA assets (키는 `/`로 구분한 상대 경로)
const assets = {};
for (const f of walk(teacherDist)) assets[relative(teacherDist, f).split(sep).join('/')] = f;
console.log(`교사 화면 파일 ${Object.keys(assets).length}개를 넣어요.`);

const blob = join(dist, 'sea-prep.blob');
const seaConfig = join(dist, 'sea-config.json');
writeFileSync(
  seaConfig,
  JSON.stringify({ main: bundlePath, output: blob, disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false, assets }, null, 2),
);
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

// 이 Node 실행 파일을 복사해 blob을 넣는다. 그래서 실행 파일은 이 스크립트를 돌린 Node와 같은 버전·OS용이다.
rmSync(outFile, { force: true });
copyFileSync(process.execPath, outFile);
if (!win) chmodSync(outFile, 0o755);
if (win) {
  // 복사한 node.exe의 서명은 blob을 넣으면 깨지므로 먼저 뗀다. signtool이 없으면 건너뛴다(서명이 깨진 채로 둔다).
  try {
    execFileSync('signtool', ['remove', '/s', outFile], { stdio: 'ignore' });
  } catch {
    /* signtool 없음 */
  }
}
const postject = join(root, 'node_modules', 'postject', 'dist', 'cli.js');
const args = [postject, outFile, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', FUSE];
if (process.platform === 'darwin') args.push('--macho-segment-name', 'NODE_SEA');
execFileSync(process.execPath, args, { stdio: 'inherit' });

rmSync(blob, { force: true });
rmSync(seaConfig, { force: true });
mkdirSync(dist, { recursive: true });
console.log(`만들었어요: ${outFile} (${(statSync(outFile).size / 1048576).toFixed(1)} MB)`);
