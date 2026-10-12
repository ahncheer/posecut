// 원고 안의 컷을 찾고 바꾸는 순수 함수들. 원본을 바꾸지 않고 새 원고를 돌려준다.
import type { Character, Cut, EngineScene, Format, FrameStyle, Manuscript, Page, SlotId, TemplateId, Work } from './types';
import { DEFAULT_IN_CUT, MAX_IN_CUT } from './types';
import { appendWebtoonCut, makePage, retemplatePage, templateOf } from './layout';
import { applySplit, cloneSplit, splitFromTemplate } from './split';
import { pageStyle, setTitleOnPage } from './title';
import { newId } from './id';

export interface CutRef { pageIndex: number; cutIndex: number }

export function blankCharacters(): Character[] {
  return [
    { slot: 'A', name: 'A', role: '주인공', gender: '', age: 'adult', model: { kind: 'sample' } },
    { slot: 'B', name: 'B', role: '', gender: '', age: 'adult', model: null },
  ];
}

/** 아직 안 쓴 다음 글자 (A, B 다음은 C …) */
export function nextSlot(characters: Character[]): string {
  const used = new Set(characters.map(c => c.slot));
  for (let i = 0; i < 26; i++) { const s = String.fromCharCode(65 + i); if (!used.has(s)) return s; }
  return `${characters.length + 1}`;
}

export function addCharacter(characters: Character[]): Character[] {
  const slot = nextSlot(characters);
  return [...characters, { slot, name: slot, role: '', gender: '', age: 'adult', model: null }];
}

/** 최소 1명은 남긴다 */
export function removeCharacter(characters: Character[], slot: string): Character[] {
  return characters.length <= 1 ? characters : characters.filter(c => c.slot !== slot);
}

/** 컷에 나올 인물(모델이 있는 사람만). cast를 정했으면 그 순서대로 최대 MAX_IN_CUT명, 안 정했으면 앞의 DEFAULT_IN_CUT명 */
export function castForCut(characters: Character[], cast?: SlotId[]): Character[] {
  if (!cast) return characters.filter(c => c.model).slice(0, DEFAULT_IN_CUT);
  return cast.map(s => characters.find(c => c.slot === s)).filter((c): c is Character => !!c && !!c.model).slice(0, MAX_IN_CUT);
}

/**
 * 컷의 인물 구성이 바뀔 때 저장된 장면의 인물별 자세·배치를 새 순서로 옮긴다.
 * 빠진 사람의 자세는 버리고, 새로 들어온 사람 자리는 null(엔진이 새로 세움)로 둔다.
 */
export function remapSceneSlots(scene: EngineScene | null, oldCast: SlotId[], newCast: SlotId[]): EngineScene | null {
  if (!scene) return null;
  return { ...scene, slots: newCast.map(s => { const i = oldCast.indexOf(s); return i >= 0 && i < scene.slots.length ? scene.slots[i] : null; }) };
}

/** 이 작품의 다음 화 이름 (1화, 2화 …) */
export function nextEpisodeTitle(existingTitlesInWork: string[]): string {
  const nums = existingTitlesInWork.map(t => /^(\d+)화$/.exec(t.trim())?.[1]).filter(Boolean).map(Number);
  return `${Math.max(existingTitlesInWork.length, ...nums, 0) + 1}화`;
}

export function newWork(title = ''): Work {
  return { id: newId(), title, world: '', characters: blankCharacters(), updatedAt: Date.now() };
}

export function newManuscript(opts: { title: string; work: Work; format: Format; template: TemplateId; style: FrameStyle; pageRatio: [number, number] }): Manuscript {
  const now = Date.now();
  return {
    id: newId(), title: opts.title, workId: opts.work.id, format: opts.format, template: opts.template,
    pageRatio: opts.pageRatio, style: opts.style,
    pages: [makePage(opts.format, opts.template, opts.style, opts.pageRatio)],
    createdAt: now, updatedAt: now,
  };
}

/** 모든 컷을 읽는 순서대로 (페이지 → 컷) */
export function allCuts(m: Manuscript): (CutRef & { cut: Cut; number: number })[] {
  const out: (CutRef & { cut: Cut; number: number })[] = [];
  m.pages.forEach((p, pageIndex) => p.cuts.forEach((cut, cutIndex) => out.push({ pageIndex, cutIndex, cut, number: cutIndex + 1 })));
  return out;
}

export function findCut(m: Manuscript, cutId: string): (CutRef & { cut: Cut }) | null {
  for (const [pageIndex, p] of m.pages.entries()) {
    const cutIndex = p.cuts.findIndex(c => c.id === cutId);
    if (cutIndex >= 0) return { pageIndex, cutIndex, cut: p.cuts[cutIndex] };
  }
  return null;
}

export function updateCut(m: Manuscript, cutId: string, patch: Partial<Pick<Cut, 'scene' | 'thumb' | 'cast'>>): Manuscript {
  return {
    ...m,
    pages: m.pages.map(p => ({ ...p, cuts: p.cuts.map(c => (c.id === cutId ? { ...c, ...patch } : c)) })),
  };
}

export function clearCut(m: Manuscript, cutId: string): Manuscript {
  return updateCut(m, cutId, { scene: null, thumb: null });
}

/** 읽는 순서로 바로 앞 컷 (없으면 null) */
export function previousCut(m: Manuscript, cutId: string): Cut | null {
  const list = allCuts(m);
  const i = list.findIndex(x => x.cut.id === cutId);
  return i > 0 ? list[i - 1].cut : null;
}

export function neighbourCutId(m: Manuscript, cutId: string, step: -1 | 1): string | null {
  const list = allCuts(m);
  const i = list.findIndex(x => x.cut.id === cutId);
  const next = list[i + step];
  return next ? next.cut.id : null;
}

