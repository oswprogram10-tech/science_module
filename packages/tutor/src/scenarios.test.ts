import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UNITS } from '../../../apps/student/src/units';
import { generateScenarios, situationCounts } from '../scripts/scenarios';
import { buildTutorInput, situationOf } from './context';
import { CONTENT_DIR, TUTOR_DIR, TUTOR_UNITS, loadUnits, scenarioFile } from './datasetIo';

const units = loadUnits();
/** 카드 분류 두 번째 활동을 더한 단원 넷(1차 묶음). */
const CARD_SORT_BATCH_A = ['g3-animal', 'g3-plantlife', 'g4-ecosystem', 'g5-strata'];
/** 활동을 더하기 전 HEAD의 ml/tutor/scenarios/g5-mixture.jsonl 20줄(줄바꿈으로 이은 글자)의 SHA-256. */
const FIRST_ACTIVITY_SHA = '2b7ef4f3ed95a95828bffbfa1152bfba63813d89cf63d67f5c85b7259dd8a85e';

describe('튜터 단원 목록', () => {
  it('g6-career를 뺀 모든 단원이고, 학년 순 · 같은 학년은 앱 목록 순서다', () => {
    const all = readdirSync(CONTENT_DIR).filter((d) => d !== 'g6-career');
    expect([...TUTOR_UNITS].sort()).toEqual(all.sort());
    const order = UNITS.filter((u) => u.id !== 'g6-career')
      .map((u, i) => ({ id: u.id, grade: u.ok ? u.manifest.grade : 0, i }))
      .sort((a, b) => a.grade - b.grade || a.i - b.i)
      .map((u) => u.id);
    expect([...TUTOR_UNITS]).toEqual(order);
  });
});

describe('활동이 여럿인 단원의 시나리오(id 안정성)', () => {
  const m = units['g5-mixture']!;
  const list = generateScenarios('g5-mixture', m);
  const firstExp = m.manifest.experiments[0]!.id;
  const lastOfFirst = list.filter((s) => s.state.experimentId === firstExp).length - 1;

  it('첫 활동의 시나리오가 번호 순서대로 앞을 차지하고 새 활동 시나리오가 뒤에 덧붙는다', () => {
    expect(firstExp).toBe('salt-sand');
    expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `g5-mixture-s${String(i + 1).padStart(3, '0')}`));
    expect(list.slice(0, lastOfFirst + 1).every((s) => s.state.experimentId === 'salt-sand')).toBe(true);
    expect(list.slice(lastOfFirst + 1).every((s) => s.state.experimentId === 'separation-methods')).toBe(true);
    // 첫 활동만 만든 예전 결과와 같다: s001~s020, 20개.
    expect(lastOfFirst + 1).toBe(20);
    expect(list.slice(lastOfFirst + 1).length).toBeGreaterThan(0);
  });
  it('첫 활동의 시나리오 줄은 활동을 하나 더해도 한 글자도 바뀌지 않는다(해시 고정)', () => {
    const first = list.slice(0, 20).map((s) => JSON.stringify(s)).join('\n');
    expect(createHash('sha256').update(first).digest('hex')).toBe(FIRST_ACTIVITY_SHA);
  });
  it('활동이 하나인 단원은 활동마다 시나리오를 한 번만 만들고 모두 첫 활동 것이다', () => {
    for (const id of TUTOR_UNITS) {
      if (id === 'g5-mixture' || id === 'g4-land' || id === 'g3-earth-sea' || id === 'g5-weather' || id === 'g3-force' || id === 'g3-sound' || id === 'g4-magnet' || id === 'g5-solution' || id === 'g5-heat' || id === 'g6-acid-base' || id === 'g6-motion' || id === 'g6-combustion' || CARD_SORT_BATCH_A.includes(id)) continue;
      const only = units[id]!.manifest.experiments;
      expect(only, id).toHaveLength(1);
      expect(new Set(generateScenarios(id, units[id]!).map((s) => s.state.experimentId)), id).toEqual(new Set([only[0]!.id]));
    }
  });
});

