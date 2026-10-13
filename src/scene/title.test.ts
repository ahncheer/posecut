import { describe, expect, it } from 'vitest';
import { newManuscript, newWork, addPage } from './manuscript';
import { applyTitle, changePageRatio, titleReserve } from './title';
import { DEFAULT_STYLE, DEFAULT_PAGE_RATIO, pageHeightFor } from './layout';
import { applySplit, splitFromTemplate } from './split';
import type { PageTitle } from './types';

const T: PageTitle = { text: '간식', pos: 'top-center', font: 'Jua', size: 17, color: '#111111' };
const ms = () => newManuscript({ title: 't', work: newWork(), format: 'page', template: 'four', style: DEFAULT_STYLE, pageRatio: DEFAULT_PAGE_RATIO });

describe('page title', () => {
  it('reserves room on top and keeps cut ids', () => {
    const m = ms();
    const before = m.pages[0].cuts;
    const next = applyTitle(m, [0], 0, T);
    const cuts = next.pages[0].cuts;
    expect(cuts.map(c => c.id)).toEqual(before.map(c => c.id));
    expect(cuts[0].rect.y).toBeCloseTo(before[0].rect.y + titleReserve(T).top, 5);
    expect(cuts[3].rect.y + cuts[3].rect.h).toBeCloseTo(before[3].rect.y + before[3].rect.h, 5);
    // 빼면 원래대로
    const back = applyTitle(next, [0], 0, null).pages[0];
    expect(back.title).toBeUndefined();
    back.cuts.forEach((c, i) => expect(c.rect.y).toBeCloseTo(before[i].rect.y, 5));
  });
  it('side title narrows cuts; in-cut title takes no room', () => {
    const m = ms();
    const side = applyTitle(m, [0], 0, { ...T, pos: 'side' }).pages[0];
    expect(side.cuts[0].rect.w).toBeLessThan(m.pages[0].cuts[0].rect.w);
    const inCut = applyTitle(m, [0], 0, { ...T, pos: 'in-cut' }).pages[0];
    expect(inCut.cuts[0].rect).toEqual(m.pages[0].cuts[0].rect);
  });
  it('moves drawn lines with the content box', () => {
    const m = ms();
    const p = m.pages[0];
    const custom = applySplit(p, splitFromTemplate('bigTwo', m.style, m.pageRatio, p.cuts.map(c => c.id)), m.style, m.pageRatio)!;
    const m2 = { ...m, pages: [custom] };
    const next = applyTitle(m2, [0], 0, T).pages[0];
    expect(next.cuts.length).toBe(custom.cuts.length);
    expect(Math.min(...next.cuts.map(c => c.rect.y))).toBeCloseTo(m.style.margin + titleReserve(T).top, 3);
  });
  it('applies to all pages but keeps other pages’ own text; new pages inherit the look', () => {
    let m = addPage(addPage(ms()));
    m = applyTitle(m, [1], 1, { ...T, text: '둘째' });
    m = applyTitle(m, [0, 1, 2], 0, { ...T, text: '첫째', font: 'Gaegu' });
    expect(m.pages.map(p => p.title?.text)).toEqual(['첫째', '둘째', '첫째']);
    expect(m.pages.every(p => p.title?.font === 'Gaegu')).toBe(true);
    const m2 = addPage(m);
    expect(m2.pages[3].title?.font).toBe('Gaegu');
    expect(m2.pages[3].title?.text).toBe('');
    expect(m2.pages[3].cuts[0].rect.y).toBeCloseTo(m.pages[0].cuts[0].rect.y, 5);
  });
});

describe('page ratio change', () => {
  it('stretches template cuts to the new height, keeps scenes and ids, clears thumbs', () => {
    const m0 = applyTitle(ms(), [0], 0, T);
    const scene = { v: 1 } as unknown as import('./types').EngineScene;
    const m = { ...m0, pages: m0.pages.map(p => ({ ...p, cuts: p.cuts.map((c, i) => (i === 1 ? { ...c, scene, thumb: 'data:x' } : c)) })) };
    const next = changePageRatio(m, [1, 3]);
    const p = next.pages[0], before = m.pages[0];
    expect(next.pageRatio).toEqual([1, 3]);
    expect(p.height).toBe(pageHeightFor([1, 3]));
    expect(p.cuts.map(c => c.id)).toEqual(before.cuts.map(c => c.id));
    expect(p.cuts[1].scene).toBe(scene);
    expect(p.cuts[1].thumb).toBeNull();
    // 제목 자리(위)는 그대로, 마지막 컷 아래 끝은 새 높이 - 여백
    expect(p.cuts[0].rect.y).toBeCloseTo(before.cuts[0].rect.y, 5);
    const last = p.cuts[p.cuts.length - 1];
    expect(last.rect.y + last.rect.h).toBeCloseTo(p.height - m.style.margin, 0);
    expect(p.cuts[0].rect.w).toBeCloseTo(before.cuts[0].rect.w, 5);
  });
  it('moves hand-drawn lines with the height', () => {
    const m = ms();
    const root = splitFromTemplate('four', m.style, m.pageRatio, m.pages[0].cuts.map(c => c.id));
    const drawn = applySplit(m.pages[0], root, m.style, m.pageRatio)!;
    const m2 = { ...m, pages: [drawn] };
    const next = changePageRatio(m2, [3, 4]);
    const p = next.pages[0];
    expect(p.split).toBeTruthy();
    expect(p.cuts.map(c => c.id)).toEqual(drawn.cuts.map(c => c.id));
    const bottom = Math.max(...p.cuts.map(c => c.rect.y + c.rect.h));
    expect(bottom).toBeCloseTo(pageHeightFor([3, 4]) - m.style.margin, 0);
  });
});
