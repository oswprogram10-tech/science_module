import { describe } from 'vitest';
import json from '../../../../../content/units/g6-combustion/manifest.json';
import { PropertyChangeIcon, PROPERTY_ICON_KEYS, PROPERTY_RESULT } from './PropertyChangeIcons';
import { defineBatchCSuite } from './batchCSuite';

/** 변하기 전과 후의 성질 비교하기 활동(g6-combustion 단원의 마지막 활동) 시험. 사양 docs/specs/card-sort-batch-c.md. 시험 묶음은 batchCSuite.ts. */
const R = PROPERTY_RESULT as Record<string, Record<string, unknown>>;

describe('property-change', () => {
  defineBatchCSuite({
    json,
    unit: { id: "g6-combustion", title: "물질의 연소", grade: 6, engine: "matter", standards: ["6과14-01", "6과14-02", "6과14-03"] },
    expIds: ["candle-jar", "combustion-products", "property-change"],
    exp: { id: "property-change", title: "변하기 전과 후의 성질 비교하기", question: "물질이 변할 때 처음 물질의 성질이 달라지는 경우와 그렇지 않은 경우는 어떻게 다를까?", limits: ["화학 변화", "물리 변화", "산화", "분자"] },
    features: [["newprop", "새 성질", "변하기 전과 후 견주어 보기"], ["heat", "열을 가함", "어떻게 했는지 읽기"]],
    criteria: [["newprop", "색·냄새·맛처럼 처음 물질에 없던 성질이 생겼나요?", "newprop", true, [["yes", "생겼다"], ["no", "생기지 않았다"]]], ["heat", "열을 가했나요?", "heat", true, [["yes", "가했다"], ["no", "가하지 않았다"]]], ["fun", "재미있어 보이나요?", undefined, false, [["fun", "재미있어 보인다"], ["notFun", "재미있어 보이지 않는다"]]]] as never,
    table: {"paperCut": ["종이 자르기", "pc-paper-cut", "no", "no"], "paperBurn": ["종이 태우기", "pc-paper-burn", "yes", "yes"], "iceMelt": ["얼음 녹기", "pc-ice-melt", "no", "yes"], "sugarWater": ["설탕을 물에 녹이기", "pc-sugar-water", "no", "no"], "egg": ["달걀 삶기", "pc-egg", "yes", "yes"], "nail": ["철못이 녹슬기", "pc-nail", "yes", "no"], "clay": ["찰흙 모양 바꾸기", "pc-clay", "no", "no"], "milk": ["우유가 상하기", "pc-milk", "yes", "no"], "candleBurn": ["초가 타기", "pc-candle-burn", "yes", "yes"], "candleMelt": ["초가 녹기", "pc-candle-melt", "no", "yes"]},
    obs: {"paperCut": ["자른 조각도 처음 종이처럼 흰색이고 냄새가 같아요. 크기와 모양만 달라졌어요.", "가위로 잘랐어요."], "paperBurn": ["흰 종이가 검은 재가 되고, 타는 냄새가 나요. 재는 부서져요.", "불을 붙였어요."], "iceMelt": ["녹은 물을 다시 얼리면 처음 얼음처럼 투명한 얼음이 돼요. 색과 냄새도 같아요.", "따뜻한 곳에 두었어요."], "sugarWater": ["설탕이 보이지 않게 되지만, 물을 맛보면 설탕처럼 달아요.", "따뜻하게 하지 않고 저어 주었어요."], "egg": ["투명하던 흰자가 하얗고 단단하게 변하고 고소한 냄새가 나요. 식혀도 처음처럼 되돌아가지 않아요.", "끓는 물에 넣어 익혔어요."], "nail": ["반짝이던 회색 못에 붉은 갈색 가루가 생기고, 손으로 문지르면 묻어나요.", "젖은 채로 며칠 두었어요."], "clay": ["주무르고 눌러 다른 모양이 되었지만 색과 냄새는 처음과 같아요.", "손으로 주물렀어요."], "milk": ["처음 우유에 없던 시큼한 냄새가 나고 몽글몽글한 덩어리가 생겼어요.", "따뜻하게 하지 않고 며칠 두었어요."], "candleBurn": ["초가 줄어들고 그을음이 생기며 타는 냄새가 나요. 줄어든 초는 다시 처음 초로 되돌릴 수 없어요.", "심지에 불을 붙였어요."], "candleMelt": ["녹은 촛농이 식으면 다시 처음 초와 같은 색과 냄새의 굳은 덩어리가 돼요.", "초 옆에 따뜻한 것을 대었어요."]},
    notInObservation: ["화학 변화", "물리 변화", "산화", "분자", "정답", "오답"],
    finished: "초가 탈 때와 초가 녹을 때는 어떻게 다를까요? 열을 가한 카드끼리 모두 같은 무리에 들어갔나요?",
    requiredForbidden: ["타면 성질이 달라", "태우면 성질이 달라", "녹는 것은 성질이 그대로", "녹으면 성질이 그대로", "설탕은 녹아도 성질", "열을 가하면 성질이", "재미있어 보이나는 분류 기준이 될 수 없"],
    leaks: ["타면 성질이 달라져요.", "태우면 성질이 달라져요.", "녹는 것은 성질이 그대로예요.", "녹으면 성질이 그대로예요.", "설탕은 녹아도 성질이 그대로예요.", "열을 가하면 성질이 변해요.", "열을 가하면 항상 새로운 물질이 생겨요.", "재미있어 보이는지는 분류 기준이 아니에요.", "화학 변화예요.", "물리 변화예요.", "산화가 일어나요.", "분자가 바뀌어요."],
    innocents: ["종이를 태우면 검은 재가 생겨요.", "녹은 촛농이 식으면 다시 굳어요.", "설탕을 물에 저어 녹이는 모습을 관찰해 볼까요?"],
    wrong: { card: "paperBurn", criterion: "newprop", group: "생기지 않았다", sentence: "종이 태우기는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?" },
    icon: {
      keys: PROPERTY_ICON_KEYS,
      result: R,
      Component: PropertyChangeIcon,
      marks: {
    newprop: ['pc-newprop', 'data-newprop', (i) => String(R[i].newprop)],
    heat: ['pc-heat', 'data-heat', (i) => String(R[i].heat)],
      },
    },
  });
});
