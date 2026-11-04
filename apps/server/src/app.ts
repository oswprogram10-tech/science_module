import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { MAX_MESSAGE_BYTES } from '@sci/classroom';
import { Hub, type Conn, type HubOptions } from './hub';

export interface ServerOptions extends HubOptions {
  /** 허용할 Origin 목록. 비어 있으면 모두 허용한다(개발용). */
  allowedOrigins?: string[];
  /** ping 간격(ms). 기본 30초. */
  pingIntervalMs?: number;
  /** 만료·미인증 연결·교사 부재 검사 간격(ms). 기본 5초. */
  sweepIntervalMs?: number;
  /** Fastify 로그 켜기. 본문은 어디에도 남기지 않는다. */
  logger?: boolean;
}

/** Origin 비교용: 소문자로 바꾸고 끝의 슬래시를 뗀다. */
export const normalizeOrigin = (o: string): string => o.trim().toLowerCase().replace(/\/+$/, '');

export async function buildServer(opts: ServerOptions = {}): Promise<{ app: FastifyInstance; hub: Hub }> {
  const app = Fastify({ logger: opts.logger ?? false });
  const allowed = (opts.allowedOrigins ?? []).map(normalizeOrigin).filter(Boolean);
  const hub = new Hub({
    ...opts,
    log: (event, code, group) => app.log.info({ event, ...(code ? { code } : {}), ...(group !== undefined ? { group } : {}) }, 'classroom'),
  });
  if (allowed.length === 0) {
    app.log.warn('ALLOWED_ORIGINS가 비어 있어 모든 Origin을 허용해요(개발용). 운영에서는 꼭 지정해 주세요.');
  }

  await app.register(websocket, { options: { maxPayload: MAX_MESSAGE_BYTES } });

  const alive = new WeakSet<object>();

  app.get('/health', async () => ({ ok: true, classes: hub.classes.size }));

  app.get('/ws', { websocket: true }, (socket, req) => {
    const origin = req.headers.origin;
    if (allowed.length > 0 && (!origin || !allowed.includes(normalizeOrigin(origin)))) {
      app.log.warn({ event: 'origin_rejected' }, 'classroom');
      socket.close(1008);
      return;
    }
    const conn: Conn = {
      send: (data) => {
        if (socket.readyState === socket.OPEN) socket.send(data);
      },
      close: (code) => socket.close(code),
      buffered: () => socket.bufferedAmount,
    };
    if (!hub.open(conn, req.ip)) return; // 소켓 수 상한: 허브가 1013으로 닫았다.
    // 반쯤 끊긴 소켓을 찾기 위한 표시: 다음 ping 전에 pong이 없으면 terminate한다.
    alive.add(socket);
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
      if (isBinary) {
        hub.message(conn, '\u0000'); // 이진 데이터는 규격 위반으로 처리된다.
        return;
      }
      hub.message(conn, Buffer.isBuffer(data) ? data.toString('utf8') : Buffer.concat(data as Buffer[]).toString('utf8'));
    });
    socket.on('pong', () => {
      alive.add(socket);
      hub.alive(conn);
    });
    socket.on('close', () => hub.close(conn));
    socket.on('error', () => socket.terminate());
  });

  const ping = setInterval(() => {
    for (const c of app.websocketServer.clients) {
      if (!alive.has(c)) {
        c.terminate();
        continue;
      }
      alive.delete(c);
      try {
        c.ping();
      } catch {
        /* 닫히는 중 */
      }
    }
  }, opts.pingIntervalMs ?? 30_000);
  const sweep = setInterval(() => hub.sweep(), opts.sweepIntervalMs ?? 5_000);
  ping.unref();
  sweep.unref();
  app.addHook('onClose', async () => {
    clearInterval(ping);
    clearInterval(sweep);
    hub.shutdown();
  });

  return { app, hub };
}
