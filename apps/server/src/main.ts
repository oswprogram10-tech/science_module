import { networkInterfaces } from 'node:os';
import { buildServer } from './app';
import { pickPrivateIPv4 } from './hostInfo';

const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 설정하면 수업을 만들 때(create) 이 비밀번호가 필요하다. 비우면 누구나 만들 수 있다.
const createSecret = process.env.CREATE_SECRET || undefined;

// IP 하나가 한 시간에 만들 수 있는 수업 수(기본 10). 테스트 서버처럼 같은 주소에서 여러 번 만들 때만 늘린다.
const createsPerHour = process.env.CREATES_PER_HOUR ? Number(process.env.CREATES_PER_HOUR) : undefined;

// 교사 PC 수업 서버처럼 쓸 때(HOST_MODE=1): 수업 만들기는 localhost에서만, GET /host-info 사용. 학교 서버는 켜지 않는다.
const hostMode = process.env.HOST_MODE === '1';

const { app } = await buildServer({
  allowedOrigins,
  logger: true,
  ...(hostMode ? { hostMode: true, hostInfo: () => ({ addresses: pickPrivateIPv4(networkInterfaces()), port }) } : {}),
  ...(createSecret ? { createSecret } : {}),
  ...(createsPerHour && Number.isFinite(createsPerHour) && createsPerHour > 0 ? { createsPerHour } : {}),
});
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });

const stop = () => {
  void app.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
