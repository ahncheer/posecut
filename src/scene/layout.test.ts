import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE, PAGE_W, TEMPLATES, appendWebtoonCut, cutRatio, makePage, pageLayout, webtoonLayout } from './layout';
import type { Rect } from './types';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

describe('pageLayout', () => {
  for (const t of TEMPLATES) {
    it(`${t.label}: 컷 수가 맞고, 여백 안에 있고, 겹치지 않는다`, () => {
      const { height, rects } = pageLayout(t.id, DEFAULT_STYLE, DEFAULT_PAGE_RATIO);
      expect(rects).toHaveLength(t.cuts);
      const m = DEFAULT_STYLE.margin;
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(m - 1e-6);
        expect(r.y).toBeGreaterThanOrEqual(m - 1e-6);
        expect(r.x + r.w).toBeLessThanOrEqual(PAGE_W - m + 1e-6);
        expect(r.y + r.h).toBeLessThanOrEqual(height - m + 1e-6);
      }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBe(false);
    });
  }

  it('기본 4컷은 같은 크기 네 칸이고 컷 사이가 정확히 gutter만큼 떨어진다', () => {
    const { rects } = pageLayout('four', DEFAULT_STYLE, DEFAULT_PAGE_RATIO);
    const hs = rects.map(r => r.h.toFixed(3));
    expect(new Set(hs).size).toBe(1);
    expect(rects[1].y - (rects[0].y + rects[0].h)).toBeCloseTo(DEFAULT_STYLE.gutter);
  });

  it('페이지 높이는 비율을 따른다 (9:19)', () => {
    expect(pageLayout('one', DEFAULT_STYLE, [9, 19]).height).toBe(760);
  });
});

describe('webtoon', () => {
  it('컷을 더하면 아래로 붙고 페이지가 늘어난다', () => {
    const p = makePage('webtoon', 'three', DEFAULT_STYLE, DEFAULT_PAGE_RATIO);
    const q = appendWebtoonCut(p, DEFAULT_STYLE);
    expect(q.cuts).toHaveLength(4);
    expect(q.height).toBeGreaterThan(p.height);
    const [a, b] = [q.cuts[2].rect, q.cuts[3].rect];
    expect(b.y - (a.y + a.h)).toBeCloseTo(DEFAULT_STYLE.gutter);
    expect(p.cuts).toHaveLength(3); // 원본은 그대로
  });

  it('큰 컷 + 2는 첫 컷이 더 길다', () => {
    const { rects } = webtoonLayout('bigTwo', DEFAULT_STYLE);
    expect(rects[0].h).toBeGreaterThan(rects[1].h);
  });
});

describe('cutRatio', () => {
  it('가로로 긴 컷은 [가로, 9], 세로로 긴 컷은 [9, 세로]', () => {
    expect(cutRatio({ x: 0, y: 0, w: 336, h: 168 })).toEqual([18, 9]);
    expect(cutRatio({ x: 0, y: 0, w: 100, h: 200 })).toEqual([9, 18]);
  });
});
