import { readFileSync, statSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';

/** 교사 화면 정적 파일 하나. */
export interface Asset {
  body: Buffer;
  type: string;
}

/** 경로(`/assets/x.js`)로 정적 파일을 찾는다. 없으면 null. */
export type AssetLookup = (urlPath: string) => Asset | null;

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
  map: 'application/json; charset=utf-8',
};

export const contentType = (name: string): string => TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';

/** 주소 경로를 안전한 상대 키로 바꾼다. `..`·역슬래시·빈 이름이 있으면 null. 루트(`/`)는 `index.html`. */
export function toKey(urlPath: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(urlPath.split('?')[0]!.split('#')[0]!);
  } catch {
    return null;
  }
  if (p.includes('\\') || p.includes('\0')) return null;
  const parts = p.split('/').filter((x) => x !== '');
  if (parts.some((x) => x === '.' || x === '..')) return null;
  return parts.length === 0 ? 'index.html' : parts.join('/');
}

/** 폴더에서 읽는다(묶음 JS를 node로 직접 실행할 때). 폴더 밖으로 나가는 경로는 막는다. */
export function dirAssets(root: string): AssetLookup {
  const base = resolve(root);
  return (urlPath) => {
    const key = toKey(urlPath);
    if (!key) return null;
    const file = normalize(join(base, key));
    if (file !== base && !file.startsWith(base + sep)) return null;
    try {
      if (!statSync(file).isFile()) return null;
      return { body: readFileSync(file), type: contentType(file) };
    } catch {
      return null;
    }
  };
}

/** `node:sea`의 getRawAsset 같은 함수로 읽는다(단일 실행 파일). 키는 빌드 때 `/`로 구분한 상대 경로로 넣었다. */
export function seaAssets(getRaw: (key: string) => ArrayBuffer): AssetLookup {
  return (urlPath) => {
    const key = toKey(urlPath);
    if (!key) return null;
    try {
      return { body: Buffer.from(getRaw(key)), type: contentType(key) };
    } catch {
      return null;
    }
  };
}

/** index.html에 "이 화면은 수업 서버가 내보낸 것"이라는 표시를 넣는다(교사 화면이 이 표시를 보고 자기 주소를 서버로 쓴다). */
export function markHostPage(html: string): string {
  const tag = '<meta name="sci-bridge-host" content="1" />';
  return html.includes('</head>') ? html.replace('</head>', `  ${tag}\n  </head>`) : tag + html;
}
