// 러프 도구 파일(.json)을 사람이 읽고 고치기 쉽게 쓰는 규칙.
// 엔진(public/engine/cut-test.html)의 장면 파일 저장도 같은 규칙을 쓴다 → 바꿀 때 엔진 쪽 "읽기 좋은 JSON" 부분도 같이 고칠 것.
// 자세한 형식 설명: docs/file-format.md
//
// 규칙
//  1. 들여쓰기 2칸. 키 순서는 항상 같다 (위치 → 모습 → 세부 순).
//  2. 짧은 객체·배열(한 줄 100자 이하이고 안쪽이 단순한 것)은 한 줄로 쓴다.  예) "head": { "x": 8, "y": 0, "z": 6 }
//  3. 숫자는 소수 넷째 자리까지만.
//  4. 키 이름이 "$"로 시작하면 설명(주석)이다. 바로 뒤에 오는 같은 이름의 항목을 설명한다.
//     예) "$camera": "카메라 …", "camera": { … }   — 프로그램은 "$" 항목을 읽지 않으므로 지워도 된다.
//  5. 원고 파일의 작은 그림(JPEG data URL)은 길어서 맨 아래 "thumbs"에 컷 id별로 모아 둔다 (지워도 됨, 열면 다시 그림).
import type { EngineScene, Manuscript, Work } from '../scene/types';

const roundNum = (n: number) => { const r = Math.round(n * 1e4) / 1e4; return Object.is(r, -0) ? 0 : r; };