describe('날씨와 우리 생활 시나리오(활동 2 덧붙임)', () => {
  const weather = units['g5-weather']!;
  const list = generateScenarios('g5-weather', weather);
  it('첫 활동(해륙풍) 시나리오 s001~s020은 활동 2를 더하기 전과 한 글자도 같고, 이슬·안개·구름 시나리오 24개가 뒤에 덧붙는다', () => {
    expect(weather.manifest.experiments.map((e) => e.id)).toEqual(['land-sea-breeze', 'dew-fog-cloud']);
    expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `g5-weather-s${String(i + 1).padStart(3, '0')}`));
    expect(list).toHaveLength(44);
    expect(list.slice(0, 20).every((s) => s.state.experimentId === 'land-sea-breeze')).toBe(true);
    expect(list.slice(20).every((s) => s.state.experimentId === 'dew-fog-cloud')).toBe(true);
    // 이 해시는 활동 2를 더하기 전 ml/tutor/scenarios/g5-weather.jsonl 20줄(줄바꿈으로 이은 글자)의 SHA-256이다.
    const first = list.slice(0, 20).map((s) => JSON.stringify(s)).join('\n');
    expect(createHash('sha256').update(first).digest('hex')).toBe('49d6c3140fd5be2819f91d386147414c4c7e46d5b5629a33cbef0cc77cb39d79');
  });
  it('카드 분류의 모든 상황이 시나리오에 있다', () => {
    const exp = weather.manifest.experiments[1]!;
    const keys = new Set(list.slice(20).map((s) => situationOf(s.state, exp)));
    for (const k of ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unobserved', 'check-inconsistent', 'check-complete', 'finished']) expect(keys.has(k), k).toBe(true);
  });
});

describe('카드 분류 두 번째 활동 넷의 시나리오(덧붙임)', () => {
  // [단원, 첫 활동 id, 새 활동 id, 첫 활동 시나리오 수, 새 활동 시나리오 수, 활동 2를 더하기 전 jsonl 줄(줄바꿈으로 이은 글자)의 SHA-256]
  const CASES: Array<[string, string, string, number, number, string]> = [
    ['g3-animal', 'animal-sort', 'animal-habitat', 24, 24, 'c95bb5cc9a79cefc7714d3c52f4aeb07bdc21e4a6dc80812e0b473fd95debe55'],
    ['g3-plantlife', 'leaf-tree', 'plant-habitat', 24, 24, 'c5dda1cbeadaad7dbcfd131d2ac7f016044218c035d10958c51cd89cf9a49f84'],
    ['g4-ecosystem', 'food-web', 'living-nonliving', 22, 21, '16076f1fe13dc068213f00299b07fbb4f6912042f2c3f9bbbaaeb88ee2daaf21'],
    ['g5-strata', 'strata-order', 'rock-grain', 23, 24, '0788e3172719706d11c14f1fb3af2c04ac3029767280a0af296408cd9fc2a3ce'],
  ];
  for (const [id, firstId, newId, nFirst, nNew, sha] of CASES) {
    const unit = units[id]!;
    const list = generateScenarios(id, unit);
    it(`${id}: 첫 활동(${firstId}) 시나리오 ${nFirst}줄은 활동 2를 더하기 전과 한 글자도 같고, ${newId} 시나리오 ${nNew}개가 뒤에 덧붙는다`, () => {
      expect(unit.manifest.experiments.map((e) => e.id)).toEqual([firstId, newId]);
      expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `${id}-s${String(i + 1).padStart(3, '0')}`));
      expect(list).toHaveLength(nFirst + nNew);
      expect(list.slice(0, nFirst).every((s) => s.state.experimentId === firstId)).toBe(true);
      expect(list.slice(nFirst).every((s) => s.state.experimentId === newId)).toBe(true);
      const first = list.slice(0, nFirst).map((s) => JSON.stringify(s)).join('\n');
      expect(createHash('sha256').update(first).digest('hex')).toBe(sha);
    });
    it(`${id}: ml/tutor/scenarios/${id}.jsonl이 생성 결과와 같고 앞 ${nFirst}줄이 그대로다`, () => {
      const text = readFileSync(scenarioFile(TUTOR_DIR, id), 'utf8');
      expect(text).toBe(list.map((s) => JSON.stringify(s)).join('\n') + '\n');
      expect(createHash('sha256').update(text.split('\n').slice(0, nFirst).join('\n')).digest('hex')).toBe(sha);
    });
    it(`${id}: 카드 분류의 상황이 시나리오에 있다`, () => {
      const exp = unit.manifest.experiments[1]!;
      const keys = new Set(list.slice(nFirst).map((s) => situationOf(s.state, exp)));
      // 생태계 활동은 주관 기준이 없어 check-subjective 상황이 없다.
      const want = ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-unobserved', 'check-inconsistent', 'check-complete', 'finished', ...(id === 'g4-ecosystem' ? [] : ['check-subjective'])];
      for (const k of want) expect(keys.has(k), k).toBe(true);
    });
  }
});

