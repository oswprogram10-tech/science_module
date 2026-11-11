import { describe } from 'vitest';
import json from '../../../../../content/units/g4-water-state/manifest.json';
import { WaterAroundIcon, WATER_AROUND_ICON_KEYS, WATER_AROUND_RESULT } from './WaterAroundIcons';
import { defineBatchCSuite } from './batchCSuite';

/** 우리 주변의 물 나누기 활동(g4-water-state 단원의 마지막 활동) 시험. 사양 docs/specs/card-sort-batch-c.md. 시험 묶음은 batchCSuite.ts. */
const R = WATER_AROUND_RESULT as Record<string, Record<string, unknown>>;

describe('water-around', () => {
  defineBatchCSuite({
    json,
    unit: { id: "g4-water-state", title: "물의 상태 변화", grade: 4, engine: "matter", standards: ["4과10-01", "4과10-02"] },
    expIds: ["freeze-melt", "water-around"],
    exp: { id: "water-around", title: "우리 주변의 물 나누기", question: "우리 주변의 물은 어떤 상태로 있을까?", limits: ["분자", "입자", "승화", "응결", "기화"] },
    features: [["shape", "모양", "만져 보기"], ["flow", "흐름", "기울여 보기"], ["see", "보임", "가까이 보기"]],
    criteria: [["shape", "모양이 일정한가요?", "shape", true, [["keep", "일정하다"], ["change", "일정하지 않다"]]], ["flow", "기울이면 흘러내리나요?", "flow", true, [["yes", "흘러내린다"], ["no", "흘러내리지 않는다"]]], ["see", "눈에 보이나요?", "see", true, [["yes", "보인다"], ["no", "보이지 않는다"]]], ["look", "보기 좋은가요?", undefined, false, [["nice", "보기 좋다"], ["notNice", "보기 좋지 않다"]]]] as never,
    table: {"icicle": ["고드름", "wa-icicle", "keep", "no", "yes"], "iceCube": ["얼음물 속 얼음", "wa-ice-cup", "keep", "no", "yes"], "snowman": ["눈사람", "wa-snowman", "keep", "no", "yes"], "rain": ["빗물", "wa-rain", "change", "yes", "yes"], "aquarium": ["어항 속 물", "wa-aquarium", "change", "yes", "yes"], "dew": ["이슬방울", "wa-dew", "change", "yes", "yes"], "coldCup": ["차가운 컵 겉의 물방울", "wa-cold-cup", "change", "yes", "yes"], "laundry": ["마르는 빨래에서 날아간 물", "wa-laundry", "change", "no", "no"], "bubble": ["끓는 물 속 거품 안의 물", "wa-bubble", "change", "no", "no"], "steam": ["주전자 주둥이의 하얀 김", "wa-steam", "change", "no", "yes"]},
    obs: {"icicle": ["손으로 잡아도 뾰족한 모양이 그대로예요.", "기울여도 흘러내리지 않아요.", "투명하고 반짝여요."], "iceCube": ["컵 속에서 네모난 덩어리 모양이 그대로예요.", "컵을 기울여도 덩어리는 흘러내리지 않고 물만 흘러요.", "투명한 덩어리가 물 위에 떠 있는 것이 보여요."], "snowman": ["손으로 만져도 동글동글한 모양이 그대로예요.", "기울여도 흘러내리지 않고 그 자리에 서 있어요.", "하얀 덩어리가 보여요."], "rain": ["컵에 받으면 컵 모양을 따라 담기고, 땅에 떨어지면 넓게 퍼져요.", "컵을 기울이면 줄줄 흘러내려요.", "맑은 물방울이 보여요."], "aquarium": ["어항 모양대로 네모나게 담겨 있어요.", "어항을 기울이면 물이 한쪽으로 쏠려 흘러내려요.", "맑은 물 사이로 물고기가 보여요."], "dew": ["풀잎 위에서 동그란 방울이 되었다가, 풀잎을 건드리면 흘러내리며 모양이 바뀌어요.", "풀잎을 기울이면 또르르 흘러내려요.", "작고 투명한 방울이 반짝여요."], "coldCup": ["컵 겉에 맺힌 방울이 서로 합쳐지면서 모양이 바뀌어요.", "컵을 기울이면 큰 방울이 컵 겉을 따라 흘러내려요.", "컵 겉에 작은 방울이 송글송글 보여요."], "laundry": ["빨래에 있던 물이 어디론가 사라져 모양을 알 수 없어요.", "흘러내리는 모습을 볼 수 없어요.", "빨래 둘레를 봐도 아무것도 보이지 않아요."], "bubble": ["거품 안에 든 것은 모양을 알아볼 수 없어요.", "거품 속에서 흘러내리는 모습을 볼 수 없어요.", "거품 안을 들여다보아도 아무것도 보이지 않아요."], "steam": ["하얀 것이 피어오르다가 금방 모양이 바뀌어요.", "흘러내리지 않고 공중에서 흩어져요.", "하얗게 보여요. 차가운 숟가락을 대면 숟가락에 물방울이 맺혀요."]},
    notInObservation: ["고체", "액체", "기체", "수증기", "분자", "입자", "승화", "응결", "기화", "정답", "오답"],
    finished: "세 무리로 나누면 각 무리를 무엇이라고 부르면 좋을까요? 하얀 김은 어느 무리와 더 닮았나요?",
    requiredForbidden: ["얼음은 고체", "물은 액체", "수증기는 기체", "김은 수증기", "김은 물방울", "김은 액체", "수증기는 눈에 보이지", "보기 좋은가는 분류 기준이 될 수 없"],
    leaks: ["얼음은 고체예요.", "물은 액체예요.", "수증기는 기체예요.", "김은 수증기예요.", "하얀 김은 수증기예요.", "김은 물방울이에요.", "김은 액체예요.", "수증기는 눈에 보이지 않아요.", "수 증 기 는 눈 에 보 이 지 않아요", "보기 좋은가는 분류 기준이 될 수 없어요.", "분자가 움직여요.", "입자가 있어요.", "승화예요.", "응결이에요.", "기화예요."],
    innocents: ["얼음은 투명하고 반짝여요.", "하얀 김에 차가운 숟가락을 대면 물방울이 맺혀요.", "빨래에 있던 물이 사라진 곳을 살펴볼까요?"],
    wrong: { card: "icicle", criterion: "shape", group: "일정하지 않다", sentence: "고드름은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?" },
    icon: {
      keys: WATER_AROUND_ICON_KEYS,
      result: R,
      Component: WaterAroundIcon,
      marks: {
    shape: ['wa-shape', 'data-shape', (i) => String(R[i].shape)],
    flow: ['wa-flow', 'data-flow', (i) => String(R[i].flow)],
    see: ['wa-see', 'data-see', (i) => String(R[i].see)],
      },
    },
  });
});