/** 장면을 다른 컷에 복사. 비율이 달라도 카메라 값은 그대로 들어간다 (자동 보정은 장면 보관함 단계에서). */
export function pasteScene(m: Manuscript, cutId: string, scene: EngineScene | null, thumb: string | null): Manuscript {
  return updateCut(m, cutId, { scene: scene ? structuredClone(scene) : null, thumb });
}

/** 페이지 순서 바꾸기: from 번째 페이지를 to 번째 자리로 (0부터) */
export function movePage(m: Manuscript, from: number, to: number): Manuscript {
  const n = m.pages.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return m;
  const pages = [...m.pages];
  const [p] = pages.splice(from, 1);
  pages.splice(to, 0, p);
  return { ...m, pages };
}

/** 두 컷의 내용(장면·작은 그림·나오는 인물)을 맞바꾼다. 컷 자리·모양은 그대로 */
export function swapCuts(m: Manuscript, idA: string, idB: string): Manuscript {
  const a = findCut(m, idA)?.cut, b = findCut(m, idB)?.cut;
  if (!a || !b || idA === idB) return m;
  const body = (c: Cut) => ({ scene: c.scene, thumb: c.thumb, cast: c.cast });
  const put = (c: Cut, from: Cut): Cut => {
    const next: Cut = { ...c, ...body(from) };
    if (!from.cast) delete next.cast;
    return next;
  };
  return { ...m, pages: m.pages.map(p => ({ ...p, cuts: p.cuts.map(c => (c.id === idA ? put(c, b) : c.id === idB ? put(c, a) : c)) })) };
}

/** 페이지 추가 (페이지 만화). 틀을 안 주면 마지막 페이지와 같은 틀. 웹툰은 맨 아래에 컷 하나 추가 */
export function addPage(m: Manuscript, template?: TemplateId): Manuscript {
  if (m.format === 'webtoon') return { ...m, pages: m.pages.map((p, i) => (i === m.pages.length - 1 ? appendWebtoonCut(p, m.style) : p)) };
  const last = m.pages[m.pages.length - 1];
  const t = template ?? (last ? templateOf(last, m.template) : m.template);
  let page: Page;
  if (t === 'custom') {
    // 직접 그린 틀: 마지막 직접 그린 페이지와 같은 모양 (없으면 기본 4컷 모양에서 시작)
    const src = [...m.pages].reverse().find(p => p.split);
    const srcStyle = pageStyle(m.style, src);
    const blank = { ...makePage(m.format, 'four', srcStyle, m.pageRatio), ...(src?.title ? { title: src.title } : {}) };
    const split = src?.split ? cloneSplit(src.split) : splitFromTemplate('four', srcStyle, m.pageRatio, blank.cuts.map(c => c.id));
    page = applySplit(blank, split, srcStyle, m.pageRatio) ?? blank;
  } else {
    page = { ...makePage(m.format, t, m.style, m.pageRatio) };
  }
  // 제목은 바로 앞 페이지 설정을 이어받는다 (글자는 비워 둠)
  page = setTitleOnPage(page, last?.title ? { ...last.title, text: '' } : undefined, m);
  return { ...m, pages: [...m.pages, page] };
}

/** 페이지 틀 바꾸기 (페이지 만화). 장면은 앞에서부터 옮기고 남는 수를 돌려준다 */
export function changePageTemplate(m: Manuscript, pageIndex: number, template: TemplateId): { manuscript: Manuscript; lost: number } {
  const page = m.pages[pageIndex];
  if (!page || m.format !== 'page') return { manuscript: m, lost: 0 };
  const r = retemplatePage(page, template, pageStyle(m.style, page), m.pageRatio);
  return { manuscript: { ...m, pages: m.pages.map((p, i) => (i === pageIndex ? r.page : p)) }, lost: r.lost };
}

/** 틀을 바꾸면 사라질 장면 수 (확인 창에 쓰임) */
export function scenesLostByTemplate(m: Manuscript, pageIndex: number, template: TemplateId): number {
  return changePageTemplate(m, pageIndex, template).lost;
}

export function removePage(m: Manuscript, pageIndex: number): Manuscript {
  if (m.pages.length <= 1) return m;
  return { ...m, pages: m.pages.filter((_, i) => i !== pageIndex) };
}

/** 이름을 비워 두면 붙는 자동 이름: 임시1, 임시2 … (이미 쓴 번호 다음) */
export const TEMP_PREFIX = '임시';
export function nextTempName(existing: string[], prefix = TEMP_PREFIX): string {
  const re = new RegExp(`^${prefix}\\s*(\\d+)$`);
  const used = existing.map(t => re.exec(t.trim())?.[1]).filter(Boolean).map(Number);
  return `${prefix}${used.length ? Math.max(...used) + 1 : 1}`;
}

/** 같은 제목이 있으면 숫자를 하나씩 올린다: 카페 → 카페2 → 카페3, 임시1 → 임시2 */
export function uniqueTitle(base: string, existing: string[]): string {
  const want = base.trim();
  const taken = new Set(existing.map(t => t.trim()));
  if (!taken.has(want)) return want;
  const m = /^(.*?)(\d+)$/.exec(want);
  const stem = m ? m[1] : want;
  let n = m ? Number(m[2]) + 1 : 2;
  while (taken.has(`${stem}${n}`)) n++;
  return `${stem}${n}`;
}

/** 입력한 제목(비었으면 임시N)을 겹치지 않게 */
export function resolveTitle(typed: string, existing: string[]): string {
  return typed.trim() ? uniqueTitle(typed, existing) : nextTempName(existing);
}
