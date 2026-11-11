// 서버와 호스트 진입점을 CJS 파일 하나로 묶는다(dist/host.cjs). SEA는 CJS 스크립트만 받는다.
// 이 파일만 node로 직접 실행해도 교사 화면을 내보낸다(E2E가 이렇게 쓴다). 정적 파일은 ../teacher/dist 에서 읽는다.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const bundlePath = join(root, 'dist', 'host.cjs');

export async function bundle() {
  mkdirSync(join(root, 'dist'), { recursive: true });
  await build({
    entryPoints: [join(root, 'src', 'main.ts')],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    // node:sea 는 내장 모듈이라 그대로 둔다. 선택 의존성(utf-8-validate, bufferutil)은 ws가 없으면 건너뛴다.
    external: ['bufferutil', 'utf-8-validate'],
    legalComments: 'none',
    logLevel: 'warning',
  });
  return bundlePath;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await bundle();
  console.log(`묶음 완료: ${bundlePath}`);
}
