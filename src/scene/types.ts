// 앱 전체가 함께 쓰는 데이터 모양. 저장 파일(JSON)도 이 모양 그대로다.

/** 등장인물 구분 글자 (A, B, C …). 작품에는 여러 명, 한 컷에는 지금 엔진 기준 2명까지 */
export type SlotId = string;
/** 한 컷에 함께 나올 수 있는 인물 수 (많을수록 화면이 느려져서 여기까지) */
export const MAX_IN_CUT = 6;
/** 컷에 나올 인물을 아직 안 골랐을 때 기본으로 넣는 인물 수 */
export const DEFAULT_IN_CUT = 2;
/** 컷 안 인물 자리 이름 (고른 순서대로) */
export const CUT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type Gender = '' | 'm' | 'f';
export type AgeGroup = 'adult' | 'teen' | 'child' | 'old';

/** 어떤 VRM을 쓰는지. 파일 자체는 storage(IndexedDB)에 따로 보관한다. */
export type ModelRef =
  | { kind: 'sample' }
  | { kind: 'stored'; id: string; name: string };

export interface Character {
  slot: SlotId;
  name: string;
  role: string;
  gender: Gender;
  age: AgeGroup;
  model: ModelRef | null;
}

/** 작품 = 세계관 + 등장인물. 여러 원고(화)가 한 작품을 공유한다. */
export interface Work {
  id: string;
  title: string;
  /** 작품 설명 (세계관·분위기 등 자유롭게) */
  world: string;
  characters: Character[];
  updatedAt: number;
}

export type Format = 'page' | 'webtoon';
export type TemplateId = 'four' | 'three' | 'bigTwo' | 'one';

export interface FrameStyle {
  /** 컷 사이 여백 (페이지 단위) */
  gutter: number;
  /** 페이지 바깥 여백 */
  margin: number;
  border: { width: number; color: string };
}

/** 페이지 안 컷 위치. 페이지 단위(가로 PAGE_W 기준) */
export interface Rect { x: number; y: number; w: number; h: number }

/**
 * 컷 편집 엔진이 돌려주는 장면 데이터.
 * 지금은 프로토타입 엔진(cut-test) 형식을 그대로 담고, 엔진을 TS로 옮길 때 구체 타입으로 바꾼다.
 */
export interface EngineScene {
  v: 1;
  slots: unknown[];
  camera: { pos: number[]; target: number[]; fov: number };
  shot: string;
  aa: number;
}

export interface Cut {
  id: string;
  rect: Rect;
  scene: EngineScene | null;
  /** 원고 화면에 보여줄 작은 그림 (data URL) */
  thumb: string | null;
  /** 이 컷에 나오는 등장인물(slot). 없으면 모델이 있는 앞의 인물들 */
  cast?: SlotId[];
}

export interface Page {
  id: string;
  /** 이 페이지의 컷 틀 (페이지마다 다를 수 있다). 예전 원고에는 없어서 선택 항목 */
  template?: TemplateId;
  /** 페이지 높이 (웹툰은 컷을 더하면 늘어난다) */
  height: number;
  cuts: Cut[];
}

export interface Manuscript {
  id: string;
  title: string;
  workId: string;
  format: Format;
  /** 첫 페이지의 컷 틀 (새 페이지의 기본값은 바로 앞 페이지 틀) */
  template: TemplateId;
  /** 페이지 가로:세로 (페이지 만화) */
  pageRatio: [number, number];
  style: FrameStyle;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}

export const GENDER_LABEL: Record<Gender, string> = { '': '정하지 않음', m: '남자', f: '여자' };
export const AGE_LABEL: Record<AgeGroup, string> = { adult: '성인', teen: '청소년', child: '아이', old: '노인' };