/** 객체 안이 단순한가 (한 줄에 써도 읽기 쉬운가): 값이 기본값이거나, 기본값만 든 작은 배열·객체 */
function isSimple(v: unknown, depth = 0): boolean {
  if (v === null || typeof v !== 'object') return true;
  if (depth >= 2) return false;
  return Object.values(v as object).every(x => isSimple(x, depth + 1));
}
function oneLine(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(typeof v === 'number' ? roundNum(v) : v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(oneLine).join(', ')}]`;
  const e = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${oneLine(x)}`).join(', ')} }` : '{}';
}

/** 규칙 1~3대로 JSON 글자를 만든다 */
export function prettyJSON(value: unknown, width = 100): string {
  const out = (v: unknown, ind: string, keyLen: number): string => {
    if (v === null || typeof v !== 'object') return oneLine(v);
    const flat = oneLine(v);
    if (isSimple(v) && ind.length + keyLen + flat.length <= width) return flat;
    const next = ind + '  ';
    if (Array.isArray(v)) return v.length ? `[\n${v.map(x => next + out(x, next, 0)).join(',\n')}\n${ind}]` : '[]';
    const e = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    if (!e.length) return '{}';
    return `{\n${e.map(([k, x]) => `${next}${JSON.stringify(k)}: ${out(x, next, k.length + 4)}`).join(',\n')}\n${ind}}`;
  };
  return out(value, '', 0) + '\n';
}

/** "$"로 시작하는 설명 항목을 모두 뺀다 (읽을 때) */
export function stripNotes<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripNotes) as T;
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !k.startsWith('$')).map(([k, x]) => [k, stripNotes(x)])) as T;
  }
  return v;
}

/** 정해진 순서로 키를 다시 놓는다 (목록에 없는 키는 뒤에 그대로) */
function ordered<T extends object>(o: T, keys: string[]): T {
  const src = o as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  keys.forEach(k => { if (k in src) out[k] = src[k]; });
  Object.keys(src).forEach(k => { if (!(k in out)) out[k] = src[k]; });
  return out as T;
}

const SLOT_KEYS = ['x', 'y', 'z', 'rot', 'presence', 'look', 'eyes', 'expr', 'hands', 'pose'];
const SCENE_KEYS = ['v', 'who', 'slots', 'camera', 'shot', 'props', 'bubbles', 'bubbleShow', 'look', 'filter', 'aa', 'bg'];

/** 장면을 읽기 좋은 순서로 (설명 없이) */
export function orderScene(scene: EngineScene): EngineScene {
  const s = scene as EngineScene & Record<string, unknown>;
  return ordered({ ...s, slots: s.slots.map(x => (x && typeof x === 'object' ? ordered(x as object, SLOT_KEYS) : x)) }, SCENE_KEYS);
}

/** 장면 각 항목 설명 (장면 파일 · 원고 파일 공통) */
export const SCENE_NOTES: Record<string, string> = {
  $who: '이 장면에 나오는 인물. slots와 같은 순서 (letter = 컷 안 자리 A·B·C…, name = 인물 이름).',
  $slots: '인물마다 하나 (who와 같은 순서). x 좌우·z 앞뒤·y 높이 = cm (화면 가운데 바닥이 0, x는 오른쪽 +, z는 카메라 쪽 +). rot = 몸 방향(도, 0 = 카메라를 봄). presence = 존재감 10~100. look = 시선 ("manual" 직접, "camera" 카메라, "other" 상대). eyes = 직접 정한 눈동자 방향(r 오른눈·l 왼눈, link = 두 눈 같이). expr = 표정 { emotion: neutral·happy·angry·sad·relaxed·surprised, weight 세기 0~100, mouth 입모양 aa·ih·ou·ee·oh 0~1, blink 눈 감기 0~100 }. hands = 손가락 굽힘 0~100 (thumb·index·middle·ring·little, spread 벌리기). pose = 관절 회전(도): 키는 VRM 휴머노이드 뼈 이름(head, neck, chest, spine, hips, leftUpperArm, leftLowerArm, leftHand, rightUpperArm …, leftUpperLeg, leftLowerLeg, leftFoot …), 값 { x, y, z }.',
  $camera: '카메라. pos = 카메라 위치, target = 바라보는 점 (둘 다 미터, [x, y, z]). ff = 컷 틀 기준 세로 화각(도, 1~90 — 작을수록 망원). fov = 저장할 때 화면 기준 화각(참고용, 읽을 때는 ff를 씀). roll = 화면 기울기(도).',
  $shot: '마지막으로 고른 샷: full 전신 · bust 바스트 · close 클로즈업 · low 로우앵글 · high 하이앵글.',
  $props: '도형(소품). kind = box 네모·sphere 공·cylinder 원기둥. x·z = 바닥 위치(cm), y = 바닥에서 아랫면까지 높이(cm), w·h·d = 가로·세로·깊이(cm), rot = 돌리기(도), tilt = 앞뒤 기울기(도), color = 색.',
  $bubbles: '말풍선. x·y·w·h = 컷 틀 안 위치·크기 (0~1, 왼쪽 위가 0). tail = 꼬리 끝 위치(0~1), tailOn = 꼬리 보이기. shape = 모양, theme = 말풍선 색, fx = 글씨 효과 { type, color, amt … }. size = 글자 크기, match = 말풍선 색에 맞춘 글자 스타일 쓰기.',
  $look: '그림 효과. bloom 빛 번짐, comic 만화(흑백 톤: min 검정 기준·max 흰색 기준·size 톤 크기·angle 톤 각도·color 색 남기기·oil 뭉개기), line 선화(outline 외곽선 %, inner 안쪽 선, only 선만 보기), cel 셀 셰이딩(hard 명암 경계, steps 명암 단계).',
  $filter: '색 필터. bright 밝기·contrast 대비·sat 채도·temp 색온도·fade 바램·vig 비네팅·grain 입자 (대부분 -100~100), tint·tintAmt 색 덧입히기, shadow·high·split 그림자·밝은 곳 색 나누기, preset = 고른 필터 이름.',
  $aa: '앤티앨리어싱 단계 (저장 그림을 몇 배로 촘촘히 그릴지).',
  $bg: '배경. null = 종이색. { kind: "fx", type: focus 집중선·speed 속도선·sparkle 반짝이·gradient·tone 스크린톤·solid 단색, color } 또는 { kind: "image", src: 그림 주소 }.',
};

/** 장면 파일 하나 (엔진의 장면 내보내기와 같은 모양) */
export function annotateScene(scene: EngineScene): Record<string, unknown> {
  const s = orderScene(scene) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {
    $about: '러프 도구 장면 파일 (컷 하나의 자세·표정·카메라·말풍선·효과). "$"로 시작하는 항목은 설명이라 지워도 되고, 바로 뒤 같은 이름 항목을 설명해요. 단위: 위치 cm(카메라만 m), 각도 도(°). 형식 전체 설명: docs/file-format.md',
    kind: 'rough-scene',
  };
  Object.entries(s).forEach(([k, v]) => { if (SCENE_NOTES[`$${k}`]) out[`$${k}`] = SCENE_NOTES[`$${k}`]; out[k] = v; });
  return out;
}

const CUT_KEYS = ['id', 'rect', 'poly', 'cast', 'scene'];
const PAGE_KEYS = ['id', 'template', 'title', 'height', 'split', 'cuts'];
const MS_KEYS = ['id', 'title', 'workId', 'format', 'template', 'pageRatio', 'style', 'createdAt', 'updatedAt', 'pages'];

/** 원고 파일 (작품 + 원고). 작은 그림은 맨 아래 thumbs로 */
export function annotateManuscriptFile(work: Work, m: Manuscript): Record<string, unknown> {
  const thumbs: Record<string, string> = {};
  const pages = m.pages.map(p => ordered({
    ...p,
    cuts: p.cuts.map(c => {
      if (c.thumb) thumbs[c.id] = c.thumb;
      const rest: Record<string, unknown> = { ...c };
      delete rest.thumb;
      if (c.scene) rest.scene = orderScene(c.scene);
      return ordered(rest, CUT_KEYS);
    }),
  }, PAGE_KEYS));
  return {
    $about: '러프 도구 원고 파일 (작품 등장인물 + 원고 페이지·컷·장면). "$"로 시작하는 항목은 설명이라 지워도 되고, 바로 뒤 같은 이름 항목을 설명해요. VRM 모델 파일은 너무 커서 넣지 않고 이름만 적어요. 형식 전체 설명: docs/file-format.md',
    kind: 'rough-manuscript',
    version: 1,
    $work: '작품. characters = 등장인물 { slot: 인물 구분 글자(A, B …), name, role, gender(m·f·""), age(adult·teen·child·old), model: 모델 { kind: "sample" | "stored", name: 파일 이름 } }.',
    work: ordered({ ...work, characters: work.characters.map(c => ordered(c, ['slot', 'name', 'role', 'gender', 'age', 'model'])) }, ['id', 'title', 'world', 'characters', 'updatedAt']),
    $manuscript: '원고 한 화. format = page(페이지 만화)·webtoon. pageRatio = 페이지 가로:세로. style = 컷 틀 { gutter 컷 사이, margin 바깥 여백, border 테두리 } (단위: 페이지 가로 360 기준). pages[].cuts[] = 컷: rect 위치·크기, poly 네모가 아닌 컷의 꼭짓점, cast 이 컷에 나오는 인물(slot), scene 장면(아래 "$scene" 참고). pages[].title = 페이지 제목, split = 직접 그린 틀의 선.',
    $scene: '(manuscript 안 각 컷의 scene 설명) scene은 장면 파일과 같은 모양이에요. 항목 설명: ' + Object.entries(SCENE_NOTES).map(([k, v]) => `${k.slice(1)} — ${v}`).join(' / '),
    manuscript: ordered({ ...m, pages }, MS_KEYS),
    $thumbs: '원고 화면용 작은 그림 (컷 id → JPEG data URL). 지워도 되고, 지우면 원고를 열 때 다시 그려져요.',
    thumbs,
  };
}
