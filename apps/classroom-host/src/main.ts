import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildServer, pickPrivateIPv4 } from '@sci/server';
// 모델 id 목록만 필요하다. @sci/tutor 전체를 묶음에 넣지 않으려고 import 없는 이 파일만 가져온다.
import { TUTOR_MODELS } from '../../../packages/tutor/src/models';
import { dirAssets, markHostPage, seaAssets, type AssetLookup } from './assets';
import { findFreePort } from './ports';

/** 기본 포트와, 쓰이고 있을 때 대신 쓰는 범위. */
const DEFAULT_PORT = 8787;
const LAST_FALLBACK_PORT = 8799;

const say = (line = '') => console.log(line);

/** 기본 브라우저로 주소를 연다. 못 열어도(서버 PC에 브라우저가 없는 등) 계속 간다. */
function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd!, args as string[], { stdio: 'ignore', detached: true });
    child.on('error', () => say(`브라우저를 열지 못했어요. 직접 ${url} 을 열어 주세요.`));
    child.unref();
  } catch {
    /* 위의 안내로 충분하다 */
  }
}

/** 더블클릭으로 연 창이 오류 문구를 읽기 전에 닫히지 않게, 키를 누를 때까지 기다린다(터미널일 때만). */
async function waitKeyThenExit(code: number): Promise<never> {
  if (process.stdin.isTTY) {
    say();
    say('아무 키나 누르면 이 창이 닫혀요.');
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    await new Promise<void>((r) => process.stdin.once('data', () => r()));
  }
  process.exit(code);
}

/** 교사 화면 정적 파일을 어디서 읽을지: 단일 실행 파일이면 실행 파일 안의 asset, 아니면 폴더. */
async function loadAssets(): Promise<AssetLookup> {
  const sea = await import('node:sea').catch(() => null);
  if (sea?.isSea()) return seaAssets((k) => sea.getRawAsset(k));
  const dir = process.env.HOST_STATIC_DIR || join(dirname(process.argv[1] ?? '.'), '..', '..', 'teacher', 'dist');
  return dirAssets(dir);
}

/**
 * 튜터 모델 파일을 두는 폴더: 환경 변수 TUTOR_MODEL_DIR, 없으면 실행 파일(단일 실행 파일) 또는 묶음 JS 옆의 `tutor-models/`.
 * 폴더가 없으면 서버가 만든다.
 */
async function tutorModelDir(): Promise<string> {
  if (process.env.TUTOR_MODEL_DIR) return resolve(process.env.TUTOR_MODEL_DIR);
  const sea = await import('node:sea').catch(() => null);
  const base = sea?.isSea() ? dirname(process.execPath) : dirname(resolve(process.argv[1] ?? '.'));
  return join(base, 'tutor-models');
}

async function main(): Promise<void> {
  const host = process.env.HOST ?? '0.0.0.0';
  const explicit = process.env.PORT ? Number(process.env.PORT) : null;
  const port = explicit ?? (await findFreePort(DEFAULT_PORT, LAST_FALLBACK_PORT, host));
  if (port === null || !Number.isInteger(port)) {
    say(`수업 서버를 켤 수 없어요. ${DEFAULT_PORT}~${LAST_FALLBACK_PORT}번 포트를 모두 다른 프로그램이 쓰고 있어요.`);
    say('수업 서버를 이미 켜 두었다면 그 창을 쓰거나 닫은 뒤 다시 실행해 주세요.');
    return waitKeyThenExit(1);
  }

  const createsPerHour = process.env.CREATES_PER_HOUR ? Number(process.env.CREATES_PER_HOUR) : undefined;
  const assets = await loadAssets();
  const modelDir = await tutorModelDir();
  const { app } = await buildServer({
    // 교실 LAN에서 쓰므로 Origin은 모두 허용한다(학생 APK의 출처는 http://localhost). 수업 만들기는 이 PC(localhost)에서만 된다.
    allowedOrigins: [],
    logger: false,
    hostMode: true,
    hostInfo: () => ({ addresses: pickPrivateIPv4(networkInterfaces()), port }),
    tutorModels: { dir: modelDir, ids: TUTOR_MODELS.map((m) => m.id) },
    ...(createsPerHour && Number.isFinite(createsPerHour) && createsPerHour > 0 ? { createsPerHour } : {}),
  });

  // 교사 화면: /ws, /health, /host-info 외의 모든 GET은 정적 파일.
  app.get('/*', async (req, reply) => {
    const path = req.url.split('?')[0]!;
    const a = assets(path);
    if (!a) return reply.code(404).type('text/plain; charset=utf-8').send('찾을 수 없어요');
    if (a.type.startsWith('text/html')) return reply.header('cache-control', 'no-cache').type(a.type).send(markHostPage(a.body.toString('utf8')));
    return reply.header('cache-control', 'public, max-age=3600').type(a.type).send(a.body);
  });

  try {
    await app.listen({ port, host });
  } catch (e) {
    say(`수업 서버를 켤 수 없어요(포트 ${port}): ${e instanceof Error ? e.message : String(e)}`);
    return waitKeyThenExit(1);
  }

  const url = `http://localhost:${port}/`;
  const addrs = pickPrivateIPv4(networkInterfaces());
  say('수업 서버가 켜졌어요. 이 창을 닫으면 수업이 끝나요.');
  say();
  say(`교사 화면: ${url}  (브라우저가 자동으로 열려요)`);
  say();
  if (addrs.length > 0) {
    say('학생 앱에 입력할 서버 주소:');
    for (const a of addrs) say(`    ${a}:${port}`);
    say('(학생 기기가 이 PC와 같은 무선망에 연결되어 있어야 해요.)');
  } else {
    say('이 PC의 무선망 주소를 찾지 못했어요. 와이파이나 유선망에 연결되어 있는지 확인해 주세요.');
  }
  say();
  say(`튜터 모델 파일 폴더: ${modelDir}`);
  say();
  say('Windows 방화벽이 허용을 물으면 「개인 네트워크」를 허용해 주세요.');
  if (!process.env.NO_BROWSER) openBrowser(url);

  const stop = () => {
    void app.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(async (e) => {
  say(`수업 서버를 켤 수 없어요: ${e instanceof Error ? e.message : String(e)}`);
  await waitKeyThenExit(1);
});
