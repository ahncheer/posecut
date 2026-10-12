// 그림 → 콘티(JSON) → 원고: 만화 페이지 그림을 AI가 읽어 만든 콘티 파일(rough-storyboard)을 원고 페이지·컷으로 바꾼다.
// 형식 설명: docs/storyboard-format.md  (AI에게 줄 요청문은 STORYBOARD_PROMPT)
import type { Character, Cut, CutPlan, Manuscript, Page, PageTitle, SlotId, SplitNode } from './types';
import { MAX_IN_CUT } from './types';
import { PAGE_W, makePage, pageHeightFor } from './layout';
import { applySplit, customCuts } from './split';
import { DEFAULT_TITLE, pageStyle } from './title';
import { newId } from './id';
import { stripNotes } from '../storage/readableJson';

export const POSE_NAMES = ['차렷', '손 흔들기', '만세', '걷기', '고개 숙이기', '팔짱', '허리에 손', '가리키기', '생각하기', '전화하기', '손 내밀기', '놀람', '인사', '기지개',
  '뒤돌아보기', '뛰기', '의자에 앉기', '쪼그려 앉기', '무릎 꿇기', '한쪽 무릎', '턱 괴기', '책상에 엎드리기', '물건 집기', '가방 끈 잡기'];
export const SHOT_KINDS = ['full', 'bust', 'close', 'low', 'high'] as const;
export const FACINGS = ['camera', 'left', 'right', 'three-quarter-left', 'three-quarter-right', 'back', 'back-left', 'back-right'];
export const BUBBLE_KINDS = ['speech', 'thought', 'narration', 'shout', 'whisper', 'sfx', 'monologue', 'phone', 'small'];
export const MARK_KINDS = ['heart', 'sparkle', 'sweat', 'fluster', 'anger', 'scribble', 'gloom', 'blush', 'emphasis', 'music', 'sigh', 'exclaim', 'question'];
export const EMOTIONS = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];
export const FURNITURE = ['chair', 'counter', 'desk', 'can', 'shelf', 'trash'] as const;

export interface SbChar { id: string; name: string; desc?: string }
export interface SbPanelChar { id: string; x?: number; depth?: 'near' | 'mid' | 'far'; facing?: string; pose?: string; emotion?: string; eyes?: 'open' | 'half' | 'closed'; look?: 'camera' | 'other' | 'none' }
export interface SbBubble { kind?: string; text?: string; x?: number; y?: number; w?: number; h?: number; to?: string; rot?: number }
export interface SbMark { kind: string; x?: number; y?: number; size?: number; rot?: number }
export interface SbProp { type: typeof FURNITURE[number]; for?: string; color?: string; colors?: string[] }
export interface SbPanel { box: [number, number, number, number]; shot?: string; chars?: SbPanelChar[]; bubbles?: SbBubble[]; marks?: SbMark[]; props?: SbProp[]; background?: string; note?: string }
export interface SbPage { title?: string; panels: SbPanel[] }
export interface Storyboard { kind: 'rough-storyboard'; version: 1; characters: SbChar[]; pages: SbPage[] }

const num = (v: unknown, d: number, lo = 0, hi = 1) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : undefined);

