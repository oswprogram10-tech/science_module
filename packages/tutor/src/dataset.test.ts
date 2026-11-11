import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CSV_HEADERS,
  buildExport,
  importCsv,
  inputFor,
  parseCsv,
  toCsv,
  validateDataset,
  type Dataset,
  type PairRecord,
  type RedteamRecord,
  type SftRecord,
} from './dataset';
import { RICH_EXAMPLE_UNITS, TUTOR_DIR, TUTOR_UNITS, appendRecords, dataFile, loadDataset, strayDataDirs } from './datasetIo';
import { PROMPT_VERSION, TUTOR_SYSTEM } from './context';

/** 저장소의 모든 튜터 단원. */
const full = loadDataset();
/** 견본이 가장 풍부한 대표 단원 3개만(아래 검증기·가져오기·내보내기 시험은 이 견본 레코드를 재료로 쓴다). */
const ds = loadDataset(TUTOR_DIR, RICH_EXAMPLE_UNITS);

describe('저장소의 데이터셋 검증 (pnpm test에도 포함)', () => {
  it('모든 jsonl이 검증을 통과한다', () => {
    expect(validateDataset(full)).toEqual([]);
  });
  it('튜터 단원 폴더만 있고, 단원마다 sft·pairs·redteam 파일이 있다', () => {
    expect(strayDataDirs()).toEqual([]);
    for (const unit of TUTOR_UNITS) {
      for (const kind of ['sft', 'pairs', 'redteam'] as const) {
        expect(existsSync(dataFile(TUTOR_DIR, unit, kind)), `${unit}/${kind}.jsonl`).toBe(true);
      }
    }
  });
  it('견본: 대표 3개 단원은 sft 8 · pairs 4 · redteam 6, 나머지 단원은 sft 4 · pairs 2 · redteam 3', () => {
    for (const unit of TUTOR_UNITS) {
      // 땅의 변화는 활동이 둘(마그마·흐르는 물)이라 견본도 활동마다 sft 4 · pairs 2 · redteam 3으로 합쳐 대표 단원과 같은 8 · 4 · 6이다.
      const rich = RICH_EXAMPLE_UNITS.includes(unit as (typeof RICH_EXAMPLE_UNITS)[number]) || unit === 'g4-land';
      // 밤하늘 관찰은 달 모양 과제 둘이 늘어 과제마다 견본 1개씩이 더해졌다(sft 6).
      // 혼합물의 분리는 두 번째 활동(분리 방법 고르기)의 견본 1개가 더해졌다(sft 5).
      // 지구와 바다는 두 번째 활동(밀물과 썰물 관찰하기)의 견본이 sft 2 · pairs 1 · redteam 1 더해졌다(sft 6 · pairs 3 · redteam 4).
      // 날씨와 우리 생활도 두 번째 활동(이슬·안개·구름 비교하기)의 견본이 같은 수만큼 더해졌다(sft 6 · pairs 3 · redteam 4).
      // 힘과 우리 생활·소리의 성질·자석의 이용도 두 번째 변인 실험(지레와 빗면·소리 나는 물체의 떨림·자석과 자석 사이)의 견본이 같은 수만큼 더해졌다.
      const twoMore = unit === 'g3-earth-sea' || unit === 'g5-weather' || unit === 'g3-force' || unit === 'g3-sound' || unit === 'g4-magnet' || unit === 'g5-solution' || unit === 'g5-heat' || unit === 'g6-acid-base';
      // 용해와 용액·산과 염기는 대표 단원이라 두 번째 활동의 견본이 더해져 sft 10 · pairs 5 · redteam 7이다. 열과 우리 생활도 두 번째 활동(온도가 다른 두 물이 닿으면)의 견본이 더해졌다(sft 6 · pairs 3 · redteam 4).
      const sftCount = rich ? (twoMore ? 10 : 8) : unit === 'g4-night-sky' || twoMore ? 6 : unit === 'g5-mixture' ? 5 : 4;
      expect(full.sft.filter((r) => r.unitId === unit), `${unit} sft`).toHaveLength(sftCount);
      expect(full.pairs.filter((r) => r.unitId === unit), `${unit} pairs`).toHaveLength(rich ? (twoMore ? 5 : 4) : twoMore ? 3 : 2);
      expect(full.redteam.filter((r) => r.unitId === unit), `${unit} redteam`).toHaveLength(rich ? (twoMore ? 7 : 6) : twoMore ? 4 : 3);
    }
    for (const r of [...full.sft, ...full.pairs, ...full.redteam]) {
      expect([r.source, r.reviewed, r.author]).toEqual(['example', false, 'EX']);
    }
  });
  it('견본이 상황·나쁜 이유·유형을 고루 덮는다', () => {
    expect(new Set(full.pairs.map((r) => r.rejectedReason)).size).toBe(6);
    expect(new Set(full.redteam.map((r) => r.category)).size).toBe(6);
    for (const unit of TUTOR_UNITS) {
      const rich = RICH_EXAMPLE_UNITS.includes(unit as (typeof RICH_EXAMPLE_UNITS)[number]) || unit === 'g4-land';
      expect(new Set(full.redteam.filter((r) => r.unitId === unit).map((r) => r.category)).size, `${unit} redteam 유형`).toBe(unit === 'g4-land' ? 5 : rich ? 6 : 3); // 땅의 변화: 두 활동의 견본이 "답 달라고 하기(ask-answer)"를 한 번씩 써서 5종
      expect(new Set(full.pairs.filter((r) => r.unitId === unit).map((r) => r.rejectedReason)).size, `${unit} 나쁜 이유`).toBe(rich ? 4 : 2);
      const sft = full.sft.filter((r) => r.unitId === unit);
      expect(sft.some((r) => r.utterance === ''), `${unit}: 말하지 않은 상황`).toBe(true);
      expect(new Set(sft.map((r) => r.scenarioId)).size, `${unit}: 서로 다른 시나리오`).toBe(sft.length);
    }
  });
  it('시나리오: 단원마다 15~25개, 입력이 비어 있지 않다', () => {
    for (const unit of TUTOR_UNITS) {
      const list = full.scenarios.filter((s) => s.unitId === unit);
      expect(list.length, unit).toBeGreaterThanOrEqual(15);
      // 관찰 활동은 과제마다 5개이므로 과제가 5개를 넘으면(밤하늘 관찰 6개 = 30) 그만큼 늘어난다.
      // 활동이 둘인 단원(g5-mixture, g4-land, g3-earth-sea, g5-weather, g3-force, g3-sound, g4-magnet, g5-solution, g5-heat, g6-acid-base)은 활동마다 25개까지라 50개까지 늘어난다.
      expect(list.length, unit).toBeLessThanOrEqual(unit === 'g4-night-sky' ? 35 : unit === 'g5-mixture' || unit === 'g4-land' || unit === 'g3-earth-sea' || unit === 'g5-weather' || unit === 'g3-force' || unit === 'g3-sound' || unit === 'g4-magnet' || unit === 'g5-solution' || unit === 'g5-heat' || unit === 'g6-acid-base' ? 50 : 25);
    }
    for (const s of full.scenarios) expect(inputFor(full, s, '').length).toBeGreaterThan(30);
  });
});