describe('지구와 바다 시나리오(활동 2 덧붙임)', () => {
  const sea = units['g3-earth-sea']!;
  const list = generateScenarios('g3-earth-sea', sea);
  it('첫 활동(바닷물과 강물 비교하기) 시나리오 s001~s020은 활동 2를 더하기 전과 한 글자도 같고, 밀물과 썰물 시나리오 10개가 뒤에 덧붙는다', () => {
    expect(sea.manifest.experiments.map((e) => e.id)).toEqual(['sea-water', 'tide']);
    expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `g3-earth-sea-s${String(i + 1).padStart(3, '0')}`));
    expect(list).toHaveLength(30);
    expect(list.slice(0, 20).every((s) => s.state.experimentId === 'sea-water')).toBe(true);
    expect(list.slice(20).every((s) => s.state.experimentId === 'tide')).toBe(true);
    // 이 해시는 활동 2를 더하기 전 ml/tutor/scenarios/g3-earth-sea.jsonl 20줄(줄바꿈으로 이은 글자)의 SHA-256이다.
    const first = list.slice(0, 20).map((s) => JSON.stringify(s)).join('\n');
    expect(createHash('sha256').update(first).digest('hex')).toBe('25b4f820044a6b9b92d54677b66beb068ea463cc279d145fd3e76883b59d63e9');
  });
  it('밀물과 썰물 과제마다 다섯 상황이 모두 있다', () => {
    const exp = sea.manifest.experiments[1]!;
    if (!('tasks' in exp)) throw new Error('관찰 활동이 아닙니다.');
    for (const task of exp.tasks) {
      const keys = list.filter((s) => s.state.kind === 'observe' && s.state.taskId === task.id).map((s) => situationOf(s.state, exp));
      expect(new Set(keys), task.id).toEqual(new Set(['before-observe', 'observing', 'record-mismatch', 'record-match', 'prediction-mismatch']));
    }
  });
});

describe('변인 실험 두 번째 활동을 더한 단원의 시나리오(힘과 우리 생활·소리의 성질·자석의 이용)', () => {
  // 각 해시는 두 번째 활동을 더하기 전 ml/tutor/scenarios/<단원>.jsonl 20줄(줄바꿈으로 이은 글자)의 SHA-256이다.
  const CASES = [
    { id: 'g3-force', first: 'lever-balance', second: 'lever-lift', total: 40, sha: '081c85aa9aac658b17576638f46c1631805d7514e83f68b217d4f96c0ab06bca' },
    { id: 'g3-sound', first: 'string-sound', second: 'sound-vibration', total: 42, sha: 'a045442aac8240a59b6114b69c1a6701a17954c41e318fd617137dc3c89d8233' },
    { id: 'g4-magnet', first: 'magnet-distance', second: 'magnet-poles', total: 42, sha: '16046672bdd1bb69014aa39dfdb31eb25e195a9c53516472ee9e560feecf96cd' },
  ];
  for (const c of CASES) {
    const u = units[c.id]!;
    const list = generateScenarios(c.id, u);
    it(`${c.id}: 첫 활동(${c.first}) 시나리오 s001~s020은 활동 2를 더하기 전과 한 글자도 같고, ${c.second} 시나리오가 뒤에 덧붙는다`, () => {
      expect(u.manifest.experiments.map((e) => e.id)).toEqual([c.first, c.second]);
      expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `${c.id}-s${String(i + 1).padStart(3, '0')}`));
      expect(list).toHaveLength(c.total);
      expect(list.slice(0, 20).every((s) => s.state.experimentId === c.first)).toBe(true);
      expect(list.slice(20).every((s) => s.state.experimentId === c.second)).toBe(true);
      const first = list.slice(0, 20).map((s) => JSON.stringify(s)).join('\n');
      expect(createHash('sha256').update(first).digest('hex')).toBe(c.sha);
      // 저장소 파일의 앞 20줄도 같다(덧붙이기만 했다).
      const file = readFileSync(scenarioFile(TUTOR_DIR, c.id), 'utf8').trimEnd().split('\n');
      expect(createHash('sha256').update(file.slice(0, 20).join('\n')).digest('hex')).toBe(c.sha);
      expect(file).toHaveLength(c.total);
    });
    it(`${c.id}: 활동 2의 모든 상황(실행 전·첫 시행·함께 바뀜·바꿀 조건 그대로·반복·공정한 비교·예측 불일치)이 시나리오에 있다`, () => {
      const exp = u.manifest.experiments[1]!;
      const keys = new Set(list.slice(20).map((s) => situationOf(s.state, exp)));
      for (const k of ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch']) expect(keys.has(k), k).toBe(true);
    });
  }
});