/** AI 답에 흔한 군더더기 정리: 한 줄·여러 줄 주석, 끝의 쉼표 (문자열 안은 건드리지 않음) */
export function looseJSON(text: string): string {
  let out = '', i = 0, inStr = false;
  while (i < text.length) {
    const ch = text[i], nx = text[i + 1];
    if (inStr) { out += ch; if (ch === '\\') { out += nx ?? ''; i += 2; continue; } if (ch === '"') inStr = false; i++; continue; }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    if (ch === '/' && nx === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (ch === '/' && nx === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
    out += ch; i++;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** 콘티 JSON 글자 → 확인·정리한 콘티. ```json 감싸기, 주석, 설명($) 항목도 받아 준다 */
export function parseStoryboard(text: string): Storyboard {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  const cleaned = looseJSON(a >= 0 && b > a ? t.slice(a, b + 1) : t);
  let raw: unknown;
  try { raw = stripNotes(JSON.parse(cleaned)); } catch { throw new Error('JSON 글자를 읽지 못했어요. AI가 준 답에서 { 부터 } 까지만 붙여넣어 주세요.'); }
  const o = raw as Record<string, unknown>;
  const pagesIn = Array.isArray(o.pages) ? o.pages : Array.isArray(o.panels) ? [{ title: o.title, panels: o.panels }] : null;
  if (!pagesIn) throw new Error('콘티 JSON에 pages(또는 panels)가 없어요.');
  const chars: SbChar[] = (Array.isArray(o.characters) ? o.characters : []).flatMap((c, i) => {
    const r = c as Record<string, unknown>;
    const id = str(r.id, 20) || String.fromCharCode(65 + i);
    return [{ id, name: str(r.name, 40) || id, desc: str(r.desc, 200) }];
  });
  const pages: SbPage[] = pagesIn.slice(0, 50).map(pg => {
    const p = pg as Record<string, unknown>;
    const panels: SbPanel[] = (Array.isArray(p.panels) ? p.panels : []).slice(0, 20).flatMap(pn => {
      const q = pn as Record<string, unknown>;
      const b = Array.isArray(q.box) ? q.box : null;
      if (!b || b.length !== 4) return [];
      const box: [number, number, number, number] = [num(b[0], 0), num(b[1], 0), num(b[2], 1, 0.01), num(b[3], 1, 0.01)];
      const pchars = (Array.isArray(q.chars) ? q.chars : []).slice(0, MAX_IN_CUT).flatMap(c => {
        const r = c as Record<string, unknown>;
        const id = str(r.id, 20);
        if (!id) return [];
        if (!chars.some(x => x.id === id)) chars.push({ id, name: id });
        return [{
          id, x: num(r.x, 0.5), depth: oneOf(r.depth, ['near', 'mid', 'far'] as const), facing: oneOf(r.facing, FACINGS),
          pose: str(r.pose, 30), emotion: oneOf(r.emotion, EMOTIONS), eyes: oneOf(r.eyes, ['open', 'half', 'closed'] as const), look: oneOf(r.look, ['camera', 'other', 'none'] as const),
        }];
      });
      const bubbles = (Array.isArray(q.bubbles) ? q.bubbles : []).slice(0, 30).map(x => {
        const r = x as Record<string, unknown>;
        return {
          kind: oneOf(r.kind, BUBBLE_KINDS) ?? 'speech', text: str(r.text) ?? '', x: num(r.x, 0.5), y: num(r.y, 0.25),
          w: typeof r.w === 'number' ? num(r.w, 0.3, 0.05) : undefined, h: typeof r.h === 'number' ? num(r.h, 0.2, 0.05) : undefined,
          to: str(r.to, 20), rot: typeof r.rot === 'number' ? num(r.rot, 0, -180, 180) : undefined,
        };
      });
      const marks = (Array.isArray(q.marks) ? q.marks : []).slice(0, 30).flatMap(x => {
        const r = x as Record<string, unknown>;
        const kind = oneOf(r.kind, MARK_KINDS);
        return kind ? [{ kind, x: num(r.x, 0.5), y: num(r.y, 0.3), size: num(r.size, 0.08, 0.02, 0.5), rot: num(r.rot, 0, -180, 180) }] : [];
      });
      const props = (Array.isArray(q.props) ? q.props : []).slice(0, 12).flatMap(x => {
        const r = x as Record<string, unknown>;
        const type = oneOf(r.type, FURNITURE);
        const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
        const colors = Array.isArray(r.colors) ? r.colors.map(hex).filter((c): c is string => !!c).slice(0, 8) : undefined;
        return type ? [{ type, for: str(r.for, 20), color: hex(r.color), colors: colors?.length ? colors : undefined }] : [];
      });
      return [{ box, shot: oneOf(q.shot, SHOT_KINDS), chars: pchars, bubbles, marks, props, background: str(q.background, 200), note: str(q.note, 300) }];
    });
    return { title: str(p.title, 40), panels };
  }).filter(p => p.panels.length);
  if (!pages.length) throw new Error('콘티에 컷(panels)이 하나도 없어요.');
  return { kind: 'rough-storyboard', version: 1, characters: chars, pages };
}

/** 콘티 인물 → 작품 인물 처음 짝: 이름이 같으면 그 인물, 아니면 모델 있는 인물 순서대로 */
export function defaultCharMapping(sb: Storyboard, characters: Character[]): Record<string, SlotId | ''> {
  const pool = characters.filter(c => c.model), taken = new Set<string>(), out: Record<string, SlotId | ''> = {};
  const norm = (s: string) => s.trim().toLowerCase();
  sb.characters.forEach(c => { const hit = pool.find(p => !taken.has(p.slot) && p.name && norm(p.name) === norm(c.name)); if (hit) { out[c.id] = hit.slot; taken.add(hit.slot); } });
  sb.characters.forEach(c => { if (out[c.id] !== undefined) return; const n = pool.find(p => !taken.has(p.slot)); out[c.id] = n ? n.slot : ''; if (n) taken.add(n.slot); });
  return out;
}

type Box = { id: string; x0: number; y0: number; x1: number; y1: number };
/**
 * 네모 칸들을 가로·세로 선으로 차례로 나눠(길로틴) 직접 그리기 나무로 만든다.
 * 칸 좌표는 이미 페이지 단위. 한 줄로 못 나누면(겹침 등) 가운데 높이에서 억지로 나눈다.
 */
export function splitFromBoxes(boxes: Box[]): SplitNode {
  if (boxes.length === 1) return { cut: boxes[0].id };
  const tryAxis = (horiz: boolean) => {
    const lo = (b: Box) => (horiz ? b.y0 : b.x0), hi = (b: Box) => (horiz ? b.y1 : b.x1);
    const sorted = [...boxes].sort((a, b) => lo(a) - lo(b));
    let best: { at: number; gap: number; k: number } | null = null, reach = -Infinity;
    for (let k = 0; k < sorted.length - 1; k++) {
      reach = Math.max(reach, hi(sorted[k]));
      const next = lo(sorted[k + 1]), gap = next - reach;
      if (gap > -2 && (!best || gap > best.gap)) best = { at: (reach + next) / 2, gap, k };
    }
    return best ? { ...best, a: sorted.slice(0, best.k + 1), b: sorted.slice(best.k + 1) } : null;
  };
  const h = tryAxis(true), v = tryAxis(false);
  const pick = h && v ? (h.gap >= v.gap ? { ...h, horiz: true } : { ...v, horiz: false }) : h ? { ...h, horiz: true } : v ? { ...v, horiz: false } : null;
  if (pick) {
    return pick.horiz
      ? { line: [0, pick.at, 1, pick.at], a: splitFromBoxes(pick.a), b: splitFromBoxes(pick.b) }
      : { line: [pick.at, 1, pick.at, 0], a: splitFromBoxes(pick.a), b: splitFromBoxes(pick.b) };
  }
  const sorted = [...boxes].sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const half = Math.ceil(sorted.length / 2), at = (sorted[half - 1].y1 + sorted[half].y0) / 2;
  return { line: [0, at, 1, at], a: splitFromBoxes(sorted.slice(0, half)), b: splitFromBoxes(sorted.slice(half)) };
}

/** 콘티 컷 하나 → 이 컷의 출연 인물(cast)과 엔진용 콘티(plan) */
export function panelToCut(panel: SbPanel, mapping: Record<string, SlotId | ''>, characters: Character[]): { cast: SlotId[]; plan: CutPlan } {
  const withModel = new Set(characters.filter(c => c.model).map(c => c.slot));
  const used: { slot: SlotId; c: SbPanelChar }[] = [];
  (panel.chars ?? []).forEach(c => { const s = mapping[c.id]; if (s && withModel.has(s) && !used.some(u => u.slot === s)) used.push({ slot: s, c }); });
  const kept = used.slice(0, MAX_IN_CUT);
  const index = (id?: string) => { const i = kept.findIndex(u => u.c.id === id); return i >= 0 ? i : undefined; };
  return {
    cast: kept.map(u => u.slot),
    plan: {
      shot: oneOf(panel.shot, SHOT_KINDS) ?? 'bust',
      chars: kept.map(({ c }) => ({ x: c.x, depth: c.depth, facing: c.facing, pose: c.pose, emotion: c.emotion, eyes: c.eyes, look: c.look })),
      bubbles: (panel.bubbles ?? []).map(b => ({ kind: b.kind, text: b.text, x: b.x, y: b.y, w: b.w, h: b.h, to: index(b.to), rot: b.rot })),
      marks: panel.marks ?? [],
      props: (panel.props ?? []).flatMap(p => { const i = index(p.for) ?? (kept.length ? 0 : undefined); return i === undefined ? [] : [{ type: p.type, char: i, color: p.color, colors: p.colors }]; }),
      background: panel.background,
      note: panel.note,
    },
  };
}

/** 콘티 한 페이지 → 원고 페이지 (컷 칸은 그림의 칸 위치대로, 제목이 있으면 위 가운데에) */
export function pageFromStoryboard(sbPage: SbPage, m: Pick<Manuscript, 'style' | 'pageRatio'>, mapping: Record<string, SlotId | ''>, characters: Character[], titleStyle: Omit<PageTitle, 'text'> = DEFAULT_TITLE): Page {
  const title: PageTitle | undefined = sbPage.title ? { ...titleStyle, text: sbPage.title } : undefined;
  const st = pageStyle(m.style, title ? { title } : undefined);
  const height = pageHeightFor(m.pageRatio);
  // 칸들의 바깥 테두리를 페이지 안쪽 칸(여백·제목 자리 뺀 곳)에 맞춘다
  const bx = sbPage.panels.map(p => p.box);
  const ux0 = Math.min(...bx.map(b => b[0])), uy0 = Math.min(...bx.map(b => b[1]));
  const ux1 = Math.max(...bx.map(b => b[0] + b[2])), uy1 = Math.max(...bx.map(b => b[1] + b[3]));
  const cx0 = st.margin, cy0 = st.margin + (st.padTop ?? 0), cx1 = PAGE_W - st.margin - (st.padRight ?? 0), cy1 = height - st.margin;
  const mx = (x: number) => cx0 + ((x - ux0) / Math.max(1e-6, ux1 - ux0)) * (cx1 - cx0);
  const my = (y: number) => cy0 + ((y - uy0) / Math.max(1e-6, uy1 - uy0)) * (cy1 - cy0);
  const ids = sbPage.panels.map(() => newId());
  const boxes: Box[] = sbPage.panels.map((p, i) => ({ id: ids[i], x0: mx(p.box[0]), y0: my(p.box[1]), x1: mx(p.box[0] + p.box[2]), y1: my(p.box[1] + p.box[3]) }));
  const blank: Page = { ...makePage('page', 'one', m.style, m.pageRatio), ...(title ? { title } : {}) };
  let root = splitFromBoxes(boxes);
  if (!customCuts(root, height, st)) {
    // 칸이 너무 작게 나뉘면 읽는 순서대로 가로 줄을 고르게
    const evenRows = (k: number): SplitNode => {
      if (k === ids.length - 1) return { cut: ids[k] };
      const y = cy0 + ((cy1 - cy0) * (k + 1)) / ids.length;
      return { line: [0, y, 1, y], a: { cut: ids[k] }, b: evenRows(k + 1) };
    };
    root = evenRows(0);
  }
  const laid = applySplit(blank, root, st, m.pageRatio) ?? blank;
  const byId = new Map(sbPage.panels.map((p, i) => [ids[i], p]));
  const cuts: Cut[] = laid.cuts.map(c => {
    const panel = byId.get(c.id);
    if (!panel) return c;
    const { cast, plan } = panelToCut(panel, mapping, characters);
    return { ...c, cast, plan, scene: null, thumb: null };
  });
  return { ...laid, cuts };
}

/** 콘티를 원고에 넣기: 뒤에 새 페이지로 덧붙이거나, 지금 페이지부터 바꾸기 */
export function applyStoryboard(m: Manuscript, pages: Page[], mode: 'append' | 'replace', at: number): Manuscript {
  if (mode === 'append') return { ...m, pages: [...m.pages, ...pages] };
  const next = [...m.pages];
  next.splice(at, Math.min(pages.length, next.length - at), ...pages);
  return { ...m, pages: next };
}

/** AI에게 줄 요청문 (그림과 함께 보내면 rough-storyboard JSON을 돌려받는다) */
export const STORYBOARD_PROMPT = `첨부한 만화 페이지 그림을 3D 콘티 도구에 넣을 JSON으로 바꿔 주세요. JSON만 답하세요(설명·코드블록 없이).

형식:
{
  "kind": "rough-storyboard", "version": 1,
  "characters": [ { "id": "A", "name": "인물 이름(모르면 역할: 알바생 등)", "desc": "겉모습 한 줄" } ],
  "pages": [ {
    "title": "페이지 맨 위 제목 글자 (없으면 빼기)",
    "panels": [ {
      "box": [x, y, w, h],          // 컷 테두리 위치·크기. 페이지 그림 전체 기준 0~1, 왼쪽 위가 0
      "shot": "full | bust | close | low | high",   // 전신·바스트·클로즈업·로우앵글·하이앵글
      "chars": [ {
        "id": "A",                  // characters의 id
        "x": 0.3,                   // 컷 안 가로 위치 0~1 (머리 중심)
        "depth": "near | mid | far",// 카메라에 가까움·중간·멂
        "facing": "${FACINGS.join(' | ')}",  // 화면 기준 몸이 향한 쪽 (camera = 정면)
        "pose": "${POSE_NAMES.join(' | ')}", // 가장 비슷한 것 하나
        "emotion": "${EMOTIONS.join(' | ')}",
        "eyes": "open | half | closed",
        "look": "camera | other | none"     // 시선: 카메라·상대 인물·없음
      } ],
      "bubbles": [ {
        "kind": "${BUBBLE_KINDS.join(' | ')}",  // speech 대사, thought 생각(구름), narration 네모 설명, shout 외침, whisper 속삭임, sfx 효과음 글자, small 작은 말풍선(…)
        "text": "말풍선 글자 그대로 (줄바꿈은 \\n)",
        "x": 0.5, "y": 0.3,         // 말풍선 가운데, 컷 기준 0~1
        "to": "A"                   // 말하는 인물 id (꼬리 방향). 내레이션·효과음은 빼기
      } ],
      "marks": [ {
        "kind": "${MARK_KINDS.join(' | ')}",  // 하트·반짝·땀·당황선·빡침·엉킨 낙서·우울 세로줄·홍조 빗금·강조선·음표·한숨·!·?
        "x": 0.2, "y": 0.2, "size": 0.06, "rot": 0   // 컷 기준 위치, size = 컷 가로 대비 크기, rot = 기울기(도)
      } ],
      "props": [ { "type": "chair | counter | desk | can | shelf", "for": "A", "color": "#6B4226", "colors": ["#6B4226", "#F2D35B"] } ],
        // 그 인물에 맞춰 놓을 것: 앉아 있으면 chair, 앞 계산대 counter, 책상 desk,
        // can = 음료 캔(원기둥, color = 음료 대표색, 카운터 다음에 적으면 카운터 위에), shelf = 음료 진열대(인물 앞, colors = 캔 색들), trash = 쓰레기통(인물 옆)
      "background": "배경 한 줄 (예: 편의점 카운터, 밤)"
    } ]
  } ]
}
규칙: 컷은 읽는 순서대로. 같은 인물은 모든 컷에서 같은 id. 숫자는 소수 둘째 자리까지.`;
