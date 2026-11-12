import type { BulbSample, BulbResult } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { BulbCircuit, CH, CW } from './BulbCircuit';
import { BULB_NOTE_EMPTY, CELLS_TEXT, END_TEXT, SWITCH_TEXT, WIRE_TEXT, batteryOutput, bulbNote, bulbOutput, startSample, toBatteryParams, toParams } from './initial';

/** 전구에 불 켜기 눈으로 보기: 전지 끼우개의 전지 한 개, 맨 전구, 스위치, 전선 두 가닥. 선택한 연결은 실행 전에도 보이고 불빛은 실행 뒤에만 나타난다. */
export function BulbLightMacroView({ trial, snapshot, values }: ViewProps<BulbSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const r: BulbResult = bulbOutput(values).result;
  const note = ran ? bulbNote(s, r) : BULB_NOTE_EMPTY;
  return (
    <figure className="view bulb-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={`전지 끼우개에 전지 한 개, 전구 끼우개 없는 맨 전구, 스위치 ${SWITCH_TEXT[p.switch]}, 전선 두 가닥. 전지 (+)극 쪽 전선을 댄 곳은 ${END_TEXT[p.plusEnd]}, (−)극 쪽 전선을 댄 곳은 ${END_TEXT[p.minusEnd]}. 전선 색깔은 ${WIRE_TEXT[p.wireColor]}. ${note}`}>
        <BulbCircuit cells="one" plusEnd={p.plusEnd} minusEnd={p.minusEnd} closed={p.switch === 'closed'} wire={p.wireColor} level={s.level} ran={ran} />
      </svg>
      <p className="view-note" data-testid="bulb-note">{note}</p>
    </figure>
  );
}

/** 전지 직렬연결 비교 눈으로 보기: 전지 끼우개에 전지가 한 줄로 놓인 모습. 전구, 전선, 스위치(닫힘)는 고정이다. */
export function BatterySeriesMacroView({ trial, snapshot, values }: ViewProps<BulbSample>) {
  const p = toBatteryParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const r: BulbResult = batteryOutput(values).result;
  const note = ran ? bulbNote(s, r) : BULB_NOTE_EMPTY;
  return (
    <figure className="view bulb-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={`전지 끼우개에 ${CELLS_TEXT[p.cells]}, 전구, 닫힌 스위치, 전선 두 가닥. 전선 색깔은 ${WIRE_TEXT[p.wireColor]}. ${note}`}>
        <BulbCircuit cells={p.cells} plusEnd="tip" minusEnd="side" closed wire={p.wireColor} level={s.level} ran={ran} />
      </svg>
      <p className="view-note" data-testid="bulb-note">{note}</p>
    </figure>
  );
}
