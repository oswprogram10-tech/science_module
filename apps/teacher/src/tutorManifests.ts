import { buildCatalog } from './tutorCatalog';

/** 학생 앱의 단원 목록(content/units 매니페스트)에서 튜터 질문 목록을 만든다. */
const manifests = import.meta.glob<unknown>('../../../content/units/*/manifest.json', { eager: true, import: 'default' });

export const TUTOR_CATALOG = buildCatalog(Object.values(manifests));
