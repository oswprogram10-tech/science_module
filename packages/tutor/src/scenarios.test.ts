import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { UNITS } from '../../../apps/student/src/units';
import { generateScenarios, situationCounts } from '../scripts/scenarios';
import { buildTutorInput, situationOf } from './context';
import { CONTENT_DIR, TUTOR_DIR, TUTOR_UNITS, loadUnits, scenarioFile } from './datasetIo';

const units = loadUnits();
/** 카드 분류 두 번째 활동을 더한 단원 넷(1차 묶음). */
const CARD_SORT_BATCH_A = ['g3-animal', 'g3-plantlife', 'g4-ecosystem', 'g5-strata'];
/** 카드 분류 활동을 더한 단원 넷(3차 묶음). 물체와 물질·물의 상태 변화는 두 번째, 땅의 변화·물질의 연소는 세 번째 활동이다. */
const CARD_SORT_BATCH_C = ['g3-material', 'g4-water-state', 'g4-land', 'g6-combustion'];
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
      if (id === 'g4-gases' || id === 'g5-mixture' || id === 'g4-land' || id === 'g3-earth-sea' || id === 'g5-weather' || id === 'g3-force' || id === 'g3-sound' || id === 'g5-light' || id === 'g4-magnet' || id === 'g5-solution' || id === 'g5-heat' || id === 'g6-acid-base' || id === 'g6-motion' || id === 'g6-combustion' || CARD_SORT_BATCH_A.includes(id) || CARD_SORT_BATCH_C.includes(id)) continue;
      const only = units[id]!.manifest.experiments;
      expect(only, id).toHaveLength(1);
      expect(new Set(generateScenarios(id, units[id]!).map((s) => s.state.experimentId)), id).toEqual(new Set([only[0]!.id]));
    }
  });
});