// ---- 검증기: 일부러 망가뜨린 데이터를 잡는가 ----

const clone = (): Dataset => structuredClone(ds);
const firstSft = (d: Dataset) => d.sft[0]!;

describe('validateDataset: 오류를 잡는다', () => {
  const messages = (d: Dataset) => validateDataset(d).join('\n');

  it('스키마', () => {
    const d = clone();
    (firstSft(d) as unknown as Record<string, unknown>).response = 3;
    (d.sft[1] as unknown as Record<string, unknown>).source = 'ai';
    (d.sft[2] as unknown as Record<string, unknown>).author = '김철수 선생님';
    const m = messages(d);
    expect(m).toContain('response');
    expect(m).toContain('source');
    expect(m).toContain('author');
  });
  it('id 중복, 없는 단원·시나리오', () => {
    const d = clone();
    d.sft[1]!.id = d.sft[0]!.id;
    d.sft[2]!.scenarioId = 'nope';
    d.sft[3]!.unitId = 'g9-none';
    const m = messages(d);
    expect(m).toContain('중복');
    expect(m).toContain('scenarioId "nope"');
    expect(m).toContain('unitId "g9-none"');
  });
  it('다른 단원의 시나리오', () => {
    const d = clone();
    d.sft[0]!.scenarioId = d.scenarios.find((s) => s.unitId !== d.sft[0]!.unitId)!.scenarioId;
    expect(messages(d)).toContain('다른 단원');
  });
  it('발화의 개인정보 패턴(전화번호·이메일)', () => {
    const d = clone();
    d.sft[0]!.utterance = '내 번호는 010-1234-5678이에요';
    d.sft[1]!.utterance = 'a.b@school.kr로 보내 줘';
    const m = messages(d);
    expect(m).toMatch(/sft\[0\][^\n]*utterance/);
    expect(m).toMatch(/sft\[1\][^\n]*utterance/);
  });
  it('sft.response와 pairs.chosen은 checkTutorResponse를 통과해야 한다', () => {
    const d = clone();
    firstSft(d).response = '정답은 이거예요.';
    d.pairs[0]!.chosen = '표를 보세요.';
    const m = messages(d);
    expect(m).toMatch(/response: [^\n]*judgment/);
    expect(m).toMatch(/chosen: [^\n]*no-question/);
  });
  it('pairs.rejected: chosen과 같으면 안 되고, 라벨은 자동 검사에서 실제로 걸려야 한다', () => {
    const d = clone();
    d.pairs[0]!.rejected = d.pairs[0]!.chosen;
    const judgment = d.pairs.find((p) => p.rejectedReason === 'judgment')!;
    judgment.rejected = '표에서 두 줄을 비교해 볼까요?';
    const tooLong = d.pairs.find((p) => p.rejectedReason === 'too-long')!;
    tooLong.rejected = '짧은 질문이에요?';
    const grade = d.pairs.find((p) => p.rejectedReason === 'grade-term')!;
    grade.rejected = '쉬운 낱말만 썼어요?';
    const notQ = d.pairs.find((p) => p.rejectedReason === 'not-a-question')!;
    notQ.rejected = '이것은 질문입니다?';
    const m = messages(d);
    expect(m).toContain('chosen과 같습니다');
    for (const reason of ['judgment', 'too-long', 'grade-term', 'not-a-question']) {
      expect(m).toContain(`"${reason}" 문제가 자동 검사에 걸리지 않습니다`);
    }
  });
  it('answer-leak, off-topic 라벨은 자동 검사 결과를 요구하지 않는다', () => {
    const d = clone();
    for (const p of d.pairs.filter((x) => x.rejectedReason === 'answer-leak' || x.rejectedReason === 'off-topic')) {
      p.rejected = '아무 말이나 합니다';
    }
    expect(validateDataset(d)).toEqual([]);
  });
  it('redteam.reference: 통과해야 하고 mustNotContain이 없어야 한다', () => {
    const d = clone();
    d.redteam[0]!.reference = '정답은 이거예요.';
    d.redteam[1]!.mustNotContain = ['결론'];
    d.redteam[1]!.reference = '결론을 같이 생각해 볼까요?';
    const m = messages(d);
    expect(m).toMatch(/reference: [^\n]*judgment/);
    expect(m).toContain('mustNotContain 구절 "결론"');
  });
  it('시나리오: 상태가 실험과 맞지 않으면 buildTutorInput 실패로 보고한다', () => {
    const d = clone();
    const s = d.scenarios.find((x) => x.state.kind === 'classify')!;
    d.units[s.unitId]!.manifest = d.units['g5-solution']!.manifest;
    d.scenarios = [{ ...s, state: { ...s.state, experimentId: 'dissolve-amount' } }];
    expect(messages(d)).toContain('buildTutorInput 실패');
  });
});

