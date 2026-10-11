import { describe, expect, it } from 'vitest';
import { newManuscript, newWork, addPage } from './manuscript';
import { applyTitle, titleReserve } from './title';
import { DEFAULT_STYLE, DEFAULT_PAGE_RATIO } from './layout';
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