describe('날씨와 우리 생활 시나리오(활동 2 덧붙임, 활동 3 건습구 습도계는 그 뒤에 덧붙음)', () => {
  const weather = units['g5-weather']!;
  const list = generateScenarios('g5-weather', weather);
  it('첫 활동(해륙풍) 시나리오 s001~s020은 활동 2를 더하기 전과 한 글자도 같고, 이슬·안개·구름 시나리오 24개가 뒤에 덧붙는다', () => {
    expect(weather.manifest.experiments.map((e) => e.id)).toEqual(['land-sea-breeze', 'dew-fog-cloud', 'humidity']);
    expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `g5-weather-s${String(i + 1).padStart(3, '0')}`));
    expect(list).toHaveLength(64);
    expect(list.slice(0, 20).every((s) => s.state.experimentId === 'land-sea-breeze')).toBe(true);
    expect(list.slice(20, 44).every((s) => s.state.experimentId === 'dew-fog-cloud')).toBe(true);
    expect(list.slice(44).every((s) => s.state.experimentId === 'humidity')).toBe(true);
    // 이 해시는 활동 2를 더하기 전 ml/tutor/scenarios/g5-weather.jsonl 20줄(줄바꿈으로 이은 글자)의 SHA-256이다.
    const first = list.slice(0, 20).map((s) => JSON.stringify(s)).join('\n');
    expect(createHash('sha256').update(first).digest('hex')).toBe('49d6c3140fd5be2819f91d386147414c4c7e46d5b5629a33cbef0cc77cb39d79');
    // 활동 3(humidity)을 더하기 전 앞 44줄(활동 1·2)의 SHA-256도 같다.
    const first44 = list.slice(0, 44).map((s) => JSON.stringify(s)).join('\n');
    expect(createHash('sha256').update(first44).digest('hex')).toBe('39374720fb2621d6db3769742ae559c5861c2f84ad40f228750e612c28096f5d');
  });
  it('카드 분류의 모든 상황이 시나리오에 있다', () => {
    const exp = weather.manifest.experiments[1]!;
    const keys = new Set(list.slice(20, 44).map((s) => situationOf(s.state, exp)));
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

describe('카드 분류 활동을 더한 단원 넷의 시나리오(3차 묶음, 덧붙임)', () => {
  // [단원, 앞 활동 id들, 새 활동 id, 앞 활동 시나리오 수, 새 활동 시나리오 수, 새 활동을 더하기 전 jsonl 줄(줄바꿈으로 이은 글자)의 SHA-256]
  // 물체와 물질·물의 상태 변화는 두 번째 활동, 땅의 변화·물질의 연소는 세 번째 활동이다(활동이 셋이어도 앞 활동 줄은 그대로다).
  // 물질의 연소는 객관적 기준이 둘뿐이라 같은 상태가 겹치는 한 개를 덜고 23개다.
  const CASES: Array<[string, string[], string, number, number, string]> = [
    ['g3-material', ['material-sort'], 'matter-shape-volume', 24, 24, 'f6154152eb8aee2906a129eef15a461b314b0ad5f3914e9c5e0444492d373851'],
    ['g4-water-state', ['freeze-melt'], 'water-around', 20, 24, 'f323859e372a3014c272306bfd01ecc1efbd55bbc41ef319691a1c9830f761ff'],
    ['g4-land', ['magma-cooling', 'stream-table'], 'volcano-ejecta', 42, 24, '111ab08a1a93681846f90455ad0a31aeac8ed2b84b75114954fa6a84b7e9763f'],
    ['g6-combustion', ['candle-jar', 'combustion-products'], 'property-change', 42, 23, '1d79d698086d8735a12b8cd5b0bb916459c243fc057e9a2307ec35b45ff54b51'],
  ];
  for (const [id, prev, newId, nPrev, nNew, sha] of CASES) {
    const unit = units[id]!;
    const list = generateScenarios(id, unit);
    it(`${id}: 앞 활동(${prev.join('·')}) 시나리오 ${nPrev}줄은 ${newId}를 더하기 전과 한 글자도 같고, ${newId} 시나리오 ${nNew}개가 뒤에 덧붙는다`, () => {
      expect(unit.manifest.experiments.map((e) => e.id)).toEqual([...prev, newId]);
      expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `${id}-s${String(i + 1).padStart(3, '0')}`));
      expect(list).toHaveLength(nPrev + nNew);
      expect(list.slice(0, nPrev).every((s) => prev.includes(s.state.experimentId))).toBe(true);
      expect(list.slice(nPrev).every((s) => s.state.experimentId === newId)).toBe(true);
      const first = list.slice(0, nPrev).map((s) => JSON.stringify(s)).join('\n');
      expect(createHash('sha256').update(first).digest('hex')).toBe(sha);
    });
    it(`${id}: ml/tutor/scenarios/${id}.jsonl이 생성 결과와 같고 앞 ${nPrev}줄이 그대로다`, () => {
      const text = readFileSync(scenarioFile(TUTOR_DIR, id), 'utf8');
      expect(text).toBe(list.map((s) => JSON.stringify(s)).join('\n') + '\n');
      expect(createHash('sha256').update(text.split('\n').slice(0, nPrev).join('\n')).digest('hex')).toBe(sha);
    });
    it(`${id}: 카드 분류의 상황이 시나리오에 있고 입력이 서로 겹치지 않는다`, () => {
      const exp = unit.manifest.experiments[unit.manifest.experiments.length - 1]!;
      const added = list.slice(nPrev);
      const keys = new Set(added.map((s) => situationOf(s.state, exp)));
      for (const k of ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unobserved', 'check-inconsistent', 'check-complete', 'finished']) expect(keys.has(k), k).toBe(true);
      expect(new Set(added.map((s) => JSON.stringify(s.state))).size).toBe(added.length);
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

describe('변인 실험 두 번째 활동을 더한 단원의 시나리오(자석의 이용)', () => {
  // 각 해시는 두 번째 활동을 더하기 전 ml/tutor/scenarios/<단원>.jsonl 20줄(줄바꿈으로 이은 글자)의 SHA-256이다.
  const CASES = [
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

describe('변인 실험을 더한 단원의 시나리오(힘과 우리 생활 활동 3·4, 여러 가지 기체 활동 2)', () => {
  // 각 해시는 이 활동들을 더하기 전 ml/tutor/scenarios/<단원>.jsonl 앞 n줄(줄바꿈으로 이은 글자)의 SHA-256이다.
  const CASES = [
    { id: 'g3-force', before: ['lever-balance', 'lever-lift'], n: 40, sha: '5bd9ee71ccc4b7b33f2396db523c5d4c4d3a474c27ea24f2dab705e89f6e0c3e', added: [['push-pull', 22], ['spring-scale', 20]] as const },
    { id: 'g4-gases', before: ['syringe-volume'], n: 22, sha: 'ba745a76006293d5979066e281c1d104833c2a78540cb354b6bc41654ded99a0', added: [['gas-weight', 20]] as const },
  ];
  for (const c of CASES) {
    const u = units[c.id]!;
    const list = generateScenarios(c.id, u);
    const total = c.n + c.added.reduce((a, [, k]) => a + k, 0);
    it(`${c.id}: 앞 ${c.n}줄은 새 활동을 더하기 전과 한 글자도 같고, ${c.added.map(([e]) => e).join('·')} 시나리오가 순서대로 뒤에 덧붙는다`, () => {
      expect(u.manifest.experiments.map((e) => e.id)).toEqual([...c.before, ...c.added.map(([e]) => e)]);
      expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `${c.id}-s${String(i + 1).padStart(3, '0')}`));
      expect(list).toHaveLength(total);
      const head = list.slice(0, c.n);
      expect(head.every((s) => c.before.includes(s.state.experimentId))).toBe(true);
      expect(createHash('sha256').update(head.map((s) => JSON.stringify(s)).join('\n')).digest('hex')).toBe(c.sha);
      let at = c.n;
      for (const [id, k] of c.added) {
        expect(list.slice(at, at + k).every((s) => s.state.experimentId === id), id).toBe(true);
        at += k;
      }
      // 저장소 파일의 앞 줄도 같다(덧붙이기만 했다).
      const file = readFileSync(scenarioFile(TUTOR_DIR, c.id), 'utf8').trimEnd().split('\n');
      expect(createHash('sha256').update(file.slice(0, c.n).join('\n')).digest('hex')).toBe(c.sha);
      expect(file).toHaveLength(total);
    });
    it(`${c.id}: 새 활동마다 모든 상황(실행 전·첫 시행·함께 바뀜·바꿀 조건 그대로·반복·공정한 비교·예측 불일치)이 시나리오에 있다`, () => {
      let at = c.n;
      for (const [id, k] of c.added) {
        const exp = u.manifest.experiments.find((e) => e.id === id)!;
        const keys = new Set(list.slice(at, at + k).map((s) => situationOf(s.state, exp)));
        for (const key of ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch']) expect(keys.has(key), `${id} ${key}`).toBe(true);
        at += k;
      }
    });
  }
  it('힘과 우리 생활은 앞 20줄(막대의 수평 잡기)과 21~40줄(지레와 빗면)이 각각 그대로이고, 새 활동의 조작변인마다 공정한 비교가 있다', () => {
    const u = units['g3-force']!;
    const list = generateScenarios('g3-force', u);
    expect(createHash('sha256').update(list.slice(0, 20).map((s) => JSON.stringify(s)).join('\n')).digest('hex')).toBe('081c85aa9aac658b17576638f46c1631805d7514e83f68b217d4f96c0ab06bca');
    expect(list.slice(0, 20).every((s) => s.state.experimentId === 'lever-balance')).toBe(true);
    expect(list.slice(20, 40).every((s) => s.state.experimentId === 'lever-lift')).toBe(true);
    for (const id of ['push-pull', 'spring-scale']) {
      const exp = u.manifest.experiments.find((e) => e.id === id)!;
      const ivs = new Set(list.filter((s) => s.state.experimentId === id && s.state.kind === 'variable' && situationOf(s.state, exp) === 'fair-test').map((s) => (s.state.kind === 'variable' ? s.state.trials.at(-1)?.ivKey : null)));
      for (const v of (exp as VariableExperiment).variables) expect(ivs.has(v.key), `${id} ${v.key}`).toBe(true);
    }
  });
});

describe('변인 실험 두 번째 활동을 더한 단원의 시나리오(용해와 용액·산과 염기; 열과 우리 생활은 활동이 넷이라 아래에서 따로 본다)', () => {
  // 각 해시는 두 번째 활동을 더하기 전 ml/tutor/scenarios/<단원>.jsonl 22줄(줄바꿈으로 이은 글자)의 SHA-256이다.
  const CASES = [
    { id: 'g5-solution', first: 'dissolve-amount', second: 'concentration', n: 22, total: 44, sha: '4d4c759ff02678f721fc15026ef333f76bf8f7aa0cffc66dd07857a6e1c588f0' },
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
      // 물질의 연소는 이 뒤에 카드 분류 세 번째 활동(property-change)이 더해졌다. 활동 1·2의 줄(앞 total줄)만 본다.
      expect(u.manifest.experiments.slice(0, 2).map((e) => e.id)).toEqual([c.first, c.second]);
      expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `${c.id}-s${String(i + 1).padStart(3, '0')}`));
      expect(list.length).toBeGreaterThanOrEqual(c.total);
      expect(list.slice(0, c.n).every((s) => s.state.experimentId === c.first)).toBe(true);
      expect(list.slice(c.n, c.total).every((s) => s.state.experimentId === c.second)).toBe(true);
      const first = list.slice(0, c.n).map((s) => JSON.stringify(s)).join('\n');
      expect(createHash('sha256').update(first).digest('hex')).toBe(c.sha);
      // 저장소 파일의 앞 줄도 같다(덧붙이기만 했다).
      const file = readFileSync(scenarioFile(TUTOR_DIR, c.id), 'utf8').trimEnd().split('\n');
      expect(createHash('sha256').update(file.slice(0, c.n).join('\n')).digest('hex')).toBe(c.sha);
      expect(file.length).toBeGreaterThanOrEqual(c.total);
    });
    it(`${c.id}: 활동 2의 모든 상황(실행 전·첫 시행·함께 바뀜·바꿀 조건 그대로·반복·공정한 비교·예측 불일치)이 시나리오에 있다`, () => {
      const exp = u.manifest.experiments[1]!;
      const keys = new Set(list.slice(c.n, c.total).map((s) => situationOf(s.state, exp)));
      for (const k of ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch']) expect(keys.has(k), k).toBe(true);
    });
  }
});

describe('변인 실험 활동을 더한 단원의 시나리오(빛의 성질 활동 2, 소리의 성질 활동 3)', () => {
  // 각 해시는 활동을 더하기 전 ml/tutor/scenarios/<단원>.jsonl 앞 n줄(줄바꿈으로 이은 글자)의 SHA-256이다.
  const hash = (lines: string[]) => createHash('sha256').update(lines.join('\n')).digest('hex');
  const SITUATIONS = ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch'];

  it('g5-light: 첫 활동(convex-lens) 시나리오 s001~s020은 활동 2를 더하기 전과 한 글자도 같고, light-needed 시나리오가 뒤에 덧붙는다', () => {
    const u = units['g5-light']!;
    const list = generateScenarios('g5-light', u);
    expect(u.manifest.experiments.map((e) => e.id)).toEqual(['convex-lens', 'light-needed']);
    expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `g5-light-s${String(i + 1).padStart(3, '0')}`));
    expect(list).toHaveLength(40);
    expect(list.slice(0, 20).every((s) => s.state.experimentId === 'convex-lens')).toBe(true);
    expect(list.slice(20).every((s) => s.state.experimentId === 'light-needed')).toBe(true);
    const sha = 'd970b944b05314c79cfdd1e2f12b99e4c7b054ef84dd97307241f925c9010a39';
    expect(hash(list.slice(0, 20).map((s) => JSON.stringify(s)))).toBe(sha);
    const file = readFileSync(scenarioFile(TUTOR_DIR, 'g5-light'), 'utf8').trimEnd().split('\n');
    expect(hash(file.slice(0, 20))).toBe(sha);
    expect(file).toHaveLength(40);
    const exp = u.manifest.experiments[1]!;
    const keys = new Set(list.slice(20).map((s) => situationOf(s.state, exp)));
    for (const k of SITUATIONS) expect(keys.has(k), k).toBe(true);
  });

  it('g3-sound: 활동이 셋이다. s001~s020(string-sound)과 s021~s042(sound-vibration)는 활동 3을 더하기 전과 한 글자도 같고, sound-transmit 시나리오가 뒤에 덧붙는다', () => {
    const u = units['g3-sound']!;
    const list = generateScenarios('g3-sound', u);
    expect(u.manifest.experiments.map((e) => e.id)).toEqual(['string-sound', 'sound-vibration', 'sound-transmit']);
    expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `g3-sound-s${String(i + 1).padStart(3, '0')}`));
    expect(list).toHaveLength(62);
    expect(list.slice(0, 20).every((s) => s.state.experimentId === 'string-sound')).toBe(true);
    expect(list.slice(20, 42).every((s) => s.state.experimentId === 'sound-vibration')).toBe(true);
    expect(list.slice(42).every((s) => s.state.experimentId === 'sound-transmit')).toBe(true);
    const sha20 = 'a045442aac8240a59b6114b69c1a6701a17954c41e318fd617137dc3c89d8233';
    const sha42 = 'ffad8dadd5a69a91ab86797f1301f4cca6ea0f1cabf5dccde24eb26a7c5a5f54';
    expect(hash(list.slice(0, 20).map((s) => JSON.stringify(s)))).toBe(sha20);
    expect(hash(list.slice(0, 42).map((s) => JSON.stringify(s)))).toBe(sha42);
    const file = readFileSync(scenarioFile(TUTOR_DIR, 'g3-sound'), 'utf8').trimEnd().split('\n');
    expect(hash(file.slice(0, 20))).toBe(sha20);
    expect(hash(file.slice(0, 42))).toBe(sha42);
    expect(file).toHaveLength(62);
    for (const [i, from, to] of [[1, 20, 42], [2, 42, 62]] as const) {
      const exp = u.manifest.experiments[i]!;
      const keys = new Set(list.slice(from, to).map((s) => situationOf(s.state, exp)));
      for (const k of SITUATIONS) expect(keys.has(k), `${exp.id} ${k}`).toBe(true);
    }
  });
});

describe('변인 실험 활동을 더한 단원의 시나리오(날씨와 우리 생활 활동 3, 열과 우리 생활 활동 3·4)', () => {
  // 각 해시는 활동을 더하기 전 ml/tutor/scenarios/<단원>.jsonl 앞 n줄(줄바꿈으로 이은 글자)의 SHA-256이다.
  const hash = (lines: string[]) => createHash('sha256').update(lines.join('\n')).digest('hex');
  const SITUATIONS = ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch'];

  it('g5-weather: s001~s044(해륙풍·이슬 안개 구름)는 활동 3을 더하기 전과 한 글자도 같고, humidity 시나리오 20개가 뒤에 덧붙는다', () => {
    const u = units['g5-weather']!;
    const list = generateScenarios('g5-weather', u);
    expect(u.manifest.experiments.map((e) => e.id)).toEqual(['land-sea-breeze', 'dew-fog-cloud', 'humidity']);
    expect(list).toHaveLength(64);
    const sha44 = '39374720fb2621d6db3769742ae559c5861c2f84ad40f228750e612c28096f5d';
    expect(hash(list.slice(0, 44).map((s) => JSON.stringify(s)))).toBe(sha44);
    const file = readFileSync(scenarioFile(TUTOR_DIR, 'g5-weather'), 'utf8').trimEnd().split('\n');
    expect(hash(file.slice(0, 44))).toBe(sha44);
    expect(file).toHaveLength(64);
    const exp = u.manifest.experiments[2]!;
    const keys = new Set(list.slice(44).map((s) => situationOf(s.state, exp)));
    for (const k of SITUATIONS) expect(keys.has(k), k).toBe(true);
  });

  it('g5-heat: 활동이 넷이다. s001~s022(insulated-cup)와 s023~s044(heat-contact)는 활동 3, 4를 더하기 전과 한 글자도 같고, thermometer와 heat-transfer 시나리오가 뒤에 덧붙는다', () => {
    const u = units['g5-heat']!;
    const list = generateScenarios('g5-heat', u);
    expect(u.manifest.experiments.map((e) => e.id)).toEqual(['insulated-cup', 'heat-contact', 'thermometer', 'heat-transfer']);
    expect(list.map((s) => s.scenarioId)).toEqual(list.map((_, i) => `g5-heat-s${String(i + 1).padStart(3, '0')}`));
    expect(list).toHaveLength(86);
    expect(list.slice(0, 22).every((s) => s.state.experimentId === 'insulated-cup')).toBe(true);
    expect(list.slice(22, 44).every((s) => s.state.experimentId === 'heat-contact')).toBe(true);
    expect(list.slice(44, 66).every((s) => s.state.experimentId === 'thermometer')).toBe(true);
    expect(list.slice(66).every((s) => s.state.experimentId === 'heat-transfer')).toBe(true);
    const sha22 = '0c55b35d5e2fd8134a507be9b02e7c0f757c10d5cb18cca759c8e397d98f603d';
    const sha44 = 'f69ad0b46495742b8ab5e1c3be055c65b985b9c5703ece237063d1ff89ab6607';
    expect(hash(list.slice(0, 22).map((s) => JSON.stringify(s)))).toBe(sha22);
    expect(hash(list.slice(0, 44).map((s) => JSON.stringify(s)))).toBe(sha44);
    const file = readFileSync(scenarioFile(TUTOR_DIR, 'g5-heat'), 'utf8').trimEnd().split('\n');
    expect(hash(file.slice(0, 22))).toBe(sha22);
    expect(hash(file.slice(0, 44))).toBe(sha44);
    expect(file).toHaveLength(86);
    for (const [i, from, to] of [[1, 22, 44], [2, 44, 66], [3, 66, 86]] as const) {
      const exp = u.manifest.experiments[i]!;
      const keys = new Set(list.slice(from, to).map((s) => situationOf(s.state, exp)));
      for (const k of SITUATIONS) expect(keys.has(k), `${exp.id} ${k}`).toBe(true);
    }
  });
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
