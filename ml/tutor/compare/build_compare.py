"""교사 앱 '튜터 모델 고르기' 화면의 비교 자료를 만든다.

Kaggle 학습 노트북(ml/tutor/kaggle/train_tutor.ipynb)이 낸 모델별 eval-results.jsonl과 summary.json을
내보낸 입력(ml/tutor/out의 sft.jsonl, eval-redteam.jsonl)과 id로 이어 붙인다.
입력은 모두 교사·AI 견본이다(학생 대화 데이터 없음).

    python3 ml/tutor/compare/build_compare.py \
      --model hcx-seed-1.5b=<hcx eval-results.jsonl> --model qwen3-1.7b=<qwen3 eval-results.jsonl> \
      --summary <summary.json> --data ml/tutor/out --out apps/teacher/src/modelCompare.data.json
"""
import argparse, json, os, random, re

# 영어 낱말 섞임: 단위·기호는 허용한다(°C, g, mW, LED, pH 등).
ALLOWED_LATIN = {"C", "g", "mW", "mL", "ml", "cm", "mm", "kg", "km", "m", "L", "N", "S", "s", "W", "V", "A", "pH", "LED", "BTB"}
FLAG = {
    "answer": "정답 누출", "limit": "학년 밖 용어", "echo": "엉뚱한 말 되풀이", "mask-echo": "개인정보 자리표시 되풀이",
    "foreign-script": "한자·일본 글자", "too-long": "너무 김", "no-question": "질문 없음", "judgment": "판정하는 말",
    "personal-info": "연락처", "latin": "영어 낱말 섞임",
}
# packages/tutor/src/dataset.ts의 REDTEAM_CATEGORY_LABEL과 같은 이름
CATEGORY_LABEL = {"ask-answer": "정답을 알려 달라고 함", "ask-report": "보고서를 대신 써 달라고 함", "jailbreak": "규칙을 무시하게 하려 함",
                  "off-topic": "실험과 상관없는 말", "rude": "욕설·무례한 말", "personal-info": "개인정보를 말함"}
DROP_LABELS = {"단원", "상황"}   # 단원은 화면의 단원 이름으로, 상황 키는 나머지 칸으로 드러난다


def latin_mixed(text):
    return bool([w for w in re.findall(r"[A-Za-z]+", text) if w not in ALLOWED_LATIN]) or "�" in text


def flags(row):
    keys = []
    for p in row["problems"]:
        k = p.split(":")[0]
        if k in FLAG and FLAG[k] not in keys: keys.append(FLAG[k])
    if latin_mixed(row["output"]) and FLAG["latin"] not in keys: keys.append(FLAG["latin"])
    return keys


def parse_input(text):
    sections, cur = [], None
    for line in text.split("\n"):
        m = re.match(r"^\[([^\]]+)\]\s?(.*)$", line)
        if m:
            cur = [m.group(1), m.group(2)]; sections.append(cur)
        elif cur is not None:
            cur[1] = (cur[1] + "\n" + line) if cur[1] else line
    student = next((v for k, v in sections if k == "학생"), "")
    return [[k, v.strip()] for k, v in sections if k not in DROP_LABELS and k != "학생"], student


def read_jsonl(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", action="append", required=True, help="모델id=eval-results.jsonl 경로 (두 개)")
    ap.add_argument("--summary", required=True)
    ap.add_argument("--data", default="ml/tutor/out")
    ap.add_argument("--out", required=True)
    ap.add_argument("--red-per-category", type=int, default=3)
    a = ap.parse_args()
    models = dict(m.split("=", 1) for m in a.model)
    assert len(models) == 2, "모델은 두 개를 비교한다"
    summary = json.load(open(a.summary, encoding="utf-8"))
    inputs = {}
    for name in ["sft.jsonl", "eval-redteam.jsonl"]:
        for r in read_jsonl(os.path.join(a.data, name)):
            inputs[r["meta"]["id"]] = (r["meta"]["unitId"], next(m["content"] for m in r["messages"] if m["role"] == "user"))
    evals = {mid: {r["id"]: r for r in read_jsonl(p)} for mid, p in models.items()}
    ids = [i for i in evals[next(iter(models))] if all(i in e for e in evals.values())]

    stats = {}
    for mid, rows in evals.items():
        s = summary[mid]
        stats[mid] = {k: s[k] for k in ["val_pass", "red_pass", "answer", "limit", "echo", "personal", "foreign"]}
        stats[mid]["latin"] = sum(latin_mixed(r["output"]) for r in rows.values())
        stats[mid]["total"] = len(rows)
        stats[mid]["n_val"] = sum(r["kind"] == "val" for r in rows.values())
        stats[mid]["n_red"] = sum(r["kind"] == "redteam" for r in rows.values())

    # 검증 문항은 모두, 레드팀은 두 모델 중 하나라도 문제가 있는 문항 + 유형마다 문제없는 문항 몇 개.
    rnd = random.Random(42)
    first = evals[next(iter(models))]
    val = [i for i in ids if first[i]["kind"] == "val"]
    red = [i for i in ids if first[i]["kind"] == "redteam"]
    flagged = [i for i in red if any(flags(e[i]) for e in evals.values())]
    by_cat = {}
    for i in red:
        if i not in flagged: by_cat.setdefault(first[i]["category"], []).append(i)
    clean = [i for c in sorted(by_cat) for i in rnd.sample(by_cat[c], min(a.red_per_category, len(by_cat[c])))]

    samples = []
    for i in val + flagged + clean:
        unit_id, text = inputs[i]
        lines, student = parse_input(text)
        item = {"id": i, "kind": first[i]["kind"], "unitId": unit_id, "lines": lines, "student": student,
                "answers": {mid: {"text": e[i]["output"], "flags": flags(e[i])} for mid, e in evals.items()}}
        if first[i]["kind"] == "val": item["reference"] = first[i]["reference"]
        else: item["category"] = CATEGORY_LABEL[first[i]["category"]]
        samples.append(item)
    out = {"source": "Kaggle 학습 노트북 평가 결과(검증 문항 전부, 레드팀 일부). 입력은 교사·AI 견본이다.",
           "models": list(models), "stats": stats, "samples": samples}
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"samples {len(samples)} (val {len(val)}, red flagged {len(flagged)}, red clean {len(clean)}) | {os.path.getsize(a.out) // 1024} KB")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
