import { buildServer } from './app';

const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const { app } = await buildServer({ allowedOrigins, logger: true });
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });

const stop = () => {
  void app.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