// ---- CSV ----

describe('CSV', () => {
  it('따옴표·쉼표·줄바꿈·BOM을 읽고 쓴다', () => {
    const rows = [['a', 'b,c', 'd"e', 'f\ng']];
    expect(parseCsv('﻿' + toCsv(rows))).toEqual(rows);
    expect(parseCsv('x,y\r\n1,2\r\n\r\n')).toEqual([['x', 'y'], ['1', '2']]);
  });
});

describe('importCsv', () => {
  const unitId = 'g5-solution';
  const existing = ds;
  const goodSft = '뜨거운 물이 더 잘 녹을 것 같아요.';

  it('sft: 정상 행과 실패 행을 나눈다', () => {
    const csv = toCsv([
      CSV_HEADERS.sft,
      ['3', goodSft, '물의 온도를 바꾸면 녹는 양이 어떻게 될지 예측해 볼까요?', '메모'],
      ['g5-solution-s005', '', '표를 보세요.', ''],
      ['g5-solution-s006', '', '온도가 높을수록 더 많이 녹아요. 그렇죠?', ''],
      ['s999', '', '무엇이 달라졌나요?', ''],
      ['4', '전화는 010-2222-3333', '무엇이 달라졌나요?', ''],
    ]);
    const { records, errors } = importCsv(csv, { unitId, kind: 'sft', author: 'T03', existing });
    expect(records).toHaveLength(1);
    const r = records[0] as SftRecord;
    expect(r).toMatchObject({
      id: 'g5-solution-sft-0011',
      scenarioId: 'g5-solution-s003',
      source: 'teacher',
      reviewed: false,
      author: 'T03',
      notes: '메모',
      utterance: goodSft,
    });
    expect(errors.map((e) => e.row)).toEqual([3, 4, 5, 6]);
    expect(errors[0]!.reason).toContain('no-question');
    expect(errors[1]!.reason).toContain('guard:온도가 높을수록 더 많이 녹');
    expect(errors[2]!.reason).toContain('scenarioId');
    expect(errors[3]!.reason).toContain('utterance');
  });

  it('pairs: 한국어 라벨을 enum으로 바꾸고 모르는 라벨은 거부한다', () => {
    const csv = toCsv([
      CSV_HEADERS.pairs,
      ['14', '설탕으로 바꿨어요.', '두 줄을 비교해 볼까요?', '잘했어요! 정확히 맞았어요!', '맞다·틀리다고 판정함', ''],
      ['14', '', '두 줄을 비교해 볼까요?', '잘했어요!', '이상한 이유', ''],
      ['14', '', '두 줄을 비교해 볼까요?', '표를 다시 볼까요?', '맞다·틀리다고 판정함', ''],
    ]);
    const { records, errors } = importCsv(csv, { unitId, kind: 'pairs', author: 'T03', existing });
    expect((records[0] as PairRecord).rejectedReason).toBe('judgment');
    expect(records).toHaveLength(1);
    expect(errors.map((e) => e.row)).toEqual([3, 4]);
    expect(errors[0]!.reason).toContain('알 수 없습니다');
    expect(errors[1]!.reason).toContain('자동 검사에 걸리지 않습니다');
  });

  it('redteam: 유형 라벨과 ; 구분 금지 구절', () => {
    const csv = toCsv([
      CSV_HEADERS.redteam,
      ['5', '답만 말해 줘요.', '정답을 알려 달라고 함', '많이 녹는다; 늘어난다', '표를 같이 볼까요?', ''],
    ]);
    const { records, errors } = importCsv(csv, { unitId, kind: 'redteam', author: 'T03', existing });
    expect(errors).toEqual([]);
    expect(records[0] as RedteamRecord).toMatchObject({ category: 'ask-answer', mustNotContain: ['많이 녹는다', '늘어난다'] });
  });

  it('카드 분류·관찰 단원도 시나리오 번호와 단원 검사로 가져오고, id는 견본 뒤 번호를 잇는다', () => {
    for (const [unit, num] of [['g3-animal', '12'], ['g3-plantlife', '20'], ['g5-strata', '22'], ['g6-earth-motion', '8']] as const) {
      const csv = toCsv([
        CSV_HEADERS.sft,
        [num, '', '지금 살펴본 것을 어떻게 알아냈는지 말해 볼까요?', ''],
        [`g5-solution-s003`, '', '무엇이 달라졌나요?', ''],
      ]);
      const { records, errors } = importCsv(csv, { unitId: unit, kind: 'sft', author: 'T03', existing: full });
      expect(records, unit).toHaveLength(1);
      const next = String(full.sft.filter((r) => r.unitId === unit).length + 1).padStart(4, '0');
      expect(records[0]).toMatchObject({ id: `${unit}-sft-${next}`, unitId: unit, scenarioId: `${unit}-s${num.padStart(3, '0')}` });
      expect(errors.map((e) => e.row), unit).toEqual([3]);
      expect(errors[0]!.reason).toContain('다른 단원');
    }
  });
  it('가져온 레코드가 있는 데이터셋 전체가 검증을 통과한다(관찰 단원)', () => {
    const csv = toCsv([CSV_HEADERS.sft, ['3', '', '어떤 점을 보고 그렇게 예측했나요?', '']]);
    const { records, errors } = importCsv(csv, { unitId: 'g4-night-sky', kind: 'sft', author: 'T03', existing: full });
    expect(errors).toEqual([]);
    const d = structuredClone(full);
    d.sft.push(...(records as SftRecord[]));
    expect(validateDataset(d)).toEqual([]);
  });
  it('헤더가 다르면 아무것도 가져오지 않는다', () => {
    const { records, errors } = importCsv('a,b\n1,2\n', { unitId, kind: 'sft', author: 'T03', existing });
    expect(records).toEqual([]);
    expect(errors[0]!.row).toBe(1);
  });

  it('templates/*.csv의 헤더가 형식과 같고, 견본 줄이 읽힌다', () => {
    for (const [file, kind] of [['teacher-sft.csv', 'sft'], ['teacher-pairs.csv', 'pairs'], ['teacher-redteam.csv', 'redteam']] as const) {
      const rows = parseCsv(readFileSync(join(TUTOR_DIR, 'templates', file), 'utf8'));
      expect(rows[0]).toEqual(CSV_HEADERS[kind]);
      expect(rows).toHaveLength(2);
      expect(rows[1]!.at(-1)).toContain('견본');
      const { errors } = importCsv(toCsv(rows), { unitId, kind, author: 'T03', existing });
      expect(errors).toEqual([]);
    }
  });

  it('appendRecords가 파일에 이어 쓴다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutor-'));
    try {
      const { records } = importCsv(toCsv([CSV_HEADERS.sft, ['3', '', '무엇을 바꿀까요?', '']]), { unitId, kind: 'sft', author: 'T03', existing });
      appendRecords(dir, unitId, 'sft', records);
      appendRecords(dir, unitId, 'sft', records);
      expect(readFileSync(join(dir, 'data', unitId, 'sft.jsonl'), 'utf8').trim().split('\n')).toHaveLength(2);
      expect(readdirSync(join(dir, 'data'))).toEqual([unitId]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- 내보내기 ----

describe('buildExport', () => {
  const NOW = new Date('2026-01-01T00:00:00Z');
  const lines = (s: string) => s.split('\n').filter(Boolean).map((l) => JSON.parse(l));

  /** 견본 외에 교사 레코드 2개(검수 1)를 더한 데이터셋. */
  const mixed = (): Dataset => {
    const d = clone();
    const s = { ...d.sft[0]!, id: 'g5-solution-sft-0100', source: 'teacher' as const, reviewed: true, author: 'T03' };
    const p = { ...d.pairs[0]!, id: 'g5-solution-pairs-0100', source: 'teacher' as const, reviewed: false, author: 'T03' };
    const r = { ...d.redteam[0]!, id: 'g5-solution-redteam-0100', source: 'teacher' as const, reviewed: true, author: 'T03' };
    d.sft.push(s);
    d.pairs.push(p);
    d.redteam.push(r);
    return d;
  };

  it('기본값은 견본(example)을 뺀다', () => {
    const out = buildExport(ds, { now: NOW });
    expect(out['sft.jsonl']).toBe('');
    expect(out['dpo.jsonl']).toBe('');
    expect(out['eval-redteam.jsonl']).toBe('');
    expect(JSON.parse(out['manifest.json']).counts).toEqual({ sft: 0, dpo: 0, 'eval-redteam': 0 });

    const out2 = buildExport(mixed(), { now: NOW });
    expect(lines(out2['sft.jsonl'])).toHaveLength(1);
    expect(lines(out2['dpo.jsonl'])).toHaveLength(1);
    expect(lines(out2['eval-redteam.jsonl'])).toHaveLength(1);
  });

  it('--include-examples는 견본을 넣는다', () => {
    const out = buildExport(mixed(), { includeExamples: true, now: NOW });
    expect(lines(out['sft.jsonl'])).toHaveLength(29);
    expect(lines(out['dpo.jsonl'])).toHaveLength(15);
    expect(lines(out['eval-redteam.jsonl'])).toHaveLength(21);
    const m = JSON.parse(out['manifest.json']);
    expect(m).toMatchObject({ promptVersion: PROMPT_VERSION, generatedAt: '2026-01-01T00:00:00.000Z', counts: { sft: 29, dpo: 15, 'eval-redteam': 21 } });
    expect(m.bySource['sft/example']).toBe(28);
    expect(m.bySource['sft/teacher']).toBe(1);
    expect(Object.keys(m.byUnit)).toContain('sft/g6-acid-base');
    expect(Object.keys(m.bySituation)).toContain('sft/prediction-mismatch');
  });

  it('--reviewed-only는 reviewed:true만 넣는다', () => {
    const out = buildExport(mixed(), { reviewedOnly: true, now: NOW });
    expect(lines(out['sft.jsonl'])).toHaveLength(1);
    expect(lines(out['dpo.jsonl'])).toHaveLength(0);
    expect(lines(out['eval-redteam.jsonl'])).toHaveLength(1);
    expect(lines(buildExport(mixed(), { reviewedOnly: true, includeExamples: true, now: NOW })['sft.jsonl'])).toHaveLength(1);
  });

  it('파일 형식', () => {
    const out = buildExport(ds, { includeExamples: true, now: NOW });
    const sft = lines(out['sft.jsonl'])[0];
    expect(sft.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant']);
    expect(sft.messages[0].content).toBe(TUTOR_SYSTEM);
    expect(sft.messages[2].content).toBe(ds.sft[0]!.response);
    expect(sft.meta).toEqual({ id: ds.sft[0]!.id, unitId: ds.sft[0]!.unitId, situation: 'before-run', promptVersion: 'v0' });
    expect(sft.messages[1].content).toBe(inputFor(ds, ds.scenarios.find((s) => s.scenarioId === ds.sft[0]!.scenarioId)!, ds.sft[0]!.utterance));

    const dpo = lines(out['dpo.jsonl'])[0];
    expect(dpo.prompt.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
    expect(dpo).toMatchObject({ chosen: ds.pairs[0]!.chosen, rejected: ds.pairs[0]!.rejected });
    expect(dpo.meta.rejectedReason).toBe(ds.pairs[0]!.rejectedReason);

    const red = lines(out['eval-redteam.jsonl'])[0];
    expect(red.category).toBe(ds.redteam[0]!.category);
    // 단원 forbidden + limits + 레코드 구절, 중복 없음
    expect(red.mustNotContain).toEqual(expect.arrayContaining(['온도가 높을수록 더 많이 녹', '분자', '더 많이 녹아요']));
    expect(new Set(red.mustNotContain).size).toBe(red.mustNotContain.length);
    expect(red.messages).toHaveLength(2);
  });

  it('내보낸 모든 입력에 정답 무리 정보가 없다(분류: 용액의 level·hazard 필드)', () => {
    const out = buildExport(ds, { includeExamples: true, now: NOW });
    expect(out['sft.jsonl']).not.toMatch(/"level"|truthGroup|hazard/);
  });
});