describe('변인 실험 두 번째 활동을 더한 단원의 시나리오(용해와 용액·열과 우리 생활·산과 염기)', () => {
  // 각 해시는 두 번째 활동을 더하기 전 ml/tutor/scenarios/<단원>.jsonl 22줄(줄바꿈으로 이은 글자)의 SHA-256이다.
  const CASES = [
    { id: 'g5-solution', first: 'dissolve-amount', second: 'concentration', n: 22, total: 44, sha: '4d4c759ff02678f721fc15026ef333f76bf8f7aa0cffc66dd07857a6e1c588f0' },
    { id: 'g5-heat', first: 'insulated-cup', second: 'heat-contact', n: 22, total: 44, sha: '0c55b35d5e2fd8134a507be9b02e7c0f757c10d5cb18cca759c8e397d98f603d' },
    // 산과 염기의 첫 활동은 분류 활동(지시약으로 여러 가지 용액 분류하기)이다.
    { id: 'g6-acid-base', first: 'indicator-classify', second: 'acid-base-mix', n: 22, total: 44, sha: 'c04252bbd0f8e58af5a02c2e7441605e39244a356244e9701c5411dd5251b028' },
  ];
  for (const c of CASES) {
    const u = units[c.id]!;
    const list = generateScenarios(c.id, u);
    it(`${c.id}: 첫 활동(${c.first}) 시나리오 s001~s${String(c.n).padStart(3, '0')}은 활동 2를 더하기 전과 한 글자도 같고, ${c.second} 시나리오가 뒤에 덧붙는다`, () => {
      expect(u.manifest.experiments.map((e) => e.id)).toEqual([c.first, c.second]);
      expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `${c.id}-s${String(i + 1).padStart(3, '0')}`));
      expect(list).toHaveLength(c.total);
      expect(list.slice(0, c.n).every((s) => s.state.experimentId === c.first)).toBe(true);
      expect(list.slice(c.n).every((s) => s.state.experimentId === c.second)).toBe(true);
      const first = list.slice(0, c.n).map((s) => JSON.stringify(s)).join('\n');
      expect(createHash('sha256').update(first).digest('hex')).toBe(c.sha);
      // 저장소 파일의 앞 22줄도 같다(덧붙이기만 했다).
      const file = readFileSync(scenarioFile(TUTOR_DIR, c.id), 'utf8').trimEnd().split('\n');
      expect(createHash('sha256').update(file.slice(0, c.n).join('\n')).digest('hex')).toBe(c.sha);
      expect(file).toHaveLength(c.total);
    });
    it(`${c.id}: 활동 2의 모든 상황(실행 전·첫 시행·함께 바뀜·바꿀 조건 그대로·반복·공정한 비교·예측 불일치)이 시나리오에 있다`, () => {
      const exp = u.manifest.experiments[1]!;
      const keys = new Set(list.slice(c.n).map((s) => situationOf(s.state, exp)));
      for (const k of ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch']) expect(keys.has(k), k).toBe(true);
    });
  }
});

