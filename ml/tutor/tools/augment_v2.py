"""튜터 예시 모델 3차 학습 결과로 드러난 약점을 줄이는 견본을 덧붙인다(사양 docs/specs/tutor-examples-v1.md의 EXG 규칙).

1. 실험과 상관없는 말(off-topic): 활동마다 SFT 2개, DPO 쌍 2개.
   - 학생 말은 평가용 레드팀(redteam.jsonl)의 주제(게임·급식·소풍·축구 등)와 겹치지 않는 새 주제로 쓴다.
   - 좋은 답은 같은 시나리오에서 학생이 말하지 않았을 때(utterance "")의 견본 답이다. 엉뚱한 말을 되풀이하지 않고 실험으로 돌아온다.
   - 나쁜 답은 그 주제를 되풀이하며 맞장구친다(rejectedReason off-topic).
2. 마침표 없이 이어 붙인 문장(too-long): 활동마다 DPO 쌍 1개.
   - 좋은 답 "A했어요. B할까요?"를 "A했어요 B할까요? C할까요?"로 바꾼 것이 나쁜 답이다. 3차 학습에서 하이퍼클로바 3B가 보인 실패 모양
     (세 문장을 마침표 없이 붙여 두 문장처럼 보이게 함) 그대로다. 문장 경계 검사(check.ts RUN_ON)로 세 문장이라 too-long에 걸린다.

    python3 ml/tutor/tools/augment_v2.py             # 덧붙인다(이미 덧붙였으면 아무것도 하지 않는다)
    python3 ml/tutor/tools/augment_v2.py --replace   # 전에 덧붙인 줄(notes "보강 v2")을 지우고 다시 만든다
"""
import glob, json, os, random, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
TAG = "보강 v2"   # notes에 남겨 두 번 덧붙이지 않게 한다

# 평가 레드팀 주제와 겹치지 않는 학생 말과, 나쁜 답이 되풀이할 낱말
OFF_TOPIC = [
    # 평가 레드팀은 "○○ 얘기해요/얘기하자", "너 ○○ 좋아해?" 틀이 많다. 여기서는 그 틀을 피하고 자기 일을 말하는 문장으로 쓴다.
    ("햄스터가 해바라기씨를 볼에 잔뜩 넣었어요.", "햄스터"),
    ("어제 먹은 떡볶이가 너무 매웠어요.", "떡볶이"),
    ("주말에 할머니 댁에서 송편을 빚었어요.", "송편"),
    ("줄넘기 이단 뛰기를 열 번이나 성공했어요!", "줄넘기"),
    ("새 운동화를 신으니까 발이 엄청 가벼워요.", "운동화"),
    ("피아노 학원 끝나고 바로 여기 왔어요.", "피아노 학원"),
    ("고양이가 상자에 쏙 들어가는 걸 봤어요.", "고양이"),
    ("딱지치기에서 오늘 다섯 장 땄어요.", "딱지치기"),
    ("태권도 승급 심사에서 노란 띠를 받았어요.", "태권도"),
    ("자전거 보조 바퀴를 드디어 뗐어요!", "자전거"),
    ("종이접기로 학을 백 마리 접을 거예요.", "종이접기"),
    ("캠핑 가서 마시멜로를 구워 먹었어요.", "캠핑"),
]
ECHO_TEMPLATES = ["{t} 이야기 재미있네요. {q}", "{t} 얘기를 했군요. {q}", "{t} 생각이 났군요. {q}", "{t}도 좋지만 같이 해 봐요. {q}"]
EXTRA_QUESTIONS = ["어떤 칸을 먼저 볼까요?", "무엇이 달라졌나요?", "다음에는 무엇을 바꿔 볼까요?", "결과표에서 무엇을 찾아볼까요?"]
RUN_ON_END = re.compile(r"(어요|아요|해요|예요|에요|네요|군요|래요|대요|세요|데요|죠|니다)\.$")


def read(path):
    return [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()] if os.path.exists(path) else []


def sentences(t):
    return [s for s in re.split(r"(?<=[.?!])\s+", t.strip()) if s]


def next_id(rows, unit, kind):
    nums = [int(r["id"].rsplit("-", 1)[1]) for r in rows]
    n = max(nums, default=0)
    while True:
        n += 1
        yield f"{unit}-{kind}-{n:04d}"


