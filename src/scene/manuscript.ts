// 원고 안의 컷을 찾고 바꾸는 순수 함수들. 원본을 바꾸지 않고 새 원고를 돌려준다.
import type { Character, Cut, EngineScene, Format, FrameStyle, Manuscript, TemplateId, Work } from './types';
import { appendWebtoonCut, makePage } from './layout';
import { newId } from './id';

export interface CutRef { pageIndex: number; cutIndex: number }

export function blankCharacters(): Character[] {
  return [
    { slot: 'A', name: 'A', role: '주인공', gender: '', age: 'adult', model: { kind: 'sample' } },
    { slot: 'B', name: 'B', role: '', gender: '', age: 'adult', model: null },
  ];
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

export function updateCut(m: Manuscript, cutId: string, patch: Partial<Pick<Cut, 'scene' | 'thumb'>>): Manuscript {
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

export function addPage(m: Manuscript): Manuscript {
  if (m.format === 'webtoon') return { ...m, pages: m.pages.map((p, i) => (i === m.pages.length - 1 ? appendWebtoonCut(p, m.style) : p)) };
  return { ...m, pages: [...m.pages, makePage(m.format, m.template, m.style, m.pageRatio)] };
}

export function removePage(m: Manuscript, pageIndex: number): Manuscript {
  if (m.pages.length <= 1) return m;
  return { ...m, pages: m.pages.filter((_, i) => i !== pageIndex) };
}
