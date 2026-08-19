# OWASP LLM Top 10 testCTF

이제 각 레벨의 챗봇은 **실제 Google Gemini API**를 호출합니다. 로컬 키워드 매칭이
아니라, 진짜 모델이 취약한 시스템 프롬프트/플러그인을 뚫리는지 판단합니다.

## 1. 설치

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Gemini API 키 발급

https://aistudio.google.com/apikey 에서 무료로 발급받을 수 있습니다.

키를 등록하는 방법은 두 가지입니다 (둘 중 하나만 하면 됩니다):

- **방법 A (앱 내에서 설정)**: 서버 실행 후 브라우저에서 우측 상단 `⚙ API KEY`
  버튼을 눌러 키를 입력합니다. 키는 서버 세션에만 저장되고 브라우저로 다시
  내려가지 않습니다.
- **방법 B (환경변수)**: 프로젝트 루트에 `.env` 파일을 만들고 아래처럼 작성합니다.

  ```
  GEMINI_API_KEY=여기에_키_입력
  # 선택: 사용할 모델 변경 (기본값 gemini-2.5-flash)
  # GEMINI_MODEL=gemini-2.5-flash
  ```

## 3. 실행

```bash
python3 main.py
# 또는
uvicorn main:app --reload
```

브라우저에서 http://localhost:8000 접속.

## 레벨별 동작 방식 요약

| 레벨 | 취약점 | 실제 Gemini에게 무엇을 시키나 |
|----|------|------------------------|
| 1 | Prompt Injection | 비밀번호를 지키라는 system prompt를 프롬프트 인젝션으로 우회 |
| 2 | Insecure Output Handling | 입력을 그대로 반복하도록 지시 → 프런트엔드가 innerHTML로 무검증 렌더링 |
| 3 | Training/RAG Data Poisoning | "지식 베이스"를 무조건 신뢰하라고 지시, 오염된 지식이 정답을 대체하는지 확인 |
| 4 | Model DoS | Gemini를 호출하기 전에 백엔드가 리소스 고갈 패턴을 차단 (API 호출 없음) |
| 5 | Supply Chain | 취약한 내부 플러그인(CVE 포함)을 알고 있게 하고, 직접 물었을 때 발설하는지 확인 |
| 6 | Sensitive Info Disclosure | 내부 설정(API 키, DB URL)을 알고 있게 하고, 디버그 모드 요청에 발설하는지 확인 |
| 7 | Insecure Plugin Design | 검증 없는 `run_system_command` 함수를 실제 tool로 제공, Gemini가 호출하는지 확인 |
| 8 | Excessive Agency | 확인 절차 없는 `delete_production_database` 함수를 실제 tool로 제공 |
| 9 | Overreliance | "모른다"는 말을 금지시키고, 정답을 알고 있는 트리비아에서 확신에 찬 오답을 하는지 확인 |
| 10 | Model Theft | 내부 코드네임/아키텍처를 숨기라고 지시, 프롬프트 인젝션으로 캐내는지 확인 |

각 레벨의 flag는 **모델의 실제 응답을 백엔드가 분석해서** 발급합니다. 즉, 모델이
그럴듯하게 협조적으로 행동했는지를 백엔드 판정 로직이 확인하고, 성공 시
`[VULNERABILITY CONFIRMED] ... Flag: ...` 형태로 응답에 flag를 덧붙입니다.

## 참고

- 대화 기록(멀티턴 메모리)은 구현되어 있지 않습니다. 각 메시지가 독립적인
  API 호출입니다. 필요하면 `client.chats.create()` 기반으로 확장할 수 있습니다.
- Gemini는 실제 모델이므로 같은 입력이라도 매번 다른 응답이 나올 수 있습니다.
  (특히 레벨 9는 temperature를 높게 설정해 일부러 변동성을 키웠습니다.)
- API 사용량에는 Google의 요금이 부과될 수 있습니다 (무료 등급 한도 내에서는 무료).
