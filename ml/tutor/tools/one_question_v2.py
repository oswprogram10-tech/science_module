"""모델 견본의 질문을 하나로 줄인다(4차 학습 결과: 질문 두 개짜리 답이 Qwen3 1.7B에서 약 20%).

모델은 직전에 한 질문을 기억하지 못해(입력에 없음), 질문 두 개를 던지면 학생이 둘 다 답해도 이어 받지 못한다.
그래서 모델 답은 질문을 하나만 한다(packages/tutor/src/check.ts의 checkModelResponse, oneQuestion과 같은 규칙).

1. sft.response, pairs.chosen, redteam.reference 가운데 질문이 둘인 문장을 하나로 고친다.
   - 첫 질문이 의문사 없는 권유("…살펴볼까요?")면 "…살펴봐요."로 바꿔 두 번째 질문 앞에 둔다.
   - 아니면 첫 질문만 남긴다.
   - 고친 줄의 notes에 "질문 하나로 고침(v2)"을 덧붙인다. 고치지 않는 줄은 글자 그대로 둔다.
2. 고친 sft 견본으로 DPO 쌍을 만든다(활동마다 2개까지): 좋은 답 = 고친 문장, 나쁜 답 = 고치기 전 문장, 나쁜 이유 two-questions.

    python3 ml/tutor/tools/one_question_v2.py
"""
import glob, json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
NOTE = "질문 하나로 고침(v2)"
PAIR_NOTE = "보강 v2: 질문 두 개"

# ---- check.ts와 같은 문장 나누기 ----
RUN_ON = re.compile(r"([가-힣]요|죠|니다)\s+(?!라고|이라고|하고|하는|라는|란\s)(?=[가-힣0-9‘“'\"(])")
NOUN_YO = re.compile(r"(필요|중요|주요|수요|소요|강요|요요|개요)$")
INTERROGATIVE = re.compile(r"(어떤|어떻게|무엇|무슨|뭐|어느|어디|언제|왜|몇|누가|누구|얼마)")


def mark_run_ons(t):
    def f(m):
        end = m.group(1); word = re.search(r"[가-힣]+$", t[:m.end(1)]).group(0)
        return m.group(0) if re.search(r"(까|나|가)요$", end) or NOUN_YO.search(word) else end + "\n"
    return RUN_ON.sub(f, t)


def split_sentences(t):
    return [s.strip() for s in re.split(r"(?<=[.?!])\s+|\n", mark_run_ons(t.strip())) if s.strip()]


def questions(t):
    return sum(s.endswith("?") for s in split_sentences(t))


def one_question(t):
    s = split_sentences(t)
    if len(s) != 2 or not s[0].endswith("?") or not s[1].endswith("?"):
        return t.strip()
    q1, q2 = s
    if not INTERROGATIVE.search(q1) and q1.endswith("볼까요?"):
        return f"{q1[:-len('볼까요?')]}봐요. {q2}"
    return q1


def add_note(r):
    r["notes"] = f"{r['notes']} · {NOTE}" if r.get("notes") else NOTE


def main():
    data_dir = os.path.join(ROOT, "data")
    scen = {}
    for f in glob.glob(os.path.join(ROOT, "scenarios", "*.jsonl")):
        for l in open(f, encoding="utf-8"):
            if l.strip():
                s = json.loads(l); scen[s["scenarioId"]] = s["state"].get("experimentId") or s["state"].get("kind")
    total = {"고친 줄": 0, "새 쌍": 0}
    for unit_dir in sorted(glob.glob(os.path.join(data_dir, "*"))):
        unit = os.path.basename(unit_dir)
        changed_sft = []
        for kind, field in [("sft", "response"), ("pairs", "chosen"), ("redteam", "reference")]:
            path = os.path.join(unit_dir, f"{kind}.jsonl")
            lines = open(path, encoding="utf-8").read().splitlines(keepends=True)
            out = []
            for line in lines:
                if not line.strip():
                    out.append(line); continue
                r = json.loads(line)
                t = r.get(field)
                if t and questions(t) >= 2 and PAIR_NOTE not in (r.get("notes") or ""):
                    new = one_question(t)
                    assert questions(new) == 1, (r["id"], t, new)
                    if kind == "sft": changed_sft.append((r, t, new))
                    r[field] = new; add_note(r)
                    out.append(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n"); total["고친 줄"] += 1
                else:
                    out.append(line)
            open(path, "w", encoding="utf-8").write("".join(out))
        # DPO 쌍: 활동마다 2개까지
        pairs_path = os.path.join(unit_dir, "pairs.jsonl")
        pairs = [json.loads(l) for l in open(pairs_path, encoding="utf-8") if l.strip()]
        if any(PAIR_NOTE in (p.get("notes") or "") for p in pairs):
            continue
        n = max(int(p["id"].rsplit("-", 1)[1]) for p in pairs)
        per_act = {}
        new_pairs = []
        for r, old, new in changed_sft:
            act = scen.get(r["scenarioId"])
            if per_act.get(act, 0) >= 2: continue
            per_act[act] = per_act.get(act, 0) + 1
            n += 1
            new_pairs.append({"id": f"{unit}-pairs-{n:04d}", "unitId": unit, "scenarioId": r["scenarioId"], "utterance": r["utterance"], "source": "example",
                              "reviewed": False, "author": "EXG", "notes": PAIR_NOTE, "chosen": new, "rejected": old, "rejectedReason": "two-questions"})
        with open(pairs_path, "a", encoding="utf-8") as f:
            for p in new_pairs: f.write(json.dumps(p, ensure_ascii=False, separators=(",", ":")) + "\n")
        total["새 쌍"] += len(new_pairs)
    print(total)


if __name__ == "__main__":
    sys.exit(main())