describe('변인 실험 두 번째 활동을 더한 단원의 시나리오(물체의 운동·물질의 연소)', () => {
  // 각 해시는 두 번째 활동을 더하기 전 ml/tutor/scenarios/<단원>.jsonl 앞 n줄(줄바꿈으로 이은 글자)의 SHA-256이다.
  const CASES = [
    { id: 'g6-motion', first: 'ramp-cart', second: 'position-time', n: 20, total: 40, sha: '216fbe873ffd3d71646a0784436d5eacff1be3cba0318b08e780f0388e73b68f' },
    { id: 'g6-combustion', first: 'candle-jar', second: 'combustion-products', n: 22, total: 42, sha: '6ca252b945d680ad876da831f0453ceaf0191ec404d631d89c2c6d5d8980fd2e' },
  ];
  for (const c of CASES) {
    const u = units[c.id]!;
    const list = generateScenarios(c.id, u);
    it(`${c.id}: 첫 활동(${c.first}) 시나리오 s001~s${String(c.n).padStart(3, '0')}은 활동 2를 더하기 전과 한 글자도 같고, ${c.second} 시나리오가 뒤에 덧붙는다`, () => {
      expect(u.manifest.experiments.map((e) => e.id)).toEqual([c.first, c.second]);
      expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `${c.id}-s${String(i + 1).padStart(3, '0')}`));
      expect(list).toHaveLength(c.total);
      expect(list.slice(0, c.n).every((s) => s.state.experimentId === c.first)).toBe(true);
      expect(list.slice(c.n).every((s) => s.state.experimentId === c.second)).toBe(true);
      const first = list.slice(0, c.n).map((s) => JSON.stringify(s)).join('\n');
      expect(createHash('sha256').update(first).digest('hex')).toBe(c.sha);
      // 저장소 파일의 앞 줄도 같다(덧붙이기만 했다).
      const file = readFileSync(scenarioFile(TUTOR_DIR, c.id), 'utf8').trimEnd().split('\n');
      expect(createHash('sha256').update(file.slice(0, c.n).join('\n')).digest('hex')).toBe(c.sha);
      expect(file).toHaveLength(c.total);
    });
    it(`${c.id}: 활동 2의 모든 상황(실행 전·첫 시행·함께 바뀜·바꿀 조건 그대로·반복·공정한 비교·예측 불일치)이 시나리오에 있다`, () => {
      const exp = u.manifest.experiments[1]!;
      const keys = new Set(list.slice(c.n).map((s) => situationOf(s.state, exp)));
      for (const k of ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch']) expect(keys.has(k), k).toBe(true);
    });
  }
});

