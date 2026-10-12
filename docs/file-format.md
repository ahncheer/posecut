# 러프 도구 파일 형식 (.json)

러프 도구가 내보내는 JSON 파일 두 가지의 모양과 규칙입니다. 사람이 직접 고치거나, 다른 프로그램·AI가 읽고 만들 때 참고하세요.

| 파일 | 어디서 만드나 | `kind` | 담는 것 |
|---|---|---|---|
| 장면 파일 `*_장면.json` | 컷 편집 → 내보내기 → 장면 파일 | `rough-scene` | 컷 하나의 자세·표정·카메라·말풍선·도형·효과 |
| 원고 파일 `*.rough.json` | 원고 화면 → 내보내기 → 원고 파일 | `rough-manuscript` | 작품 등장인물 + 원고의 모든 페이지·컷·장면 |

둘 다 **JSON 가져오기**(원고 화면·컷 편집)로 다시 넣을 수 있고, 원고 파일은 첫 화면의 "파일 열기"로 원고째 열 수도 있습니다.

## 공통 규칙

1. **설명 항목**: 키 이름이 `$`로 시작하면 설명(주석)입니다. `"$camera": "…"`는 `"camera"` 항목을 설명합니다. 프로그램은 `$` 항목을 모두 무시하므로 지우거나 고쳐도 됩니다. (JSON에는 주석 문법이 없어서 이렇게 씁니다.)
2. **모양**: 들여쓰기 2칸. 키 순서는 항상 같습니다. 짧고 단순한 객체·배열(한 줄 100자 이하)은 한 줄로 씁니다. 예: `"head": { "x": 8, "y": 0, "z": 6 }`
3. **숫자**: 소수 넷째 자리까지.
4. **단위**: 인물·도형 위치와 크기는 **cm**, 카메라 위치만 **m**, 각도는 **도(°)**, 말풍선 위치는 컷 틀 기준 **0~1** 비율.
5. **좌표**: 화면 가운데 바닥이 원점. `x` 오른쪽 +, `y` 위 +, `z` 카메라 쪽 +.
6. **모르는 키는 그대로 둬도 됩니다.** 읽을 때 쓰지 않는 키는 무시합니다. 빠진 키는 기본값으로 채웁니다.
7. 코드 기준: 앱 `src/storage/readableJson.ts`, 엔진 `public/engine/cut-test.html`의 "읽기 좋은 JSON" 부분 (둘은 같은 규칙).

## 장면 파일 (`rough-scene`)

```jsonc
{
  "$about": "…",            // 파일 설명
  "kind": "rough-scene",
  "v": 1,                   // 형식 버전 (지금은 1)
  "who": [ { "letter": "A", "name": "민지" } ],   // 나오는 인물, slots와 같은 순서
  "slots": [ /* 인물마다 하나, 아래 참고 */ ],
  "camera": { "pos": [0, 1.3, 3.2], "target": [0, 1.3, 0], "fov": 28.6, "ff": 24, "roll": 0 },
  "shot": "bust",           // full · bust · close · low · high
  "props": [ /* 도형 */ ],
  "bubbles": [ /* 말풍선 */ ],
  "bubbleShow": true,
  "look": { /* 그림 효과 */ },
  "filter": { /* 색 필터 */ },
  "aa": 2,                  // 앤티앨리어싱 단계
  "bg": null                // 배경 (맨 아래: 그림이면 길어서)
}
```

### slots[] — 인물

| 키 | 뜻 | 값 |
|---|---|---|
| `x`, `z` | 좌우, 앞뒤 위치 | cm, -1000~1000 |
| `y` | 높이(띄우기) | cm, -120~120 |
| `rot` | 몸 방향 | 도, -180~180 (0 = 카메라를 봄) |
| `presence` | 존재감 | 10~100 (낮을수록 흐리게) |
| `look` | 시선 | `"manual"` 직접 · `"camera"` 카메라 · `"other"` 상대 인물 |
| `eyes` | 직접 정한 눈동자 방향 | `{ r: {x,y}, l: {x,y}, link }` |
| `expr` | 표정 | `{ emotion, weight 0~100, mouth { aa, ih, ou, ee, oh: 0~1 }, blink 0~100 }` — emotion: `neutral` `happy` `angry` `sad` `relaxed` `surprised` |
| `hands` | 손가락 | `{ left, right }` 각각 `{ thumb, index, middle, ring, little, spread }` 굽힘 0~100 |
| `pose` | 관절 회전 | 키 = VRM 휴머노이드 뼈 이름, 값 = `{ x, y, z }` 도 |

`pose`에 자주 쓰는 뼈: `hips` `spine` `chest` `neck` `head`, `leftUpperArm` `leftLowerArm` `leftHand`, `rightUpperArm` `rightLowerArm` `rightHand`, `leftUpperLeg` `leftLowerLeg` `leftFoot`, `rightUpperLeg` `rightLowerLeg` `rightFoot`. 없는 뼈는 기본 자세(0)입니다. 관절마다 사람이 움직일 수 있는 범위로 잘립니다.

