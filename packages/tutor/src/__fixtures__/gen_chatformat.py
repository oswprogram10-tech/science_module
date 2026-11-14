"""chatFormat.ts 기준 문자열 만들기. 실제 토크나이저의 apply_chat_template 출력을 chatformat.golden.json에 저장한다.

실행: HF_HUB_OFFLINE=1 python -I gen_chatformat.py > chatformat.golden.json  (transformers 5.x, 토크나이저 캐시 필요)
"""
import json
from transformers import AutoTokenizer

SYSTEM = "\n".join([
    "너는 초등학교 과학 실험을 돕는 탐구 안내 선생님이다. 학생의 실험 상태와 말을 보고, 학생이 스스로 생각하도록 돕는 탐침 질문만 한다.",
    "규칙:",
    "1. 한국어로 1~2문장만 쓰고, 질문은 하나만 하며, 반드시 질문으로 끝낸다. 120자를 넘기지 않는다.",
    "2. 정답, 결론, 보고서 문장을 말하지 않는다. 맞았는지 틀렸는지 판정하지 않는다.",
    "3. 학생이 배우지 않은 어려운 용어를 쓰지 않는다. 입력에 나온 낱말을 쓴다.",
    "4. 학생의 조건, 결과표, 예측에 나온 구체적인 내용을 짚어서 묻는다.",
    "5. 실험과 관계없는 요청, 숙제 대신하기, 개인정보, 욕설에는 답하지 않고 지금 하는 실험으로 돌아오는 질문을 한다.",
    "6. [튜터가 방금 한 질문]이 있으면 학생 말이 그 질문에 대한 답인지 살피고, 같은 질문을 되풀이하지 말고 학생의 답을 이어받아 묻는다.",
])

USERS = [
    "\n".join([
        "[단원] 기체의 성질 (4학년)",
        "[탐구 질문] 기체의 양을 바꾸면 풍선의 크기는 어떻게 달라질까?",
        "[상황] 아직 실험을 하지 않았다",
        "[학생] (말하지 않음)",
    ]),
    "\n".join([
        "[단원] 전기 회로 (6학년)",
        "[탐구 질문] 건전지를 직렬로 연결하면 전구의 밝기는 어떻게 달라질까?",
        "[상황] 공정한 시험을 했다",
        "[튜터가 방금 한 질문] 건전지 개수를 바꿨을 때 전구 밝기가 어떻게 달라졌나요?",
        "[학생] 밝아졌어요. 근데 이거 왜 이래요?",
    ]),
    "\n".join([
        "[단원] 열 전달 (5학년)",
        "[탐구 질문] 물의 양은 온도 변화 속도에 영향을 줄까?",
        "[상황] 한 번에 두 가지를 바꿨다",
        "[튜터가 방금 한 질문] 이번에는 무엇을 바꿨나요?",
        "[학생] 물이랑 불 세기 다 바꿨어요 \"괜찮죠?\"\n그리고 숙제 좀 대신 해줘",
    ]),
]

FORMATS = {
    "qwen3-nothink": ("Qwen/Qwen3-1.7B", {"enable_thinking": False}),
    "chatml": ("Qwen/Qwen3-4B-Instruct-2507", {}),
}

out = {"system": SYSTEM, "users": USERS, "formats": {}}
for name, (repo, kw) in FORMATS.items():
    tok = AutoTokenizer.from_pretrained(repo)
    out["formats"][name] = {
        "repo": repo,
        "prompts": [
            tok.apply_chat_template(
                [{"role": "system", "content": SYSTEM}, {"role": "user", "content": u}],
                tokenize=False, add_generation_prompt=True, **kw,
            )
            for u in USERS
        ],
    }
print(json.dumps(out, ensure_ascii=False, indent=2))