describe('시나리오 생성기', () => {
  const generated = TUTOR_UNITS.flatMap((id) => generateScenarios(id, units[id]!));
  const expOf = (s: (typeof generated)[number]) => units[s.unitId]!.manifest.experiments.find((e) => e.id === s.state.experimentId)!;

  it('두 번 만들어도 같고, 저장소의 scenarios/*.jsonl과 같다(결정성·최신 여부)', () => {
    const again = TUTOR_UNITS.flatMap((id) => generateScenarios(id, units[id]!));
    expect(again).toEqual(generated);
    for (const id of TUTOR_UNITS) {
      const expected = generated.filter((s) => s.unitId === id).map((s) => JSON.stringify(s)).join('\n') + '\n';
      expect(readFileSync(scenarioFile(TUTOR_DIR, id), 'utf8'), `${id}: pnpm tutor:scenarios를 다시 실행하세요`).toBe(expected);
    }
  });

  it('단원마다 15~25개(관찰 활동은 과제당 5개)이고, 입력이 서로 다르다', () => {
    for (const id of TUTOR_UNITS) {
      const list = generated.filter((s) => s.unitId === id);
      expect(list.length, id).toBeGreaterThanOrEqual(15);
      // 관찰 활동은 과제마다 5개(다섯 상황)이므로 과제가 5개를 넘으면 그만큼 늘어난다.
      // 활동이 여럿인 단원은 활동마다 상한을 더한다.
      const cap = units[id]!.manifest.experiments.reduce((n, exp) => n + ('tasks' in exp ? Math.max(25, exp.tasks.length * 5) : 25), 0);
      expect(list.length, id).toBeLessThanOrEqual(cap);
      const inputs = list.map((s) => buildTutorInput(expOf(s), s.state, '', { title: units[id]!.manifest.title, grade: units[id]!.manifest.grade }));
      expect(new Set(inputs).size, id).toBe(inputs.length);
    }
  });

  it('상황 키마다 2개 이상(변인·분류)', () => {
    const counts = situationCounts(units, generated);
    const variable = ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch'];
    const classify = ['before-test', 'testing', 'prediction-mismatch', 'check-untested', 'check-inconsistent', 'check-complete'];
    for (const id of TUTOR_UNITS) {
      const exp = units[id]!.manifest.experiments[0]!;
      if (exp.module === 'indicator-classify') for (const k of classify) expect(counts[id]![k], `${id}/${k}`).toBeGreaterThanOrEqual(2);
      else if ('variables' in exp) for (const k of variable) expect(counts[id]![k], `${id}/${k}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('카드 분류: 레이아웃마다 닿을 수 있는 상황을 모두 덮는다', () => {
    const counts = situationCounts(units, generated);
    const groups = ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unobserved', 'check-inconsistent', 'check-complete', 'finished'];
    const tree = ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unobserved', 'check-inconsistent', 'tree-split-empty', 'tree-next-node', 'finished'];
    const order = ['pick-card', 'before-observe', 'sorting', 'order-check-unobserved', 'order-check-inconsistent', 'order-check-complete', 'check-unobserved', 'check-inconsistent', 'finished'];
    for (const k of groups) for (const id of ['g3-animal', 'g3-material']) expect(counts[id]![k], `${id}/${k}`).toBeGreaterThanOrEqual(1);
    for (const k of tree) expect(counts['g3-plantlife']![k], `g3-plantlife/${k}`).toBeGreaterThanOrEqual(1);
    for (const k of order) expect(counts['g5-strata']![k], `g5-strata/${k}`).toBeGreaterThanOrEqual(1);
  });

  it('관찰: 과제마다 다섯 상황이 모두 있다', () => {
    for (const id of ['g6-earth-motion', 'g4-night-sky']) {
      const exp = units[id]!.manifest.experiments[0]!;
      if (!('tasks' in exp)) throw new Error('관찰 활동이 아닙니다.');
      for (const task of exp.tasks) {
        const keys = generated
          .filter((s) => s.unitId === id && s.state.kind === 'observe' && s.state.taskId === task.id)
          .map((s) => situationOf(s.state, exp));
        expect(new Set(keys), `${id}/${task.id}`).toEqual(new Set(['before-observe', 'observing', 'record-mismatch', 'record-match', 'prediction-mismatch']));
      }
    }
  });

  it('조작변인마다 fair-test가 있다', () => {
    for (const id of TUTOR_UNITS) {
      const exp = units[id]!.manifest.experiments[0]!;
      if (!('variables' in exp)) continue;
      for (const v of exp.variables) {
        const has = generated.some(
          (s) => s.unitId === id && s.state.kind === 'variable' && s.state.trials.at(-1)?.analysis.kind === 'fair-test' && s.state.trials.at(-1)?.ivKey === v.key,
        );
        expect(has, `${id}/${v.key}`).toBe(true);
      }
    }
  });

  it('입력에 정답 문구가 없다(학생이 기록한 관찰 결과 자체는 예외: 관찰 단원의 [예측]·[관찰 기록] 줄)', () => {
    for (const s of generated) {
      const exp = expOf(s);
      const lines = buildTutorInput(exp, s.state, '').split('\n');
      // 학생이 직접 고른 예측과 기록은 학생의 활동이므로 검사에서 뺀다.
      const text = (s.state.kind === 'observe' ? lines.filter((l) => !l.startsWith('[예측]') && !l.startsWith('[관찰 기록]')) : lines).join('\n');
      for (const f of exp.tutor.forbiddenAnswers) expect(text.includes(f), `${s.scenarioId}: ${f}`).toBe(false);
    }
  });
});