### camera

- `pos`, `target`: 카메라 위치와 바라보는 점, 미터 `[x, y, z]`.
- `ff`: **컷 틀 기준** 세로 화각(도, 1~90). 작을수록 망원(원근 약함). 읽을 때 이 값을 씁니다.
- `fov`: 저장할 때의 화면 기준 화각(참고용). `ff`가 없는 예전 파일만 이 값으로 계산합니다.
- `roll`: 화면 기울기(도).

### props[] — 도형

`{ id, kind: "box" | "sphere" | "cylinder", x, y, z, w, h, d, rot, tilt, color }` — `x·z` 바닥 위치, `y` 바닥에서 아랫면까지, `w·h·d` 가로·세로·깊이(모두 cm), `rot` 돌리기, `tilt` 앞뒤 기울기(도), `color` `#rrggbb`.

### bubbles[] — 말풍선

`{ id, shape, theme, text, x, y, w, h, tailOn, tail: {x, y}, match, font, size, bold, italic, color, outline, outlineColor, bg, fx }` — 위치·크기·꼬리는 컷 틀 기준 0~1 (왼쪽 위가 0). `shape` 말풍선 모양(oval, round, shout, thought, flash …), `theme` 말풍선 색, `match` = 말풍선 색에 맞춘 글자 스타일 쓰기(true면 font·color 등은 무시), `fx` 글씨 효과 `{ type: none·shadow·glow·echo·outline·hollow·background·splice·glitch·neon·extrude·gradient·sticker, color, color2, amt, dist, angle, blur, alpha }`.

### look — 그림 효과

`bloom { on, int, thr, rad, color }`, `comic { on, color, min, max, angle, size, oil }`, `line { outline, inner, only }`, `cel { hard, steps }`.

### filter — 색 필터

`bright contrast sat temp fade vig grain` (대부분 -100~100), `tint` 색 + `tintAmt` 세기, `shadow` `high` `split` 그림자·밝은 곳 색 나누기, `mono`, `preset` 고른 필터 이름, `amt` 전체 세기.

### bg — 배경

`null`(종이색) · `{ "kind": "fx", "type": "focus" | "speed" | "sparkle" | "gradient" | "tone" | "solid", "color": "#…" }` · `{ "kind": "image", "src": "data:… 또는 주소" }`.

## 원고 파일 (`rough-manuscript`)

```jsonc
{
  "$about": "…",
  "kind": "rough-manuscript",
  "version": 1,
  "work": {
    "id": "…", "title": "작품 제목", "world": "작품 설명",
    "characters": [
      { "slot": "A", "name": "민지", "role": "", "gender": "f", "age": "teen",
        "model": { "kind": "stored", "id": "…", "name": "minji.vrm" } }   // VRM 파일 자체는 들어 있지 않음
    ]
  },
  "manuscript": {
    "id": "…", "title": "1화", "workId": "…",
    "format": "page",                 // page = 페이지 만화, webtoon = 세로 웹툰
    "template": "four",               // 첫 페이지 틀: four · three · bigTwo · one · custom
    "pageRatio": [9, 19],             // 페이지 가로:세로
    "style": { "gutter": 8, "margin": 12, "border": { "width": 2, "color": "#000000" } },
    "pages": [
      {
        "id": "…", "template": "four",
        "title": { "text": "오늘의 간식", "pos": "top-center", "font": "Jua", "size": 17, "color": "#111111" },
        "height": 760,
        "split": { /* 직접 그린 틀의 선 (template이 custom일 때) */ },
        "cuts": [
          { "id": "…", "rect": { "x": 12, "y": 12, "w": 336, "h": 178 },
            "cast": ["A", "B"],       // 이 컷에 나오는 인물(slot), 순서 = 장면 slots 순서
            "scene": { /* 장면 파일과 같은 모양 (kind·$설명 없이) */ } }
        ]
      }
    ]
  },
  "thumbs": { "컷 id": "data:image/jpeg;base64,…" }   // 원고 화면용 작은 그림 — 지워도 됨
}
```

- 위치·크기 단위는 **페이지 가로 360** 기준입니다 (`rect`, `poly`, `style`, 제목 `size`).
- `cuts[].poly`: 네모가 아닌 컷(직접 그린 사선 등)의 꼭짓점 `[[x, y], …]`.
- 페이지 제목 `pos`: `top-left` `top-center` `top-right` `band`(색 띠) `side`(오른쪽 세로) `in-cut`(첫 컷 안).
- `thumbs`를 지우거나 그림이 없는 컷은 원고를 열 때 자동으로 다시 그립니다.
- 예전 형식(설명 없음, 작은 그림이 각 컷의 `thumb` 안에 있음)도 그대로 읽습니다.
