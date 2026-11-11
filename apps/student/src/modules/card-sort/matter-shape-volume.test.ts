import { describe } from 'vitest';
import json from '../../../../../content/units/g3-material/manifest.json';
import { MatterShapeIcon, MATTER_ICON_KEYS, MATTER_RESULT } from './MatterShapeIcons';
import { defineBatchCSuite } from './batchCSuite';

/** 모양과 부피로 물질 나누기 활동(g3-material 단원의 마지막 활동) 시험. 사양 docs/specs/card-sort-batch-c.md. 시험 묶음은 batchCSuite.ts. */
const R = MATTER_RESULT as Record<string, Record<string, unknown>>;

describe('matter-shape-volume', () => {
  defineBatchCSuite({
    json,
    unit: { id: "g3-material", title: "물체와 물질", grade: 3, engine: "matter", standards: ["4과05-01", "4과05-02"] },
    expIds: ["material-sort", "matter-shape-volume"],
    exp: { id: "matter-shape-volume", title: "모양과 부피로 물질 나누기", question: "다른 그릇에 옮겨 담으면 모양과 부피가 변하는 물질과 변하지 않는 물질이 있을까?", limits: ["분자", "입자", "압축", "밀도"] },
    features: [["shape", "모양", "넓은 그릇과 좁은 그릇에 옮겨 보기"], ["volume", "부피", "눈금 있는 그릇에 옮겨 눈금 보기"], ["see", "보임", "가까이 들여다보기"]],
    criteria: [["shape", "다른 그릇에 옮겨도 모양이 그대로인가요?", "shape", true, [["keep", "그대로다"], ["change", "바뀐다"]]], ["volume", "다른 그릇에 옮겨도 차지하는 부피가 그대로인가요?", "volume", true, [["keep", "그대로다"], ["change", "바뀐다"]]], ["see", "눈에 보이나요?", "see", true, [["yes", "보인다"], ["no", "보이지 않는다"]]], ["feel", "만지면 기분이 좋은가요?", undefined, false, [["good", "기분이 좋다"], ["notGood", "기분이 좋지 않다"]]]] as never,
    table: {"wood": ["나무 토막", "ms-wood", "keep", "keep", "yes"], "stone": ["돌", "ms-stone", "keep", "keep", "yes"], "eraser": ["지우개", "ms-eraser", "keep", "keep", "yes"], "sand": ["모래", "ms-sand", "keep", "keep", "yes"], "water": ["물", "ms-water", "change", "keep", "yes"], "milk": ["우유", "ms-milk", "change", "keep", "yes"], "oil": ["식용유", "ms-oil", "change", "keep", "yes"], "syringeAir": ["주사기 속 공기", "ms-syringe", "change", "change", "no"], "helium": ["풍선 속 헬륨", "ms-helium", "change", "change", "no"]},
    obs: {"wood": ["넓은 그릇에 넣어도 좁은 그릇에 넣어도 네모난 모양 그대로예요.", "눈금 그릇에 넣었다 빼도 차지하는 크기가 같아요.", "나뭇결이 보여요."], "stone": ["넓은 그릇에 넣어도 좁은 그릇에 넣어도 울퉁불퉁한 모양 그대로예요.", "눈금 그릇에 넣었다 빼도 차지하는 크기가 같아요.", "회색 바탕에 작은 반짝이는 점이 보여요."], "eraser": ["넓은 그릇에 넣어도 좁은 그릇에 넣어도 모서리가 둥근 네모 모양 그대로예요.", "눈금 그릇에 넣었다 빼도 차지하는 크기가 같아요.", "흰 몸통과 파란 띠가 보여요."], "sand": ["그릇 모양대로 쌓이지만, 돋보기로 보면 알갱이 하나하나의 모양은 그대로예요.", "옮겨 담아도 눈금이 같아요.", "작은 알갱이가 보여요."], "water": ["넓은 그릇에서는 넓게, 좁은 그릇에서는 좁고 높게 그릇 모양을 따라가요.", "어느 눈금 그릇에 옮겨도 눈금이 같아요.", "투명하지만 물 표면이 보여요."], "milk": ["넓은 그릇에서는 넓게 퍼지고, 좁은 그릇에서는 좁고 높게 그릇 모양을 따라가요.", "어느 눈금 그릇에 옮겨도 눈금이 같아요.", "하얀 우유가 담긴 모습이 보여요."], "oil": ["넓은 그릇에서는 얇고 넓게, 좁은 그릇에서는 좁고 높게 그릇 모양을 따라가요.", "어느 눈금 그릇에 옮겨도 눈금이 같아요.", "노란 기름이 담긴 모습이 보여요."], "syringeAir": ["주사기, 비닐봉지, 풍선 어디에 넣어도 그 모양을 따라가요.", "주사기 끝을 막고 피스톤을 누르면 눈금이 줄어들어요. 손을 떼면 다시 늘어나요.", "주사기 안이 비어 보여요."], "helium": ["풍선을 눌러 모양을 바꾸면 안에 든 것도 같은 모양이 돼요. 매듭을 풀면 사방으로 퍼져 나가요.", "풍선을 손으로 누르면 작아지고, 손을 떼면 다시 부풀어요.", "풍선 안이 비어 보이고, 풍선이 공중에 떠올라요."]},
    notInObservation: ["고체", "액체", "기체", "분자", "입자", "압축", "밀도", "정답", "오답"],
    finished: "두 기준으로 나눈 무리를 겹쳐 보면 몇 무리가 생기나요? 각 무리를 무엇이라고 부르면 좋을까요?",
    requiredForbidden: ["모양이 일정한 것은 고체", "고체는 모양이", "액체는 모양이", "액체는 그릇 모양", "기체는 부피", "기체는 눈에 보이지", "모래는 고체", "만지면 기분이 좋은가는 분류 기준이 될 수 없"],
    leaks: ["모양이 일정한 것은 고체예요.", "모양이 일정한 것이 고체예요.", "고체는 모양이 변하지 않아요.", "액체는 그릇 모양을 따라가요.", "액체는 모양이 바뀌어요.", "기체는 부피가 변해요.", "기체는 눈에 보이지 않아요.", "모래는 고체예요.", "모 래 는 고 체 예 요", "물은 액체예요.", "공기는 기체예요.", "만지면 기분이 좋은가는 분류 기준이 될 수 없어요.", "만지면 기분이 좋은지는 분류 기준이 아니에요.", "분자가 움직여요.", "입자가 모여 있어요.", "압축이 돼요.", "밀도가 달라요.", "고체,는 모양이,변하지 않아요."],
    innocents: ["나무 토막을 눈금 그릇에 넣어 보았어요.", "물을 좁은 그릇에 옮기면 물 높이가 높아져요.", "주사기 속 공기는 눈에 보이지 않지만 피스톤을 누르면 눈금이 줄어들어요."],
    wrong: { card: "wood", criterion: "shape", group: "바뀐다", sentence: "나무 토막은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?" },
    icon: {
      keys: MATTER_ICON_KEYS,
      result: R,
      Component: MatterShapeIcon,
      marks: {
    shape: ['ms-shape', 'data-shape', (i) => String(R[i].shape)],
    volume: ['ms-volume', 'data-volume', (i) => String(R[i].volume)],
    see: ['ms-see', 'data-see', (i) => String(R[i].see)],
      },
    },
  });
});
