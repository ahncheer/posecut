// 앱 전체가 함께 쓰는 데이터 모양. 저장 파일(JSON)도 이 모양 그대로다.

export type SlotId = 'A' | 'B';
export const SLOTS: SlotId[] = ['A', 'B'];

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
}

export interface Page {
  id: string;
  /** 페이지 높이 (웹툰은 컷을 더하면 늘어난다) */
  height: number;
  cuts: Cut[];
}

export interface Manuscript {
  id: string;
  title: string;
  workId: string;
  format: Format;
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
