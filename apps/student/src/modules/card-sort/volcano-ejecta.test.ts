import { describe } from 'vitest';
import json from '../../../../../content/units/g4-land/manifest.json';
import { VolcanoIcon, VOLCANO_ICON_KEYS, VOLCANO_RESULT } from './VolcanoIcons';
import { defineBatchCSuite } from './batchCSuite';

/** 화산에서 나오는 것 나누기 활동(g4-land 단원의 마지막 활동) 시험. 사양 docs/specs/card-sort-batch-c.md. 시험 묶음은 batchCSuite.ts. */
const R = VOLCANO_RESULT as Record<string, Record<string, unknown>>;

describe('volcano-ejecta', () => {
  defineBatchCSuite({
    json,
    unit: { id: "g4-land", title: "땅의 변화", grade: 4, engine: "earth", standards: ["4과11-01", "4과11-02", "4과11-03"] },
    expIds: ["magma-cooling", "stream-table", "volcano-ejecta"],
    exp: { id: "volcano-ejecta", title: "화산에서 나오는 것 나누기", question: "화산이 폭발하면 어떤 물질이 나올까?", limits: ["마그마의 성분", "이산화 황", "판 구조", "섭씨 1000"] },
    features: [["source", "나온 곳", "사진 설명 읽기"], ["shape", "모양", "돋보기로 보기"], ["flow", "흘러내림", "흘러가는 모습 지켜보기"]],
    criteria: [["source", "어디에서 나왔나요?", "source", true, [["real", "실제 화산"], ["model", "화산 모형"]]], ["shape", "알갱이나 조각 하나하나의 모양이 일정한가요?", "shape", true, [["keep", "일정하다"], ["change", "일정하지 않다"]]], ["flow", "땅 위를 따라 흘러내리나요?", "flow", true, [["yes", "흘러내린다"], ["no", "흘러내리지 않는다"]]], ["scary", "무서워 보이나요?", undefined, false, [["scary", "무서워 보인다"], ["notScary", "무서워 보이지 않는다"]]]] as never,
    table: {"gas": ["화산 가스", "vc-gas", "real", "change", "no"], "lava": ["용암", "vc-lava", "real", "change", "yes"], "ash": ["화산재", "vc-ash", "real", "keep", "no"], "rockPiece": ["화산 암석 조각", "vc-rock", "real", "keep", "no"], "mSmoke": ["모형 꼭대기의 연기", "vc-m-smoke", "model", "change", "no"], "mLava": ["모형 옆으로 흘러내린 녹은 것", "vc-m-flow", "model", "change", "yes"], "mPiece": ["모형 둘레에 식어 굳은 조각", "vc-m-piece", "model", "keep", "no"], "mPowder": ["모형 둘레에 흩어진 가루", "vc-m-powder", "model", "keep", "no"]},
    obs: {"gas": ["화산 꼭대기의 입구에서 뿜어 나오는 것을 찍은 사진이에요.", "뿜어 나오며 모양이 계속 바뀌고, 퍼지면서 점점 흐려져요.", "하늘로 올라가고 땅 위를 따라 흘러내리지 않아요."], "lava": ["화산 꼭대기에서 솟아 나온 것을 찍은 사진이에요.", "붉게 빛나며 계속 모양이 바뀌어요.", "산비탈을 따라 천천히 흘러내려요."], "ash": ["화산이 폭발한 뒤 마을에 쌓인 것을 찍은 사진이에요.", "돋보기로 보면 작고 거친 알갱이가 하나하나 모양을 가지고 있어요.", "하늘에서 내려와 쌓이고, 땅 위를 따라 흘러내리지 않아요."], "rockPiece": ["화산이 폭발한 뒤 산비탈에 떨어져 있던 것을 찍은 사진이에요.", "돋보기로 보면 구멍이 숭숭 뚫린 단단한 조각이고 모양이 그대로예요.", "산비탈에 놓여 있고 땅 위를 따라 흘러내리지 않아요."], "mSmoke": ["녹는 재료로 만든 화산 모형을 데울 때 찍은 사진이에요.", "모형 꼭대기에서 올라오며 모양이 계속 바뀌어요.", "위로 올라가고 모형 옆면을 따라 흘러내리지 않아요."], "mLava": ["녹는 재료로 만든 화산 모형을 데울 때 찍은 사진이에요.", "흐르는 동안 모양이 계속 바뀌어요.", "모형 옆면을 따라 흘러내려요."], "mPiece": ["녹는 재료로 만든 화산 모형이 식은 뒤 모형 둘레를 찍은 사진이에요.", "돋보기로 보면 단단하게 굳은 조각이고 모양이 그대로예요.", "모형 둘레에 놓여 있고 흘러내리지 않아요."], "mPowder": ["녹는 재료로 만든 화산 모형을 데운 뒤 모형 둘레를 찍은 사진이에요.", "돋보기로 보면 작은 알갱이 하나하나의 모양이 그대로예요.", "모형 둘레에 쌓여 있고 흘러내리지 않아요."]},
    notInObservation: ["고체", "액체", "기체", "마그마", "이산화", "판 구조", "정답", "오답"],
    finished: "모형에서 본 것과 실제 화산에서 나오는 것은 어떤 점이 같고, 어떤 점이 다를까요?",
    requiredForbidden: ["용암은 액체", "화산 가스는 기체", "화산재는 고체", "암석 조각은 고체", "모형의 연기는 화산 가스", "흘러내린 것은 용암", "무서워 보이나는 분류 기준이 될 수 없"],
    leaks: ["용암은 액체예요.", "화산 가스는 기체예요.", "화산재는 고체예요.", "암석 조각은 고체예요.", "모형의 연기는 화산 가스예요.", "흘러내린 것은 용암이에요.", "흘러내린 것이 용암이에요.", "녹은 것은 용암이에요.", "무서워 보이는지는 분류 기준이 아니에요.", "마그마의 성분이 달라요.", "이산화 황이 나와요.", "판 구조 때문이에요.", "섭씨 1000도예요."],
    innocents: ["용암이 산비탈을 따라 흘러내리는 사진이에요.", "화산재를 돋보기로 살펴볼까요?", "모형에서 올라오는 연기를 관찰해 볼까요?"],
    wrong: { card: "ash", criterion: "shape", group: "일정하지 않다", sentence: "화산재는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?" },
    icon: {
      keys: VOLCANO_ICON_KEYS,
      result: R,
      Component: VolcanoIcon,
      marks: {
    source: ['vc-source', 'data-source', (i) => String(R[i].source)],
    shape: ['vc-shape', 'data-shape', (i) => String(R[i].shape)],
    flow: ['vc-flow', 'data-flow', (i) => String(R[i].flow)],
      },
    },
  });
});
