import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { MAX_MESSAGE_BYTES } from '@sci/classroom';
import { Hub, type Conn, type HubOptions } from './hub';

export interface ServerOptions extends HubOptions {
  /** 허용할 Origin 목록. 비어 있으면 모두 허용한다(개발용). */
  allowedOrigins?: string[];
  /** ping 간격(ms). 기본 30초. */
  pingIntervalMs?: number;
  /** 만료 검사 간격(ms). 기본 1분. */
  sweepIntervalMs?: number;
  /** Fastify 로그 켜기. 본문은 어디에도 남기지 않는다. */
  logger?: boolean;
}

export async function buildServer(opts: ServerOptions = {}): Promise<{ app: FastifyInstance; hub: Hub }> {
  const app = Fastify({ logger: opts.logger ?? false });
  const allowed = opts.allowedOrigins ?? [];
  const hub = new Hub({
    ...opts,
    log: (event, code, group) => app.log.info({ event, ...(code ? { code } : {}), ...(group !== undefined ? { group } : {}) }, 'classroom'),
  });
  if (allowed.length === 0) {
    app.log.warn('ALLOWED_ORIGINS가 비어 있어 모든 Origin을 허용해요(개발용). 운영에서는 꼭 지정해 주세요.');
  }

  await app.register(websocket, { options: { maxPayload: MAX_MESSAGE_BYTES } });

  app.get('/health', async () => ({ ok: true, classes: hub.classes.size }));

  app.get('/ws', { websocket: true }, (socket, req) => {
    const origin = req.headers.origin;
    if (allowed.length > 0 && (!origin || !allowed.includes(origin))) {
      app.log.warn({ event: 'origin_rejected' }, 'classroom');
      socket.close(1008);
      return;
    }
    const conn: Conn = {
      send: (data) => {
        if (socket.readyState === socket.OPEN) socket.send(data);
      },
      close: (code) => socket.close(code),
    };
    hub.open(conn);
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
      if (isBinary) {
        hub.message(conn, '\u0000'); // 이진 데이터는 규격 위반으로 처리된다.
        return;
      }
      hub.message(conn, Buffer.isBuffer(data) ? data.toString('utf8') : Buffer.concat(data as Buffer[]).toString('utf8'));
    });
    socket.on('pong', () => hub.alive(conn));
    socket.on('close', () => hub.close(conn));
    socket.on('error', () => socket.terminate());
  });

  const ping = setInterval(() => {
    for (const c of app.websocketServer.clients) {
      try {
        c.ping();
      } catch {
        /* 닫히는 중 */
      }
    }
  }, opts.pingIntervalMs ?? 30_000);
  const sweep = setInterval(() => hub.sweep(), opts.sweepIntervalMs ?? 60_000);
  ping.unref();
  sweep.unref();
  app.addHook('onClose', async () => {
    clearInterval(ping);
    clearInterval(sweep);
    hub.shutdown();
  });

  return { app, hub };
}
