import { buildServer } from './app';

const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 설정하면 수업을 만들 때(create) 이 비밀번호가 필요하다. 비우면 누구나 만들 수 있다.
const createSecret = process.env.CREATE_SECRET || undefined;

// IP 하나가 한 시간에 만들 수 있는 수업 수(기본 10). 테스트 서버처럼 같은 주소에서 여러 번 만들 때만 늘린다.
const createsPerHour = process.env.CREATES_PER_HOUR ? Number(process.env.CREATES_PER_HOUR) : undefined;

const { app } = await buildServer({
  allowedOrigins,
  logger: true,
  ...(createSecret ? { createSecret } : {}),
  ...(createsPerHour && Number.isFinite(createsPerHour) && createsPerHour > 0 ? { createsPerHour } : {}),
});
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });

const stop = () => {
  void app.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