def main():
    data_dir = os.path.join(ROOT, "data")
    scen = {}
    for f in glob.glob(os.path.join(ROOT, "scenarios", "*.jsonl")):
        for s in read(f):
            scen[s["scenarioId"]] = s["state"].get("experimentId") or s["state"].get("kind")
    eval_words = " ".join(r["utterance"] for f in glob.glob(os.path.join(data_dir, "*", "redteam.jsonl")) for r in read(f))
    for utt, topic in OFF_TOPIC:
        assert topic not in eval_words, f"평가 레드팀과 겹치는 주제: {topic}"

    rnd = random.Random(20261114)
    added = {"sft": 0, "pairs": 0}
    for unit_dir in sorted(glob.glob(os.path.join(data_dir, "*"))):
        unit = os.path.basename(unit_dir)
        sft_path, pairs_path = os.path.join(unit_dir, "sft.jsonl"), os.path.join(unit_dir, "pairs.jsonl")
        sft, pairs = read(sft_path), read(pairs_path)
        tagged = lambda r: TAG in (r.get("notes") or "")
        if any(tagged(r) for r in sft + pairs):
            if "--replace" not in sys.argv:
                print(unit, "이미 보강함"); continue
            sft, pairs = [r for r in sft if not tagged(r)], [r for r in pairs if not tagged(r)]
            for path in [sft_path, pairs_path]:   # 기존 줄은 글자 그대로 둔다(다시 쓰지 않는다)
                keep = [l for l in open(path, encoding="utf-8").read().splitlines(keepends=True) if not (l.strip() and tagged(json.loads(l)))]
                open(path, "w", encoding="utf-8").write("".join(keep))
        sft_ids, pair_ids = next_id(sft, unit, "sft"), next_id(pairs, unit, "pairs")
        new_sft, new_pairs = [], []
        by_act = {}
        for r in sft:
            by_act.setdefault(scen.get(r["scenarioId"]), []).append(r)
        for act, rows in sorted(by_act.items(), key=lambda x: str(x[0])):
            silent = [r for r in rows if r["utterance"] == "" and len(sentences(r["response"])) == 2 and r["response"].endswith("?")]
            rnd.shuffle(silent)
            topics = rnd.sample(OFF_TOPIC, 4)
            # 1) 엉뚱한 말: SFT 2개, DPO 2개(서로 다른 시나리오를 먼저 쓴다)
            for k, (utt, topic) in enumerate(topics):
                if not silent: break
                base = silent[k % len(silent)]
                common = {"unitId": unit, "scenarioId": base["scenarioId"], "utterance": utt, "source": "example", "reviewed": False, "author": "EXG", "notes": f"{TAG}: 엉뚱한 말"}
                if k < 2:
                    new_sft.append({"id": next(sft_ids), **common, "response": base["response"]})
                else:
                    q = sentences(base["response"])[-1]
                    rejected = rnd.choice(ECHO_TEMPLATES).format(t=topic, q=q)
                    new_pairs.append({"id": next(pair_ids), **common, "chosen": base["response"], "rejected": rejected, "rejectedReason": "off-topic"})
            # 2) 마침표 없이 이어 붙인 문장: DPO 1개
            cands = [r for r in rows if len(sentences(r["response"])) == 2 and RUN_ON_END.search(sentences(r["response"])[0]) and r["response"].endswith("?")]
            if cands:
                base = rnd.choice(cands)
                s1, s2 = sentences(base["response"])
                extra = rnd.choice([q for q in EXTRA_QUESTIONS if q != s2])
                new_pairs.append({"id": next(pair_ids), "unitId": unit, "scenarioId": base["scenarioId"], "utterance": base["utterance"], "source": "example",
                                  "reviewed": False, "author": "EXG", "notes": f"{TAG}: 마침표 없이 이어 붙인 문장",
                                  "chosen": base["response"], "rejected": f"{s1[:-1]} {s2} {extra}", "rejectedReason": "too-long"})
        with open(sft_path, "a", encoding="utf-8") as f:
            for r in new_sft: f.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
        with open(pairs_path, "a", encoding="utf-8") as f:
            for r in new_pairs: f.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
        added["sft"] += len(new_sft); added["pairs"] += len(new_pairs)
        print(unit, "sft", len(new_sft), "pairs", len(new_pairs))
    print("합계", added)


if __name__ == "__main__":
    sys.exit(main())
