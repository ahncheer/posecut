// JSON에서 포즈 가져오기: 장면 파일(컷 하나) 또는 원고 파일(.rough.json)을 읽어
// 등장인물을 지금 작품의 인물에 짝지은 뒤, 컷·페이지·원고 전체에 자세를 옮긴다.
// 그림 콘티(rough-storyboard)도 받는다: 컷마다 콘티(plan)를 넣고, 장면은 엔진이 콘티대로 만든다.
import type { Character, EngineScene, Manuscript, SlotId } from './types';
import { MAX_IN_CUT } from './types';
import { castForCut, updateCut } from './manuscript';
import { stripNotes } from '../storage/readableJson';
import { looseJSON, panelToCut, parseStoryboard, type SbPanel } from './storyboard';

/** 가져온 파일 속 인물 한 명 */
export interface SrcPerson { key: string; label: string; model: string | null }
/** 가져온 파일 속 컷 하나: scene.slots[i] = people[i]의 자세 */
export interface SrcCut { scene: EngineScene | null; people: string[]; /** 그림 콘티의 컷 (scene 대신) */ panel?: SbPanel }
const hasPose = (c: SrcCut) => !!(c.scene || c.panel);
export interface PoseSource {
  kind: 'scene' | 'manuscript' | 'storyboard';
  title: string;
  people: SrcPerson[];
  /** 페이지 → 컷 (장면 파일이면 [[컷 하나]]) */
  pages: SrcCut[][];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isScene = (v: unknown): v is EngineScene => isObj(v) && v.v === 1 && Array.isArray(v.slots) && isObj(v.camera);

/** 파일 내용 → 가져올 거리. 러프 도구 파일이 아니면 오류 */
export function parsePoseSource(text: string, fileName = ''): PoseSource {
  let data: unknown;
  try { data = stripNotes(JSON.parse(looseJSON(text))); } catch { throw new Error('JSON 파일을 읽지 못했어요.'); }
  if (isObj(data) && (data.kind === 'rough-storyboard' || (Array.isArray(data.pages) && data.pages.some(p => isObj(p) && Array.isArray(p.panels))) || Array.isArray(data.panels))) {
    const sb = parseStoryboard(text);
    return {
      kind: 'storyboard', title: fileName || '그림 콘티',
      people: sb.characters.map(c => ({ key: c.id, label: c.name, model: c.desc ?? null })),
      pages: sb.pages.map(p => p.panels.map(panel => ({ scene: null, people: (panel.chars ?? []).map(c => c.id), panel }))),
    };
  }
  if (isScene(data)) {
    const who = Array.isArray((data as { who?: unknown }).who) ? (data as unknown as { who: { name?: unknown; letter?: unknown }[] }).who : [];
    const people = data.slots.map((_, i) => {
      const w = who[i];
      const name = w && typeof w.name === 'string' && w.name.trim() ? w.name.trim() : null;
      const letter = w && typeof w.letter === 'string' ? w.letter : String.fromCharCode(65 + i);
      return { key: `p${i}`, label: name ?? `인물 ${letter}`, model: null };
    });
    return { kind: 'scene', title: fileName || '장면 파일', people, pages: [[{ scene: data, people: people.map(p => p.key) }]] };
  }
  if (isObj(data) && data.kind === 'rough-manuscript' && isObj(data.work) && isObj(data.manuscript)) {
    const characters = (Array.isArray(data.work.characters) ? data.work.characters : []).filter((c): c is Character => isObj(c) && typeof c.slot === 'string');
    const ms = data.manuscript as unknown as Manuscript;
    if (!Array.isArray(ms.pages)) throw new Error('원고 파일에 페이지가 없어요.');
    const used = new Set<string>();
    const pages: SrcCut[][] = ms.pages.map(p => (Array.isArray(p.cuts) ? p.cuts : []).map(c => {
      if (!isScene(c.scene)) return { scene: null, people: [] };
      const cast = castForCut(characters, Array.isArray(c.cast) ? c.cast.filter(x => typeof x === 'string') : undefined).map(ch => ch.slot);
      cast.forEach(s => used.add(s));
      return { scene: c.scene, people: cast.slice(0, c.scene.slots.length) };
    }));
    const people = characters.filter(c => used.has(c.slot)).map(c => ({
      key: c.slot, label: c.name?.trim() || `인물 ${c.slot}`,
      model: c.model ? (c.model.kind === 'sample' ? '기본 모델' : c.model.name) : null,
    }));
    const title = [isObj(data.work) && typeof data.work.title === 'string' ? data.work.title : '', typeof ms.title === 'string' ? ms.title : ''].filter(Boolean).join(' · ');
    return { kind: 'manuscript', title: title || fileName || '원고 파일', people, pages };
  }
  throw new Error('러프 도구에서 저장한 장면(.json)·원고(.rough.json)·그림 콘티(.json) 파일이 아니에요.');
}

export const sceneCount = (src: PoseSource) => src.pages.reduce((n, p) => n + p.filter(hasPose).length, 0);

/** 처음 짝: 이름이 같은 인물 → 남은 인물은 순서대로 (모델이 있는 인물만) */
export function defaultMapping(src: PoseSource, characters: Character[]): Record<string, SlotId | ''> {
  const pool = characters.filter(c => c.model);
  const taken = new Set<string>();
  const out: Record<string, SlotId | ''> = {};
  const norm = (s: string) => s.trim().toLowerCase();
  src.people.forEach(p => {
    const hit = pool.find(c => !taken.has(c.slot) && c.name && norm(c.name) === norm(p.label));
    if (hit) { out[p.key] = hit.slot; taken.add(hit.slot); }
  });
  src.people.forEach(p => {
    if (out[p.key] !== undefined) return;
    const next = pool.find(c => !taken.has(c.slot));
    out[p.key] = next ? next.slot : '';
    if (next) taken.add(next.slot);
  });
  return out;
}

/** 같은 인물에 두 명 이상 짝지었으면 그 인물 slot 목록 */
export function duplicateTargets(mapping: Record<string, SlotId | ''>): SlotId[] {
  const seen = new Map<string, number>();
  Object.values(mapping).forEach(v => { if (v) seen.set(v, (seen.get(v) ?? 0) + 1); });
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
}

/** 가져온 컷 하나 → 지금 작품 기준 장면·출연 인물 (짝이 없는 인물은 뺌) */
export function remapCut(src: SrcCut, mapping: Record<string, SlotId | ''>): { scene: EngineScene; cast: SlotId[] } | null {
  if (!src.scene) return null;
  const picks: { i: number; slot: SlotId }[] = [];
  src.people.forEach((k, i) => {
    const t = mapping[k];
    if (t && !picks.some(p => p.slot === t) && src.scene!.slots[i]) picks.push({ i, slot: t });
  });
  const kept = picks.slice(0, MAX_IN_CUT);
  if (!kept.length) return null;
  const scene = JSON.parse(JSON.stringify(src.scene)) as EngineScene & { who?: unknown };
  scene.slots = kept.map(p => scene.slots[p.i]);
  delete scene.who;
  return { scene, cast: kept.map(p => p.slot) };
}

export type ImportScope = 'cut' | 'page' | 'all';
export interface ImportPlan {
  scope: ImportScope;
  /** 이 컷 (scope=cut) */
  targetCutId?: string;
  /** 이 페이지 (scope=page) */
  targetPage?: number;
  /** 가져올 컷 [페이지, 컷] (scope=cut) */
  srcCut?: [number, number];
  /** 가져올 페이지 (scope=page) */
  srcPage?: number;
  /** 장면이 이미 있는 컷은 건너뛰기 */
  skipFilled: boolean;
}
export interface ImportPair { cutId: string; label: string; src: SrcCut }

/** 어느 컷에 어느 장면을 넣을지 (위치 순서대로 짝) */
export function planPairs(m: Manuscript, src: PoseSource, plan: ImportPlan): ImportPair[] {
  const pairs: ImportPair[] = [];
  const label = (pi: number, ci: number) => `${pi + 1}페이지 컷 ${ci + 1}`;
  if (plan.scope === 'cut') {
    const [sp, sc] = plan.srcCut ?? [0, 0];
    const s = src.pages[sp]?.[sc];
    m.pages.forEach((p, pi) => p.cuts.forEach((c, ci) => { if (c.id === plan.targetCutId && s) pairs.push({ cutId: c.id, label: label(pi, ci), src: s }); }));
  } else if (plan.scope === 'page') {
    const tp = plan.targetPage ?? 0, sp = plan.srcPage ?? 0;
    m.pages[tp]?.cuts.forEach((c, ci) => { const s = src.pages[sp]?.[ci]; if (s) pairs.push({ cutId: c.id, label: label(tp, ci), src: s }); });
  } else {
    m.pages.forEach((p, pi) => p.cuts.forEach((c, ci) => { const s = src.pages[pi]?.[ci]; if (s) pairs.push({ cutId: c.id, label: label(pi, ci), src: s }); }));
  }
  return pairs.filter(p => hasPose(p.src));
}

export interface ImportSummary { applied: number; replaced: number; skipped: number; empty: number }

/** 실제로 넣기. 장면 그림(thumb)은 컷을 열면 새로 그려지도록 비운다 */
export function applyImport(m: Manuscript, pairs: ImportPair[], mapping: Record<string, SlotId | ''>, skipFilled: boolean, characters: Character[] = []): { manuscript: Manuscript; summary: ImportSummary } {
  const summary: ImportSummary = { applied: 0, replaced: 0, skipped: 0, empty: 0 };
  let out = m;
  for (const p of pairs) {
    const had = m.pages.some(pg => pg.cuts.some(c => c.id === p.cutId && c.scene));
    if (had && skipFilled) { summary.skipped++; continue; }
    if (p.src.panel) {
      // 그림 콘티: 출연 인물과 콘티만 넣고 장면은 비운다 (엔진이 콘티대로 새로 만듦)
      const { cast, plan } = panelToCut(p.src.panel, mapping, characters);
      if (!cast.length) { summary.empty++; continue; }
      out = updateCut(out, p.cutId, { scene: null, thumb: null, cast, plan });
    } else {
      const r = remapCut(p.src, mapping);
      if (!r) { summary.empty++; continue; }
      out = updateCut(out, p.cutId, { scene: r.scene, cast: r.cast, thumb: null });
    }
    summary.applied++;
    if (had) summary.replaced++;
  }
  return { manuscript: out, summary };
}
