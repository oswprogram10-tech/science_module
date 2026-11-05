import type { ReactNode } from 'react';

/** 직업 카드의 도구 그림. 사람은 그리지 않는다(성별·외모 고정관념 방지). 24x24 선 그림. */
const PATHS: Record<string, ReactNode> = {
  beaker: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /><path d="M7.5 15h9" /></>,
  'mixing-bowl': <><path d="M3 11h18a9 9 0 0 1-18 0z" /><path d="M8 20h8" /><path d="M9 8l6-5M12 8l4-3" /></>,
  'material-cube': <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></>,
  stethoscope: <><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M10 13v2a4 4 0 0 0 8 0v-2" /><circle cx="18" cy="11" r="2" /></>,
  'leaf-sprout': <><path d="M12 21v-9" /><path d="M12 12C12 7 8 5 4 5c0 5 3 7 8 7z" /><path d="M12 14c0-4 3-6 8-6 0 5-3 7-8 6z" /></>,
  microscope: <><path d="M9 3l4 2-3 7-4-2z" /><path d="M11 12a5 5 0 0 1-3 7M5 21h14M12 19h6" /></>,
  'weather-vane': <><path d="M12 3v18M8 21h8" /><path d="M5 8h10l3-2v4l-3-2" /><path d="M7 5l-2 3 2 3" /></>,
  'rock-hammer': <><path d="M13 5l6 6M12 6l-2 2 6 6 2-2M4 20l8-8" /></>,
  telescope: <><path d="M3 11l13-5 2 5-13 5z" /><path d="M16 6l2-1M9 16l-3 5M10 16l3 5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /><circle cx="12" cy="12" r="6.5" /></>,
  headphones: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="7" rx="1" /><rect x="17" y="14" width="4" height="7" rx="1" /></>,
  plug: <><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v4" /></>,
  magnifier: <><circle cx="10" cy="10" r="6" /><path d="M15 15l6 6" /></>,
  thermometer: <><path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z" /><path d="M12 9v7" /></>,
  'solar-panel': <><path d="M4 8h16l-2 9H6z" /><path d="M9.3 8L8 17M14.7 8L16 17M5 12.5h14" /><path d="M12 3v2M5 4l1.5 1.5M19 4l-1.5 1.5" /></>,
};

export function JobIcon({ icon, size = 40 }: { icon: string; size?: number }) {
  return (
    <svg
      className="job-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[icon] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export const JOB_ICON_KEYS = Object.keys(PATHS);
