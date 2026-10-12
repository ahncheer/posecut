# 그림 콘티 형식 (`rough-storyboard`)

만화 페이지 **그림**을 원고로 옮기기 위한 중간 형식입니다. 그림을 보고 사람이나 AI가 이 JSON을 만들면, 원고 화면의 **그림으로 콘티**에서 읽어 페이지·컷·3D 장면을 만듭니다.

## 흐름

1. 원고 화면 → 왼쪽 **그림으로 콘티** → 만화 페이지 그림 고르기.
2. 콘티 JSON 만들기 (둘 중 하나):
   - **Gemini로 바로 분석**: 컷 편집 → AI → "AI 연결"과 같은 키를 씁니다. 그림 한 장에 약 3~6원이 들고, 키는 이 브라우저에만 저장됩니다.
   - **다른 AI에 물어보기**: "AI에게 줄 요청문 복사" → 그림과 함께 Claude·ChatGPT 등에 보냄 → 받은 JSON을 붙여넣기.
3. 콘티 인물을 작품 인물(VRM 모델)에 짝짓기 → **뒤에 새 페이지로** 또는 **지금 페이지부터 바꾸기**.
4. 페이지·컷 칸이 그림처럼 만들어지고, 각 컷 장면(포즈·방향·샷·말풍선·만화 기호)은 보이지 않는 엔진이 차례로 만듭니다(컷당 약 10초). 그다음 컷 편집에서 다듬습니다.

받은 콘티는 "콘티 JSON 저장"으로 파일로 남겨 두었다가 "콘티 파일 열기"로 다시 쓸 수 있습니다. 예시: [`examples/1화_취향_콘티.json`](examples/1화_취향_콘티.json)

## 형식

```jsonc
{
  "kind": "rough-storyboard",
  "version": 1,
  "characters": [ { "id": "A", "name": "알바생", "desc": "검은 머리, 안경, 후드티" } ],
  "pages": [ {
    "title": "1화. 취향",                       // 페이지 제목 (있으면 위 가운데에)
    "panels": [ {                                // 읽는 순서대로
      "box": [0.035, 0.031, 0.93, 0.226],        // 컷 칸 [x, y, 가로, 세로], 페이지 그림 기준 0~1
      "shot": "bust",                            // full 전신 · bust 바스트 · close 클로즈업 · low 로우앵글 · high 하이앵글
      "chars": [ {
        "id": "A",
        "x": 0.28,                               // 컷 안 가로 위치 0~1
        "depth": "near",                         // near 가까이 · mid · far 멀리
        "facing": "back-right",                  // 아래 표
        "pose": "의자에 앉기",                    // 아래 포즈 이름 중 하나
        "emotion": "surprised",                  // neutral happy angry sad relaxed surprised
        "eyes": "open",                          // open · half · closed
        "look": "other"                          // camera 카메라 · other 상대 · none
      } ],
      "bubbles": [ {
        "kind": "thought",                       // 아래 표
        "text": "…와.\n취향이다.",                // 줄바꿈 \n
        "x": 0.5, "y": 0.32,                     // 말풍선 가운데, 컷 기준 0~1
        "to": "A",                               // 말하는 인물 (꼬리가 그 인물 머리 쪽으로)
        "rot": -10                               // (선택) 기울기, 도
      } ],
      "marks": [ { "kind": "fluster", "x": 0.12, "y": 0.45, "size": 0.05, "rot": -10 } ],
      "props": [ { "type": "chair", "for": "A" }, { "type": "counter", "for": "A" } ],  // 그 인물에 맞춰 놓는 가구
      "background": "편의점 카운터, 밤"            // 메모 (지금은 장면에 쓰지 않음)
    } ]
  } ]
}
```

| 항목 | 쓸 수 있는 값 |
|---|---|
| `facing` (화면 기준 몸 방향) | `camera` 정면 · `left` · `right` · `three-quarter-left` · `three-quarter-right` · `back` 뒷모습 · `back-left` · `back-right` |
| `pose` | 차렷 · 손 흔들기 · 만세 · 걷기 · 고개 숙이기 · 팔짱 · 허리에 손 · 가리키기 · 생각하기 · 전화하기 · 손 내밀기 · 놀람 · 인사 · 기지개 · 뒤돌아보기 · 뛰기 · 의자에 앉기 · 쪼그려 앉기 · 무릎 꿇기 · 한쪽 무릎 · 턱 괴기 · 책상에 엎드리기 · 물건 집기 · 가방 끈 잡기 |
| `bubbles[].kind` | `speech` 대사 · `thought` 생각(구름) · `narration` 네모 설명 · `shout` 외침 · `whisper` 속삭임 · `sfx` 효과음 글자 · `monologue` 독백 · `phone` 전화·기계 · `small` 작은 말풍선(…) |
| `marks[].kind` | `heart` 하트 · `sparkle` 반짝 · `sweat` 땀방울 · `fluster` 당황선 · `anger` 빡침 · `scribble` 엉킨 낙서 · `gloom` 우울 세로줄 · `blush` 홍조 빗금 · `emphasis` 강조선 · `music` 음표 · `sigh` 한숨 · `exclaim` ! · `question` ? |
| `marks[].size` | 컷 가로 대비 크기 (0.02~0.5) |
| `props[].type` | `chair` 의자(앉은 자리에 좌석+등받이) · `counter` 카운터(앞에, 앉아 있으면 팔꿈치 높이) · `desk` 책상 — 상자 도형으로 놓이고 컷 편집에서 고칠 수 있어요 |

## 바꿀 때의 규칙 (코드)

- 읽기·정리: `src/scene/storyboard.ts` `parseStoryboard` — 모르는 값은 빼고, 범위를 넘는 숫자는 잘라 냅니다. ```` ```json ```` 로 감싼 답이나 `$` 설명 항목도 받습니다.
- 컷 칸: `splitFromBoxes` — 칸들을 가로·세로 선으로 차례로 나눕니다(네모 칸만, 사선 칸은 네모로 바뀜).
- 컷 장면: 컷마다 `plan`(엔진용 콘티)이 저장되고, 엔진(`public/engine/cut-test.html`의 `applyPlan`)이 장면이 없을 때 한 번 장면으로 만든 뒤 `plan`은 지워집니다.
- 포즈 이름을 늘리면 `POSE_NAMES`(앱)와 엔진 `PRESETS`를 같이 고칩니다.
